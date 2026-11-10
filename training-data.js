/* =========================================================
   COACH – CATALOGUE DE SÉANCES D'ENTRAÎNEMENT
   ---------------------------------------------------------
   ⚠️ Les routines exactes des joueurs professionnels ne sont pas
   publiques (les clubs ne les publient pas). Chaque séance est donc
   « inspirée du style » d'un joueur : elle travaille les qualités
   qui font sa force, avec des exercices classiques de formation.
   Ce ne sont PAS les entraînements réels de ces joueurs.

   Format d'un exercice : { nom, duree (min), detail, volume? }
   ========================================================= */

const TRAINING_QUALITIES = {
  vitesse: { label: "Vitesse & explosivité", icon: "⚡" },
  finition: { label: "Finition", icon: "🎯" },
  dribble: { label: "Dribble & conduite", icon: "🌀" },
  passe: { label: "Passe & vision", icon: "🧭" },
  tete: { label: "Jeu de tête & détente", icon: "🦘" },
  defense: { label: "Défense & duels", icon: "🛡️" },
  endurance: { label: "Endurance & volume", icon: "🔋" },
  gardien: { label: "Gardien de but", icon: "🧤" },
  physique: { label: "Renforcement & prévention", icon: "💪" },
};

const TRAINING_LEVELS = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé", tous: "Tous niveaux" };

// Blocs communs
const WARMUP = {
  nom: "Échauffement dynamique", duree: 10,
  detail: "3 min de footing léger, puis montées de genoux, talons-fesses, pas chassés, fentes marchées et ouvertures de hanches (2 aller-retours de 15 m chacun). Finir par 3 accélérations progressives sur 20 m.",
};
const WARMUP_BALL = {
  nom: "Échauffement avec ballon", duree: 10,
  detail: "5 min de conduite libre en variant les surfaces (intérieur, extérieur, semelle), puis gammes athlétiques (montées de genoux, pas chassés, fentes) et 3 accélérations progressives sur 20 m.",
};
const COOLDOWN = {
  nom: "Retour au calme", duree: 8,
  detail: "3 min de footing très lent, puis étirements doux (quadriceps, ischio-jambiers, mollets, adducteurs, fessiers) : 20 à 30 s chacun, sans forcer, en respirant calmement.",
};

