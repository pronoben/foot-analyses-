// Politique de vérification, appliquée par le code (pas par le prompt) :
// - un fait sans source réellement consultée est supprimé ;
// - sans aucun fait sourcé, aucune valeur n'est donnée ;
// - 2 fournisseurs concordants → « Vérifié par plusieurs sources » ;
// - 1 seul → « Source unique — vérification complémentaire recommandée » ;
// - désaccord → toutes les valeurs sont affichées et le désaccord signalé ;
// - donnée ancienne ou issue du cache de secours → date affichée en avertissement.

import { formatDateTime } from "./text.js";

export const NO_SOURCE_MESSAGE =
  "Je ne peux pas confirmer cette information avec une source fiable pour le moment. " +
  "Je préfère ne pas donner de chiffre plutôt que d'en inventer un.";

export const LABELS = {
  multiple: "Vérifié par plusieurs sources",
  single: "Source unique — vérification complémentaire recommandée",
  conflict: "Sources en désaccord — valeurs différentes affichées",
};

const OLD_DATA_HOURS = 24;

export class Evidence {
  constructor(now = () => new Date()) {
    this.now = now;
    this.sources = [];
    this.facts = [];
    this.warnings = [];
    this.conflict = false;
  }

  /** Enregistre une source réellement consultée et renvoie son identifiant. */
  source(result) {
    const existing = this.sources.find(s => s.provider === result.provider && s.title === result.title && s.url === result.url);
    if (existing) return existing.id;
    const id = `source-${this.sources.length + 1}`;
    this.sources.push({
      id, provider: result.provider, title: result.title, url: result.url, retrievedAt: result.retrievedAt,
      stale: Boolean(result.stale),
    });
    if (result.stale) {
      this.warn(`${result.provider} indisponible (${result.staleReason}) : donnée issue du cache du ${formatDateTime(result.retrievedAt)}.`);
    }
    return id;
  }

  fact(claim, sourceIds, { conflict = false } = {}) {
    this.facts.push({ claim, sourceIds: [...new Set(sourceIds)], conflict });
    if (conflict) this.conflict = true;
  }

  warn(text) {
    if (!this.warnings.includes(text)) this.warnings.push(text);
  }

  providersOf(fact) {
    return new Set(fact.sourceIds.map(id => this.sources.find(s => s.id === id)?.provider).filter(Boolean));
  }
}

/** Construit la réponse finale ; refuse techniquement toute affirmation non sourcée. */
export function finalize(evidence, { answer, extra = {} }) {
  const valid = new Set(evidence.sources.map(s => s.id));
  const facts = evidence.facts.filter(f => f.sourceIds.length && f.sourceIds.every(id => valid.has(id)));
  if (!facts.length) return unverifiable(evidence.warnings);

  const used = new Set(facts.flatMap(f => f.sourceIds));
  const sources = evidence.sources.filter(s => used.has(s.id));
  let level = "single";
  if (evidence.conflict || facts.some(f => f.conflict)) level = "conflict";
  else if (facts.every(f => evidence.providersOf(f).size >= 2)) level = "multiple";

  const warnings = [...evidence.warnings];
  const nowMs = evidence.now().getTime();
  for (const s of sources) {
    const ageH = (nowMs - new Date(s.retrievedAt).getTime()) / 3600000;
    if (ageH > OLD_DATA_HOURS && !s.stale) {
      warnings.push(`Donnée ${s.provider} récupérée le ${formatDateTime(s.retrievedAt)} : elle peut ne plus être à jour.`);
    }
  }

  const verifiedAt = sources.map(s => s.retrievedAt).sort()[0];
  return {
    status: "verified",
    answer,
    verifiedAt,
    verification: { level, label: LABELS[level] },
    facts: facts.map(({ claim, sourceIds, conflict }) => ({ claim, sourceIds, ...(conflict ? { conflict: true } : {}) })),
    sources: sources.map(({ id, provider, title, url, retrievedAt }) => ({ id, provider, title, url, retrievedAt })),
    warnings,
    ...extra,
  };
}

export function unverifiable(warnings = [], reason = null) {
  return {
    status: "unverifiable",
    answer: reason ? `${reason} ${NO_SOURCE_MESSAGE}` : NO_SOURCE_MESSAGE,
    verifiedAt: null, facts: [], sources: [], warnings,
  };
}

export function simple(status, answer, extra = {}) {
  return { status, answer, verifiedAt: null, facts: [], sources: [], warnings: [], ...extra };
}

export function clarification(reason, questions) {
  return simple("clarification", `Avant de chercher, j'ai besoin de précisions : ${reason}`, { questions });
}

// Dernier filet : aucune valeur ressemblant à une clé ne sort du Worker.
const KEY_LIKE = [/gsk_[A-Za-z0-9]{16,}/g, /sk-[A-Za-z0-9_-]{16,}/g, /AIza[0-9A-Za-z_-]{30,}/g,
  /\b0x4AAA[0-9A-Za-z_-]{10,}\b/g, /\b[a-f0-9]{32}\b/g];

export function redact(value, env) {
  let text = JSON.stringify(value);
  for (const name of ["API_FOOTBALL_KEY", "FOOTBALL_DATA_KEY", "TURNSTILE_SECRET_KEY"]) {
    const secret = env?.[name];
    if (secret && secret.length >= 8) text = text.split(secret).join("[masqué]");
  }
  for (const re of KEY_LIKE) text = text.replace(re, "[masqué]");
  return JSON.parse(text);
}
