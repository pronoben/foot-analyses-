// Workers AI intervient en dernier, uniquement pour reformuler des faits déjà
// vérifiés. Il ne reçoit jamais la question de l'utilisateur ni aucune clé.
// Sa phrase est rejetée si elle contient un nombre absent des faits, une URL,
// ou si elle est trop longue : la réponse modèle est alors utilisée.

export const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const SYSTEM = "Tu reformules des faits de football en français. Écris UNE ou DEUX phrases courtes (40 mots maximum), " +
  "claires et neutres. Utilise uniquement les faits fournis : n'ajoute aucun chiffre, nom, date, opinion ni lien.";

const numbers = text => new Set(String(text).match(/\d+(?:[.,]\d+)?/g) || []);

export function validSentence(sentence, factsText) {
  if (!sentence || sentence.length > 320 || /https?:|www\.|\[|\]/i.test(sentence)) return false;
  const allowed = numbers(factsText);
  return [...numbers(sentence)].every(n => allowed.has(n));
}

export async function rephrase(env, store, facts, template) {
  if (!env.AI || env.AI_DISABLED === "true") return { text: template, mode: "modèle" };
  const daily = Number(env.AI_DAILY_CALLS || 150);
  const budget = await store.hit("quota:workers-ai:d", daily, 86400);
  if (!budget.allowed) return { text: template, mode: "quota" };
  const factsText = facts.map(f => `- ${f.claim}`).join("\n").slice(0, 3000);
  try {
    const out = await env.AI.run(env.AI_MODEL || DEFAULT_MODEL, {
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `Faits vérifiés :\n${factsText}` }],
      max_tokens: 120,
      temperature: 0,
    });
    const raw = out?.response ?? out?.choices?.[0]?.message?.content ?? "";
    const sentence = String(raw).replace(/\s+/g, " ").trim().replace(/^"|"$/g, "");
    if (validSentence(sentence, factsText)) return { text: sentence, mode: "ia" };
    return { text: template, mode: "modèle" };
  } catch {
    // Allocation gratuite épuisée ou modèle indisponible : jamais de bascule payante.
    return { text: template, mode: "quota" };
  }
}
