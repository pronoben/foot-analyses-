// Worker Cloudflare du chatbot FootAnalyse (offre gratuite).
//
// Routes :
//   GET  /api/health  → état (sans aucun secret)
//   POST /api/chat    → { messages, turnstileToken } → réponse vérifiable
//
// Protections : CORS limité aux origines autorisées, Turnstile, 10 questions
// par heure et par adresse IP, plafond quotidien du site, validation des
// messages, temporisation après plusieurs erreurs, cache partagé, aucun secret
// dans les réponses.

import { Engine, validateMessages, questionWithContext } from "./engine.js";
import { parseQuestion } from "./intent.js";
import { D1Store, MemoryStore } from "./store.js";
import { redact, simple } from "./verify.js";
import { norm, sha256 } from "./text.js";

const MAX_BODY_BYTES = 16_000;
const ANSWER_TTL = { next_match: 60, last_match: 60, schedule: 600, standings: 600, top_scorers: 3600,
  goals: 3600, appearances: 3600, info: 86400, rules: 86400 };

let memoryStore = null; // repli pour le développement local sans D1

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "https://pronoben.github.io").split(",").map(o => o.trim().replace(/\/$/, "")).filter(Boolean));
}

function corsHeaders(request, env) {
  const origin = (request.headers.get("Origin") || "").replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  };
  if (origin && allowedOrigins(env).has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}

function json(request, env, status, payload) {
  return new Response(JSON.stringify(redact(payload, env)), { status, headers: corsHeaders(request, env) });
}

function getStore(env) {
  if (env.DB) return new D1Store(env.DB);
  if (env.ALLOW_MEMORY_STORE === "true") return (memoryStore ||= new MemoryStore());
  return null;
}

async function verifyTurnstile(env, token, ip, fetchImpl) {
  if (env.TURNSTILE_DISABLED === "true") return { ok: true }; // développement local uniquement
  if (!env.TURNSTILE_SECRET_KEY) return { ok: false, status: 503, error: "Protection anti-abus (Turnstile) non configurée sur le serveur." };
  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, status: 403, error: "Vérification anti-robot manquante. Recharge la page et réessaie." };
  }
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip });
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = await res.json();
    if (data.success) return { ok: true };
  } catch {
    return { ok: false, status: 503, error: "Vérification anti-robot momentanément indisponible." };
  }
  return { ok: false, status: 403, error: "Vérification anti-robot refusée. Recharge la page et réessaie." };
}

export async function handle(request, env, { fetchImpl = (...a) => fetch(...a), now, store: injectedStore } = {}) {
  const url = new URL(request.url);
  const origin = (request.headers.get("Origin") || "").replace(/\/$/, "");
  const originOk = origin && allowedOrigins(env).has(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: originOk ? 204 : 403, headers: corsHeaders(request, env) });
  }
  if (url.pathname === "/api/health" && request.method === "GET") {
    return json(request, env, 200, {
      status: "ok",
      engine: "cloudflare-worker",
      storage: Boolean(env.DB),
      turnstile: Boolean(env.TURNSTILE_SECRET_KEY) || env.TURNSTILE_DISABLED === "true",
      ai: Boolean(env.AI),
      providers: {
        "API-Football": Boolean(env.API_FOOTBALL_KEY), "football-data.org": Boolean(env.FOOTBALL_DATA_KEY),
        TheSportsDB: true, OpenLigaDB: true, "Wikipédia": true,
      },
      time: new Date().toISOString(),
    });
  }
  if (url.pathname !== "/api/chat") return json(request, env, 404, { error: "Route inconnue." });
  if (request.method !== "POST") return json(request, env, 405, { error: "Méthode non autorisée." });
  if (!originOk) return json(request, env, 403, { error: "Origine non autorisée." });

  const store = injectedStore || getStore(env);
  if (!store) return json(request, env, 503, { error: "Stockage (D1) non configuré sur le serveur." });
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const visitor = (await sha256(`${ip}|${env.TURNSTILE_SECRET_KEY || "dev"}`)).slice(0, 24); // IP jamais stockée en clair

  // Temporisation après plusieurs erreurs (5 en 10 minutes).
  const errors = await store.hit(`err:${visitor}`, 5, 600, false);
  if (errors.count >= 5) {
    return json(request, env, 429, { status: "blocked", error: "Trop d'erreurs successives : réessaie dans quelques minutes.", retryAfter: errors.retryAfter });
  }
  const fail = async (status, error) => {
    await store.hit(`err:${visitor}`, 5, 600);
    return json(request, env, status, { status: "error", error });
  };

  if (!(request.headers.get("Content-Type") || "").includes("application/json")) return fail(415, "Content-Type application/json obligatoire.");
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) return fail(413, "Message trop long.");
  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, "Message trop long.");
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Requête illisible.");
  }
  if (!body || typeof body !== "object") return fail(400, "Requête illisible.");
  let clean;
  try {
    clean = validateMessages(body.messages);
  } catch (error) {
    return fail(400, error.message);
  }

  const turnstile = await verifyTurnstile(env, body.turnstileToken, ip, fetchImpl);
  if (!turnstile.ok) {
    return turnstile.status === 503 ? json(request, env, 503, { status: "error", error: turnstile.error }) : fail(turnstile.status, turnstile.error);
  }

  // 10 questions par heure et par visiteur, plafond quotidien du site.
  const perHour = Number(env.QUESTIONS_PER_HOUR || 10);
  const visitorLimit = await store.hit(`q:${visitor}`, perHour, 3600);
  if (!visitorLimit.allowed) {
    const minutes = Math.ceil(visitorLimit.retryAfter / 60);
    return json(request, env, 429, simple("quota", `Limite de ${perHour} questions par heure atteinte. Réessaie dans environ ${minutes} minutes.`, { retryAfter: visitorLimit.retryAfter }));
  }
  const site = await store.hit("q:site", Number(env.QUESTIONS_PER_DAY || 2000), 86400);
  if (!site.allowed) {
    return json(request, env, 429, simple("quota", "Le plafond gratuit de questions du site est atteint pour aujourd'hui. Réessaie demain.", { retryAfter: site.retryAfter }));
  }

  // Réponse identique déjà vérifiée : réutilisée tant qu'elle reste valide.
  const context = questionWithContext(clean);
  const intent = parseQuestion(context).intent;
  const cacheKey = `answer:${await sha256(norm(context))}`;
  const cached = await store.get(cacheKey);
  const nowSec = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt > nowSec) return json(request, env, 200, { ...cached.value, cached: true });

  let result;
  try {
    result = await new Engine(env, store, { fetchImpl, now }).answer(clean);
  } catch (error) {
    if (error instanceof RangeError) return fail(400, error.message);
    console.error("Erreur interne", error?.name);
    return json(request, env, 500, { status: "error", error: "Erreur interne. Réessaie plus tard." });
  }
  if (result.status === "verified" && ANSWER_TTL[intent]) await store.put(cacheKey, result, ANSWER_TTL[intent]);
  return json(request, env, 200, result);
}

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
