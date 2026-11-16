import * as F from "./fixtures.js";

export const SECRETS = {
  FOOTBALL_DATA_KEY: "0123456789abcdef0123456789abcdef",
  API_FOOTBALL_KEY: "fedcba9876543210fedcba9876543210",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAtestSecretValue123456789",
};
export const NOW = new Date("2026-11-16T10:00:00Z");

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/** Remplace fetch : répond comme les vrais fournisseurs et note chaque appel. */
export class FakeFetch {
  constructor(overrides = {}) {
    this.calls = [];
    this.overrides = overrides;
    this.fn = this.fetch.bind(this);
  }

  async fetch(input, init = {}) {
    const url = String(input);
    this.calls.push(url);
    for (const [fragment, value] of Object.entries(this.overrides)) {
      if (url.includes(fragment)) {
        if (value instanceof Error) throw value;
        if (typeof value === "number") return jsonResponse({ message: "erreur simulée" }, value);
        return jsonResponse(value);
      }
    }
    if (url.startsWith("https://challenges.cloudflare.com/turnstile")) {
      const body = new URLSearchParams(String(init.body));
      const ok = body.get("secret") === SECRETS.TURNSTILE_SECRET_KEY && body.get("response") === "jeton-valide";
      return jsonResponse({ success: ok, "error-codes": ok ? [] : ["invalid-input-response"] });
    }
    if (url.startsWith("https://api.football-data.org/v4")) {
      if (init.headers?.["X-Auth-Token"] !== SECRETS.FOOTBALL_DATA_KEY) return jsonResponse({}, 403);
      const path = url.slice("https://api.football-data.org/v4".length);
      if (path.startsWith("/competitions/FL1/matches")) return jsonResponse(F.FD_MATCHES_FL1);
      if (F.FD[path]) return jsonResponse(F.FD[path]);
      return jsonResponse({ message: "introuvable" }, 404);
    }
    if (url.startsWith("https://v3.football.api-sports.io")) {
      if (init.headers?.["x-apisports-key"] !== SECRETS.API_FOOTBALL_KEY) return jsonResponse({ errors: { token: "invalide" }, response: [] });
      return jsonResponse(F.AF_PLAN_ERROR);
    }
    if (url.includes("thesportsdb.com")) return jsonResponse(url.includes("l=4334") ? F.TSDB_FL1 : { table: [] });
    if (url.includes("getbltable")) return jsonResponse(F.OL_TABLE);
    if (url.includes("getgoalgetters")) return jsonResponse(F.OL_GOALS);
    if (url.includes("wikipedia.org/w/api.php")) return jsonResponse(F.WIKI_SEARCH);
    if (url.includes("wikipedia.org/api/rest_v1/page/summary")) return jsonResponse(F.WIKI_SUMMARY);
    throw new Error(`URL inattendue : ${url}`);
  }
}

export function fakeAI(response = "") {
  const ai = { calls: 0, async run() { ai.calls++; return { response }; } };
  return ai;
}

export function chatRequest(question, { token = "jeton-valide", origin = "https://pronoben.github.io", ip = "1.2.3.4", history = [] } = {}) {
  const body = JSON.stringify({ messages: [...history, { role: "user", content: question }], turnstileToken: token });
  const headers = { "Content-Type": "application/json", "CF-Connecting-IP": ip };
  if (origin) headers.Origin = origin;
  return new Request("https://foot-analyses-chat.example.workers.dev/api/chat", { method: "POST", headers, body });
}
