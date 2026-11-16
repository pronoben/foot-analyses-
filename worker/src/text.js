// Outils de texte partagés : normalisation, recherche d'expressions, dates.

export function norm(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`´\-_/.,;:!?()[\]«»"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function hasPhrase(text, phrase) {
  if (!phrase) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}($|[^a-z0-9])`).test(text);
}

export function removePhrase(text, phrase) {
  return text.replace(new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}(?=$|[^a-z0-9])`, "g"), " ");
}

export const TIME_ZONE = "Europe/Paris";

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date inconnue";
  const date = d.toLocaleDateString("fr-FR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return `${date} à ${time}`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date inconnue";
  return d.toLocaleDateString("fr-FR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
}

/** Année de début de la saison en cours (juillet → juin). */
export function currentSeasonStart(now = new Date()) {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export function seasonLabel(start) {
  return `${start}-${start + 1}`;
}

export function ordinal(n) {
  return n === 1 ? "1er" : `${n}e`;
}

export async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Retrouve l'écriture d'origine (accents, majuscules) d'un nom détecté. */
export function displayName(raw, normalizedName) {
  const wanted = normalizedName.split(" ");
  const words = String(raw ?? "").match(/[^\s,;:!?«»"()]+/g) || [];
  for (let i = 0; i + wanted.length <= words.length; i++) {
    const slice = words.slice(i, i + wanted.length);
    if (slice.map(norm).join(" ") === normalizedName) return slice.join(" ");
  }
  return normalizedName.replace(/\b\w/g, c => c.toUpperCase());
}
