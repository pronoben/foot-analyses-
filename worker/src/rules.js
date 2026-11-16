// Règles générales du football : courte synthèse des Lois du Jeu de l'IFAB
// (organisme officiel), avec le lien vers la publication originale.

import { hasPhrase } from "./text.js";

export const IFAB_SOURCE = {
  provider: "IFAB (source officielle)",
  title: "Lois du Jeu 2026/27 (publication officielle)",
  url: "https://downloads.theifab.com/downloads/laws-of-the-game-202627-double-pages?l=en",
};

const RULES = [
  { keys: ["hors jeu", "offside"], law: "Loi 11",
    claim: "Être en position de hors-jeu n'est pas une faute en soi : un joueur l'est si une partie de sa tête, de son corps ou de ses pieds se trouve dans la moitié adverse (ligne médiane exclue) et plus près de la ligne de but adverse que le ballon et l'avant-dernier adversaire. Il n'est sanctionné que s'il participe activement au jeu quand un coéquipier joue le ballon, et il n'y a pas de hors-jeu sur un coup de pied de but, une rentrée de touche ou un corner." },
  { keys: ["duree", "combien de temps", "mi temps", "45 minutes", "90 minutes"], law: "Loi 7",
    claim: "Un match se joue en deux périodes égales de 45 minutes ; la pause de la mi-temps ne dépasse pas 15 minutes." },
  { keys: ["combien de joueurs", "nombre de joueurs", "11 joueurs", "onze joueurs"], law: "Loi 3",
    claim: "Chaque équipe compte au maximum 11 joueurs sur le terrain, dont un gardien ; un match ne peut pas commencer ou se poursuivre si une équipe a moins de 7 joueurs." },
  { keys: ["penalty", "penalties", "point de penalty", "tir au but"], law: "Loi 14",
    claim: "Le penalty est tiré depuis le point de réparation, à 11 m de la ligne de but ; le gardien doit rester sur sa ligne de but, entre les poteaux, jusqu'à ce que le ballon soit frappé." },
  { keys: ["carton rouge", "carton jaune", "cartons", "exclusion", "avertissement"], law: "Loi 12",
    claim: "Un joueur qui reçoit un second avertissement (carton jaune) dans le même match est exclu (carton rouge) ; un joueur exclu ne peut pas être remplacé." },
  { keys: ["but valable", "but valide", "but compte", "ligne de but", "quand y a t il but"], law: "Loi 10",
    claim: "Un but est marqué quand le ballon a entièrement franchi la ligne de but, entre les poteaux et sous la barre transversale, sans faute préalable de l'équipe qui marque." },
  { keys: ["remplacement", "remplacements", "remplacant", "remplacants"], law: "Loi 3",
    claim: "Le nombre de remplaçants autorisés est fixé par le règlement de chaque compétition, dans les limites prévues par les Lois du Jeu." },
];

export function findRules(text) {
  return RULES.filter(rule => rule.keys.some(k => hasPhrase(text, k)));
}

export const RULE_TOPICS = "hors-jeu, durée d'un match, nombre de joueurs, penalty, cartons, but valable, remplacements";
