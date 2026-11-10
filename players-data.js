/* =========================================================
   STATISTIQUES DES JOUEURS – LIGUE 1 2026-2027
   ---------------------------------------------------------
   Sources (après la 10e journée, consultées le 10/11/2026) :
   - Buts et penalties : https://www.footmercato.net/france/ligue-1/buteur
   - Buts + passes décisives (B+PD), ratio par match et par 90 min :
     https://www.footmercato.net/france/ligue-1/decisif
   Calculs :
   - passes décisives = (B+PD) − buts
   - matchs joués ≈ B+PD ÷ (B+PD par match)
   - minutes ≈ B+PD × 90 ÷ (B+PD par 90 min)
   null = information non disponible dans les sources.
   Avec la clé football-data.org, ces données sont remplacées
   par le classement des buteurs en direct (voir server.py).
   ========================================================= */

let PLAYER_STATS_INFO = {
  live: false,
  label: "après la 10e journée (Foot Mercato, 10/11/2026)",
  sources: ["https://www.footmercato.net/france/ligue-1/buteur", "https://www.footmercato.net/france/ligue-1/decisif"],
};

// [nom, équipe, buts, dont penalties, buts+passes, B+PD par match, B+PD par 90 min]
const PLAYER_ROWS = [
  ["L. Sinayoko", "PFC", 9, 3, 14, 1.4, 1.45],
  ["F. Thauvin", "RCL", 5, 3, 12, 1.2, 1.23],
  ["A. Gouiri", "OM", 7, 1, 10, 1, 1.05],
  ["E. Wahi", "NIC", 6, 2, 8, 0.89, 1.04],
  ["G. Yassine", "RCS", 4, 0, 7, 0.7, 0.76],
  ["E. Lepaul", "REN", 7, 4, 7, 1, 1.16],
  ["C. Cásseres", "TFC", null, null, 6, 0.6, 0.6],
  ["L. Ajorque", "BRE", 5, 1, 6, 0.6, 0.61],
  ["K. Doumbia", "BRE", 4, 1, 6, 0.6, 0.68],
  ["C. Tengstedt", "TFC", 5, 2, 6, 0.75, 0.92],
  ["C. Archer", "AJA", 6, 0, 6, 0.75, 0.77],
  ["S. Szymański", "REN", 4, 0, 5, 0.63, 0.91],
  ["A. Bourabaa", "LMF", 3, 0, 5, 1, 1.13],
  ["O. Giroud", "LIL", 3, 1, 5, 0.56, 1.06],
  ["L. Mafouta", "LMF", 4, 1, 5, 0.5, 0.55],
  ["A. Hakimi", "PSG", 3, 0, 5, 0.63, 0.79],
  ["E. Nuamah", "OL", 4, 0, 5, 0.63, 0.8],
  ["B. Dia", "REN", 5, 1, 5, 0.63, 1.48],
  ["D. Loader", "AJA", 3, 1, 5, 0.5, 0.57],
  ["Ferran Torres", "PSG", 4, 0, 5, 0.5, 0.68],
  ["S. Diop", "NIC", null, null, 5, 0.5, 1.02],
  ["C. Tolisso", "OL", null, null, 5, 0.5, 0.6],
  ["Z. Athekame", "OL", null, null, 5, 0.5, 0.5],
  ["P. Šulc", "OL", null, null, 4, 0.57, 0.86],
  ["M. Lopez", "PFC", null, null, 4, 0.4, 0.43],
  ["J. Clauss", "NIC", 3, 0, 4, 0.4, 0.43],
  ["J. Maja", "HAC", 4, 1, 4, 0.4, 0.59],
  ["P. Brunner", "ASM", 4, 0, 4, 0.5, 0.64],
  ["P. Pagis", "PFC", null, null, 4, 0.4, 0.47],
  ["S. Mayulu", "PSG", 2, 0, 4, 1, 1.64],
  // Présents seulement dans le classement des buteurs
  ["Marquinhos", "PSG", 3, 0, null, null, null],
  ["G. Reyna", "RCS", 3, 0, null, null, null],
  ["H. Abdelli", "OM", 3, 1, null, null, null],
  ["A. Harit", "OM", 3, 0, null, null, null],
  ["T. Jørgensen", "TFC", 3, 0, null, null, null],
  ["N. Edjouma", "BRE", 2, 0, null, null, null],
  ["K. Abdallah", "OM", 2, 0, null, null, null],
];

let PLAYERS = PLAYER_ROWS.map(([name, team, goals, penalties, total, perMatch, per90]) => ({
  name, team, goals, penalties,
  assists: goals != null && total != null ? total - goals : null,
  total,
  matches: total && perMatch ? Math.round(total / perMatch) : null,
  minutes: total && per90 ? Math.round((total * 90) / per90 / 10) * 10 : null,
}));