const TRAINING_SESSIONS = [
  {
    id: "vitesse-profondeur",
    titre: "Vitesse explosive et appels en profondeur",
    joueur: "Kylian Mbappé", poste: "Attaquant", qualite: "vitesse", niveau: "intermediaire",
    materiel: ["Ballons", "Plots", "Un partenaire (idéalement)"],
    objectif: "Gagner en vitesse sur les 10 premiers mètres et attaquer l'espace dans le dos de la défense.",
    style: "Mbappé fait la différence par son accélération et ses courses dans la profondeur : cette séance travaille le démarrage, la vitesse maximale et la finition lancée.",
    exercices: [
      WARMUP,
      { nom: "Gammes de course", duree: 6, volume: "4 × 20 m", detail: "Skipping (petites foulées rapides), foulées bondissantes, montées de genoux rapides. Rester gainé, bras actifs." },
      { nom: "Départs arrêtés", duree: 8, volume: "6 × 10 m, récup 1 min", detail: "Départ dans des positions variées : debout, dos tourné, assis, à genoux. Sprint maximal sur 10 m au signal (ou au lâcher d'un ballon)." },
      { nom: "Sprints lancés", duree: 10, volume: "5 × 30 m, récup 2 min", detail: "10 m d'élan progressif puis 20 m à vitesse maximale. Récupération complète : la qualité compte plus que la quantité." },
      { nom: "Appel en profondeur + finition", duree: 12, volume: "8 par côté", detail: "Départ dos au but à 30 m. Appel en diagonale dans le dos d'un plot (défenseur fictif), le partenaire joue dans la course, contrôle orienté vers l'avant et frappe en 2 touches maximum." },
      { nom: "Conduite rapide + frappe", duree: 8, volume: "6 répétitions", detail: "Conduite à pleine vitesse sur 25 m en poussant le ballon loin devant, puis frappe croisée. Alterner les pieds." },
      COOLDOWN,
    ],
    conseils: ["Récupération complète entre les sprints : si tu ralentis, tu ne travailles plus la vitesse.", "Pas plus de 2 séances de vitesse par semaine, jamais le lendemain d'un match.", "Pousse le sol vers l'arrière, regard devant, bras en piston."],
  },
  {
    id: "finition-surface",
    titre: "Finition dans la surface",
    joueur: "Erling Haaland", poste: "Avant-centre", qualite: "finition", niveau: "tous",
    materiel: ["Ballons (8 à 10)", "Un but", "Un partenaire passeur", "Plots"],
    objectif: "Marquer en une ou deux touches dans la surface, sur tous types de ballons.",
    style: "Haaland est redoutable dans la surface : placement, frappe rapide en une touche, reprises. La séance multiplie les situations de finition courte.",
    exercices: [
      WARMUP_BALL,
      { nom: "Frappes en une touche", duree: 10, volume: "10 par pied", detail: "Le partenaire passe à ras de terre depuis le côté (point de penalty). Frappe en une touche, placée plutôt que puissante, vers le petit filet." },
      { nom: "Reprises de volée", duree: 10, volume: "3 × 8", detail: "Le partenaire lance le ballon à la main. Reprise de volée en restant au-dessus du ballon (genou au-dessus, pointe de pied tendue) pour frapper vers le sol." },
      { nom: "Attaque du premier poteau", duree: 8, volume: "8 par côté", detail: "Centre à ras de terre ou à mi-hauteur : appel au premier poteau et déviation. Travailler le timing : partir tard, arriver vite." },
      { nom: "Finition sous pression", duree: 10, volume: "10 répétitions", detail: "Un défenseur part 2 m derrière toi. Réception dans la surface, protection du ballon et frappe dans les 3 secondes." },
      { nom: "Pied faible", duree: 6, volume: "20 frappes", detail: "Frappes à 12-16 m uniquement du pied faible, plat du pied puis cou-de-pied." },
      COOLDOWN,
    ],
    conseils: ["Regarde le gardien et le but avant de recevoir le ballon.", "Précision avant puissance : vise les côtés, au ras du sol.", "Compte tes buts sur 10 tentatives pour suivre tes progrès."],
  },
  {
    id: "dribble-espaces-reduits",
    titre: "Dribble et conduite en espaces réduits",
    joueur: "Lionel Messi", poste: "Meneur / Ailier", qualite: "dribble", niveau: "tous",
    materiel: ["Ballon", "10 plots", "Un partenaire pour le 1 contre 1"],
    objectif: "Garder le ballon collé au pied et éliminer dans un petit espace.",
    style: "Messi conduit avec des touches très courtes et des changements de rythme brusques. Ici on travaille le contrôle rapproché et l'élimination.",
    exercices: [
      WARMUP_BALL,
      { nom: "Slalom serré", duree: 8, volume: "6 passages", detail: "10 plots espacés de 1 m. Passages : pied droit seulement, pied gauche seulement, intérieur-extérieur, semelle. Une touche entre chaque plot." },
      { nom: "Changements de rythme", duree: 8, volume: "8 × 20 m", detail: "Conduite lente avec petites touches, puis accélération brutale de 5 m au signal (ou à chaque plot), puis frein et repartir." },
      { nom: "Feintes de corps", duree: 10, volume: "3 × 10 par feinte", detail: "Face à un plot : crochet intérieur, crochet extérieur, passement de jambes, « croqueta » (passer le ballon d'un pied à l'autre). Accélérer après chaque feinte." },
      { nom: "1 contre 1 en couloir", duree: 12, volume: "8 duels", detail: "Couloir de 10 m × 5 m. Éliminer le défenseur et franchir la ligne en conduite. Le défenseur part de face." },
      { nom: "Jeu en espace réduit", duree: 10, volume: "2 × 5 min", detail: "Dans un carré de 8 × 8 m avec 2 ou 3 joueurs, garder le ballon le plus longtemps possible. Seul : jongles et contrôles dans le carré sans en sortir." },
      COOLDOWN,
    ],
    conseils: ["Le ballon ne doit jamais s'éloigner de plus d'un pas.", "Garde la tête haute entre les touches.", "Le dribble se gagne dans l'accélération qui suit la feinte."],
  },
  {
    id: "tete-detente",
    titre: "Jeu de tête, détente et coups francs",
    joueur: "Cristiano Ronaldo", poste: "Attaquant", qualite: "tete", niveau: "avance",
    materiel: ["Ballons", "Un but", "Un partenaire centreur", "Un mur ou mannequin (option)"],
    objectif: "Sauter plus haut, mieux timer ses têtes et travailler les coups francs.",
    style: "Ronaldo est connu pour sa détente, son jeu de tête et ses coups francs : la séance combine pliométrie, timing et frappe arrêtée.",
    exercices: [
      WARMUP,
      { nom: "Pliométrie", duree: 10, volume: "3 × 8 sauts, récup 1 min 30", detail: "Sauts groupés sur place, puis sauts en contre-bas et rebond (sur une marche basse). Réception souple, genoux alignés avec les pieds." },
      { nom: "Timing de saut", duree: 8, volume: "3 × 6", detail: "Le partenaire lance le ballon en cloche. Élan de 2-3 pas, appel sur un pied, toucher le ballon au point le plus haut avec le front." },
      { nom: "Têtes vers le but", duree: 12, volume: "8 centres par côté", detail: "Centres depuis l'aile : attaquer le ballon (ne pas l'attendre), front ouvert, viser le sol pour faire rebondir devant le gardien." },
      { nom: "Coups francs", duree: 12, volume: "15 frappes", detail: "À 20-25 m. Choisis une technique (enroulé intérieur du pied ou frappe « flottante » cou-de-pied sans rotation) et répète-la. Même routine avant chaque frappe." },
      COOLDOWN,
    ],
    conseils: ["Pliométrie : seulement si tu es bien échauffé et sans douleur aux genoux. Pas de pliométrie intense avant 14-15 ans.", "Garde les yeux ouverts au contact du ballon.", "Pour les coups francs, la routine compte autant que la technique."],
  },
  {
    id: "dribble-aile",
    titre: "Élimination sur l'aile et frappe enroulée",
    joueur: "Lamine Yamal", poste: "Ailier", qualite: "dribble", niveau: "intermediaire",
    materiel: ["Ballons", "Plots", "Un but", "Échelle de rythme (option)"],
    objectif: "Éliminer en 1 contre 1 sur le côté et finir par un centre ou une frappe enroulée.",
    style: "Lamine Yamal provoque sur l'aile, rentre sur son pied fort et enroule. La séance travaille les appuis, le 1 contre 1 et la frappe enroulée.",
    exercices: [
      WARMUP_BALL,
      { nom: "Jeu de jambes", duree: 8, volume: "6 passages", detail: "Échelle de rythme (ou plots au sol) : appuis rapides 1 pied par case, 2 pieds par case, pas latéraux. Finir chaque passage par une conduite de 5 m." },
      { nom: "Conduite extérieur du pied", duree: 8, volume: "6 × 25 m", detail: "Conduite rapide le long de la ligne de touche, uniquement extérieur du pied fort, puis crochet intérieur vers l'axe." },
      { nom: "1 contre 1 sur l'aile", duree: 12, volume: "10 duels", detail: "Départ à 30 m du but face à un défenseur. Deux options : déborder et centrer, ou rentrer sur le pied fort et frapper." },
      { nom: "Frappes enroulées", duree: 12, volume: "15 frappes", detail: "Depuis le coin de la surface, après une conduite vers l'axe : frappe intérieur du pied vers le poteau opposé, en ouvrant le pied." },
      COOLDOWN,
    ],
    conseils: ["Attaque le défenseur de face pour le fixer avant de partir.", "Variante : travaille aussi le centre en retrait, souvent plus efficace qu'un centre haut."],
  },
  {
    id: "passe-vision",
    titre: "Passes longues, centres et vision du jeu",
    joueur: "Kevin De Bruyne", poste: "Milieu offensif", qualite: "passe", niveau: "intermediaire",
    materiel: ["Ballons", "Plots de couleur", "Un ou deux partenaires", "Un mur (option)"],
    objectif: "Gagner en précision sur les passes longues et les centres, et prendre l'information avant de recevoir.",
    style: "De Bruyne trouve ses partenaires de loin avec des passes tendues et des centres précis. La séance travaille la qualité de frappe de passe et la vision.",
    exercices: [
      WARMUP_BALL,
      { nom: "Passes contre un mur", duree: 8, volume: "4 × 1 min par pied", detail: "À 5 m d'un mur : passes en une touche, puis contrôle-passe en deux touches. Alterner les pieds." },
      { nom: "Passes longues", duree: 12, volume: "20 passes", detail: "Avec un partenaire à 30-40 m. Passes tendues (cou-de-pied, cheville verrouillée) puis passes en cloche. Le partenaire ne doit pas bouger de plus de 2 pas." },
      { nom: "Centres en course", duree: 10, volume: "10 par côté", detail: "Conduite le long de l'aile puis centre dans une zone de 5 × 5 m délimitée devant le but (au point de penalty ou au second poteau)." },
      { nom: "Prise d'information", duree: 10, volume: "3 × 3 min", detail: "Un partenaire lève un plot de couleur derrière toi pendant que la passe arrive : regarde par-dessus l'épaule, annonce la couleur et joue dans cette direction." },
      COOLDOWN,
    ],
    conseils: ["Regarde avant de recevoir, pas après.", "Pied d'appui à côté du ballon, orienté vers la cible.", "Une passe longue réussie arrive dans la course du partenaire."],
  },
  {
    id: "controle-oriente",
    titre: "Contrôle orienté et jeu court",
    joueur: "Luka Modrić", poste: "Milieu relayeur", qualite: "passe", niveau: "tous",
    materiel: ["Ballons", "Plots", "3 à 5 joueurs pour le rondo (option)"],
    objectif: "Recevoir en étant déjà tourné vers le jeu et enchaîner vite.",
    style: "Modrić enchaîne contrôle orienté et passe (souvent de l'extérieur du pied) sans perdre de temps. La séance travaille la première touche.",
    exercices: [
      WARMUP_BALL,
      { nom: "Contrôle orienté", duree: 10, volume: "3 × 10 par pied", detail: "Le partenaire passe, tu contrôles en orientant le ballon à 45° vers un plot (à droite ou à gauche selon le signal), puis passe en retour." },
      { nom: "Passes extérieur du pied", duree: 8, volume: "3 × 10", detail: "Passes courtes puis moyennes de l'extérieur du pied fort. Cheville verrouillée, frapper le centre du ballon." },
      { nom: "Triangle de passes", duree: 10, volume: "4 × 2 min", detail: "Trois plots en triangle de 8 m : passe, suis ta passe, reçois de l'autre côté. Deux touches maximum, puis une seule touche." },
      { nom: "Rondo 4 contre 2", duree: 12, volume: "4 × 2 min 30", detail: "Carré de 10 × 10 m, 4 joueurs à l'extérieur, 2 au milieu. Deux touches maximum. Seul : jongles et passes contre un mur en une touche." },
      COOLDOWN,
    ],
    conseils: ["Ouvre ton corps avant que le ballon arrive.", "La première touche doit préparer la deuxième."],
  },
  {
    id: "defense-duels",
    titre: "Défense, duels et jeu aérien",
    joueur: "Virgil van Dijk", poste: "Défenseur central", qualite: "defense", niveau: "intermediaire",
    materiel: ["Ballons", "Plots", "Un partenaire attaquant"],
    objectif: "Mieux défendre en 1 contre 1, gagner les duels aériens et relancer proprement.",
    style: "Van Dijk défend avec calme et placement, gagne les duels aériens et relance long. La séance travaille les appuis défensifs, le 1 contre 1 et la relance.",
    exercices: [
      WARMUP,
      { nom: "Appuis défensifs", duree: 8, volume: "6 × 15 m", detail: "Pas chassés latéraux, course arrière, changement de direction au signal. Rester bas, poids sur l'avant des pieds." },
      { nom: "1 contre 1 défensif", duree: 12, volume: "10 duels", detail: "Couloir de 15 × 8 m. Orienter l'attaquant vers l'extérieur, ne pas plonger, intervenir quand le ballon s'éloigne de son pied." },
      { nom: "Duels aériens", duree: 10, volume: "3 × 8", detail: "Ballons lancés haut par le partenaire : sauter avec élan, protéger avec le corps (sans les bras), dégager loin et sur les côtés." },
      { nom: "Relance longue", duree: 10, volume: "15 passes", detail: "Après un contrôle orienté, passe longue vers une zone de 10 × 10 m à 35 m (couloir latéral)." },
      COOLDOWN,
    ],
    conseils: ["Ne regarde pas les pieds de l'attaquant mais le ballon.", "Parle et place tes coéquipiers : un défenseur central organise."],
  },
  {
    id: "endurance-recuperation",
    titre: "Endurance, pressing et récupération du ballon",
    joueur: "N'Golo Kanté", poste: "Milieu récupérateur", qualite: "endurance", niveau: "intermediaire",
    materiel: ["Plots", "Ballons", "Chronomètre"],
    objectif: "Répéter les efforts intenses et récupérer des ballons tout le match.",
    style: "Kanté couvre énormément de terrain et récupère beaucoup de ballons. La séance mélange fractionné et exercices d'interception.",
    exercices: [
      WARMUP,
      { nom: "Fractionné 15-15", duree: 20, volume: "2 blocs de 8 min, 3 min de récup", detail: "15 s de course rapide (environ 85 % de ta vitesse max), 15 s de marche ou trot. Garder la même distance à chaque répétition." },
      { nom: "Navettes de pressing", duree: 8, volume: "6 × 30 s", detail: "Sprint de 5 m vers un plot, freinage, pas chassés, retour. Simule la course vers le porteur du ballon." },
      { nom: "Jeu d'interception", duree: 10, volume: "4 × 2 min", detail: "Deux partenaires se passent le ballon à 10 m, tu essaies d'intercepter en anticipant. Seul : réagir à un ballon lancé contre un mur." },
      { nom: "Gainage", duree: 6, volume: "3 tours", detail: "Planche 30 s, planche latérale 20 s par côté, pont fessier 30 s." },
      COOLDOWN,
    ],
    conseils: ["Le fractionné se fait à allure régulière : ne pars pas trop vite.", "Récupère bien le lendemain (sommeil, hydratation)."],
  },
  {
    id: "gardien-reflexes",
    titre: "Gardien : réflexes, plongeons et sorties",
    joueur: "Thibaut Courtois / Manuel Neuer", poste: "Gardien", qualite: "gardien", niveau: "tous",
    materiel: ["Gants", "Ballons", "Un but", "Un partenaire tireur"],
    objectif: "Améliorer ses réflexes, ses plongeons, ses sorties et son jeu au pied.",
    style: "Courtois s'appuie sur sa taille et son placement, Neuer sur ses sorties et son jeu au pied : la séance couvre ces quatre domaines.",
    exercices: [
      { nom: "Échauffement gardien", duree: 10, detail: "Footing, mobilité des épaules et des hanches, puis prises de balle à la main (balles basses, à hauteur de poitrine, au-dessus de la tête)." },
      { nom: "Plongeons", duree: 10, volume: "3 × 6 par côté", detail: "Balles au sol puis à mi-hauteur. Départ en position de base, pas d'approche, chute sur le côté (pas sur le ventre)." },
      { nom: "Réflexes courte distance", duree: 8, volume: "3 × 10", detail: "Tirs à 6-8 m, rapides et rapprochés. Rester bas, mains devant." },
      { nom: "Sorties aériennes", duree: 10, volume: "10 centres", detail: "Centres depuis l'aile : annoncer « gardien ! », sortir genou haut, capter au point le plus haut." },
      { nom: "Jeu au pied", duree: 10, volume: "20 relances", detail: "Passes courtes sous pression d'un partenaire, puis dégagements longs vers une zone cible." },
      COOLDOWN,
    ],
    conseils: ["Le placement évite la moitié des plongeons.", "Échauffe toujours épaules et poignets avant de plonger."],
  },
  {
    id: "box-to-box",
    titre: "Milieu box-to-box : projection et frappe",
    joueur: "Jude Bellingham", poste: "Milieu box-to-box", qualite: "endurance", niveau: "avance",
    materiel: ["Ballons", "Plots", "Un but", "Un partenaire"],
    objectif: "Répéter les courses d'une surface à l'autre et rester efficace devant le but.",
    style: "Bellingham défend, se projette et marque. La séance combine courses longues, arrivée dans la surface et frappe.",
    exercices: [
      WARMUP_BALL,
      { nom: "Courses surface à surface", duree: 12, volume: "6 × 60 m, récup 1 min", detail: "Course à 80 % sur 60 m, frappe à l'arrivée sur un ballon posé au point de penalty, retour en trottinant." },
      { nom: "Arrivée dans la surface", duree: 10, volume: "8 répétitions", detail: "Passe à un partenaire sur le côté, sprint vers la surface, reprise du centre en retrait." },
      { nom: "Frappes à distance", duree: 10, volume: "15 frappes", detail: "Après un contrôle orienté à 20 m : frappe cou-de-pied, cadrée et basse." },
      { nom: "Gainage dynamique", duree: 6, volume: "3 tours", detail: "Planche avec toucher d'épaule 30 s, mountain climbers 30 s, pont fessier 30 s." },
      COOLDOWN,
    ],
    conseils: ["Garde de la lucidité dans la fatigue : la dernière frappe doit être aussi propre que la première."],
  },
  {
    id: "avant-centre-complet",
    titre: "Avant-centre complet : dos au but et frappes",
    joueur: "Harry Kane", poste: "Avant-centre", qualite: "finition", niveau: "intermediaire",
    materiel: ["Ballons", "Un but", "Un partenaire"],
    objectif: "Jouer dos au but, décrocher pour faire jouer, et frapper de loin.",
    style: "Kane marque mais fait aussi jouer les autres en décrochant. La séance travaille les remises, la passe en profondeur et la frappe.",
    exercices: [
      WARMUP_BALL,
      { nom: "Remises en une touche", duree: 10, volume: "3 × 10", detail: "Dos au but, le partenaire passe fort : remise en une touche dans ses pieds en protégeant avec le corps." },
      { nom: "Décrocher et lancer", duree: 10, volume: "10 répétitions", detail: "Décrochage vers le milieu, contrôle orienté vers l'avant, passe en profondeur dans la course d'un partenaire (ou vers une zone plotée)." },
      { nom: "Pivot et frappe", duree: 10, volume: "12 frappes", detail: "Réception dos au but à 18 m, pivot rapide et frappe en deux touches." },
      { nom: "Penaltys", duree: 6, volume: "10 tirs", detail: "Choisis ta routine (élan, regard, côté) et garde-la à chaque tir." },
      COOLDOWN,
    ],
    conseils: ["Avant de recevoir, regarde où est le défenseur pour savoir si tu peux te retourner."],
  },
  {
    id: "renforcement-prevention",
    titre: "Renforcement et prévention des blessures (sans matériel)",
    joueur: "Tous les pros", poste: "Tous postes", qualite: "physique", niveau: "tous",
    materiel: ["Un tapis (option)"],
    objectif: "Renforcer les muscles qui protègent des blessures les plus fréquentes au football.",
    style: "Les clubs pros font tous du renforcement préventif (ischio-jambiers, gainage, adducteurs). Cette routine reprend des exercices classiques de prévention.",
    exercices: [
      WARMUP,
      { nom: "Gainage", duree: 6, volume: "3 tours", detail: "Planche 30 s, planche latérale 20 s par côté. Corps aligné, sans creuser le dos." },
      { nom: "Squats et fentes", duree: 8, volume: "3 × 12 squats, 3 × 8 fentes par jambe", detail: "Descendre en contrôlant, genoux dans l'axe des pieds." },
      { nom: "Nordic hamstring (ischio-jambiers)", duree: 6, volume: "3 × 5", detail: "À genoux, pieds tenus par un partenaire : descendre le buste le plus lentement possible vers l'avant, se rattraper avec les mains. Exercice de prévention très utilisé dans le football." },
      { nom: "Adducteurs (Copenhague)", duree: 5, volume: "3 × 20 s par côté", detail: "Planche latérale, jambe du dessus posée sur un banc ou une chaise. Version facile : genou posé." },
      { nom: "Mollets et équilibre", duree: 5, volume: "3 × 15 + 3 × 30 s", detail: "Montées sur la pointe des pieds, puis équilibre sur une jambe, yeux fermés pour les plus avancés." },
      COOLDOWN,
    ],
    conseils: ["2 fois par semaine suffisent, loin des matchs.", "Une douleur vive = on arrête et on demande conseil à un professionnel de santé."],
  },
];

// Durée totale d'une séance
TRAINING_SESSIONS.forEach(s => { s.duree = s.exercices.reduce((t, e) => t + (e.duree || 0), 0); });
