# ⚽ FootAnalyse

Application web d'analyse des matchs des cinq grands championnats : Ligue 1,
Premier League, Liga, Serie A et Bundesliga. Le projet réunit les résultats,
les statistiques, les pronostics, les compositions probables et un espace de
coaching personnalisé.

## Fonctionnalités

- **Accueil** : chiffres clés, meilleures attaques et défenses, prochaine journée.
- **Direct** : matchs du jour et scores transmis par football-data.org.
- **Actualités** : titres provenant de flux RSS/Atom configurés côté serveur.
- **Matchs et compositions** : calendrier, analyse d'avant-match, onze probable et absents.
- **Classement** : classement des cinq championnats et zones importantes.
- **Pronostics** : modèle de Poisson, buts attendus et scores les plus probables.
- **Coach** : catalogue de séances inspirées des qualités de joueurs professionnels,
  filtres par niveau et qualité, fiches détaillées et programme local personnalisé.
- **Assistant vérifié et gratuit** : réponses construites à partir de fournisseurs de
  données (football-data.org, TheSportsDB, OpenLigaDB), sources cliquables, date des
  données, comparaison des sources et refus de répondre sans donnée vérifiable.
- **MCP en lecture seule** : accès aux données football pour un assistant compatible.

Les pronostics sont des estimations statistiques, pas des certitudes ni des conseils
de pari. Le programme de coaching est une base éducative et ne remplace pas un
entraîneur ou un professionnel de santé.

## Lancer le projet sur Windows

Il faut Python 3.11 ou plus. Dans PowerShell :

```powershell
py -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python server.py
```

Ouvrir ensuite <http://localhost:8765>. Les clés dans `.env` sont facultatives :
le site conserve ses données enregistrées et son moteur local si elles sont absentes.

## Configuration du backend

| Variable | Usage |
|---|---|
| `FOOTBALL_DATA_KEY` | Matchs du jour, classement, calendrier et buteurs via [football-data.org](https://www.football-data.org/client/register) |
| `ANTHROPIC_API_KEY` | Chatbot Claude et compositions actualisées |
| `ENABLE_PUBLIC_AI` | Autorise `/api/chat` et `/api/lineup` lorsqu'il vaut `true` |
| `ALLOWED_ORIGINS` | Liste des sites autorisés à appeler le backend |
| `NEWS_FEEDS` | Flux RSS/Atom HTTPS séparés par des virgules |
| `TRUST_PROXY` | À activer uniquement derrière un proxy maîtrisé |

Le forfait gratuit de football-data.org peut fournir des scores différés. Un vrai
direct commercial demande un fournisseur et un abonnement adaptés. L'interface
indique donc clairement que le délai dépend de la source.

Le chatbot public ne revient jamais silencieusement sur les anciennes données du
site. Si le backend IA n'est pas déployé ou si la recherche ne fournit aucune
citation HTTPS, il indique que la vérification est indisponible au lieu de produire
une réponse potentiellement fausse.

### Sécurité avant une mise en ligne publique

- Ne jamais placer une clé dans `config.js`, le HTML ou GitHub Pages.
- Garder `ENABLE_PUBLIC_AI=false` tant qu'une authentification par utilisateur
  n'est pas ajoutée. Les limites de requêtes réduisent l'abus mais ne remplacent
  pas une connexion sécurisée.
- Restreindre `ALLOWED_ORIGINS` au domaine public exact.
- Déployer le backend derrière HTTPS et conserver `.env` hors de Git.
- Les routes IA utilisent le contexte construit par le serveur, pas un contexte
  arbitraire envoyé par le navigateur.

## GitHub Pages et backend

GitHub Pages ne sert que les fichiers statiques : il ne peut pas exécuter
`server.py` ni `mcp_server.py`. Pour rendre le Direct, les Actualités et les fonctions
IA disponibles sur le site public :

1. Déployer ce dépôt sur un hébergeur Python avec HTTPS.
2. Configurer les variables d'environnement sur cet hébergeur.
3. Dans `config.js`, mettre l'URL publique dans `apiBase`, par exemple :

```js
window.FOOTANALYSE_CONFIG = Object.freeze({
  apiBase: "https://api.exemple.fr",
});
```

4. Ajouter `https://pronoben.github.io` à `ALLOWED_ORIGINS`.
5. Vérifier `/api/live`, `/api/news` et le site depuis un vrai navigateur.

Sans backend déployé, les rubriques historiques et le coaching local continuent de
fonctionner, tandis que Direct et Actualités affichent une explication claire.

### Chatbot en ligne : Worker Cloudflare (version 1 gratuite)

Le chatbot du site public passe par le Worker Cloudflare du dossier [`worker/`](worker/README.md) :
sources gratuites (API-Football, football-data.org, TheSportsDB, OpenLigaDB,
Wikipédia, IFAB), cache partagé, Turnstile, 10 questions par heure et par visiteur,
Workers AI uniquement pour reformuler des faits déjà vérifiés. Chaque réponse
contient `status`, `answer`, `verifiedAt`, `facts` (reliés à `sourceIds`), `sources`
et `warnings`. Déploiement et limites : voir `worker/README.md`.

### Chatbot gratuit Python (développement local)

Le chatbot ne répond jamais de mémoire : il interroge des fournisseurs de données,
compare leurs résultats et cite chaque source avec sa date.

| Service | Rôle | Limites gratuites |
|---|---|---|
| [football-data.org](https://www.football-data.org/coverage) | Source principale : classements, buteurs, matchs | Clé gratuite, 10 requêtes/minute, 12 compétitions (5 grands championnats, Ligue des champions…), scores légèrement différés |
| [TheSportsDB](https://www.thesportsdb.com/documentation) | Seconde source pour le haut du classement | Clé publique, 30 requêtes/minute, 5 premières places seulement |
| [OpenLigaDB](https://api.openligadb.de) | Seconde source Bundesliga (classement, buteurs) | Gratuit, sans clé |
| Groq (facultatif) | IA gratuite : comprendre une question, rédiger une phrase | Quotas journaliers de l'offre gratuite ; sans carte bancaire, un dépassement est refusé, jamais facturé |
| Render | Hébergement du serveur | 750 h/mois, mise en veille après 15 min ; sans moyen de paiement, suspension au lieu de facturation |

Fonctionnement à chaque question (`free_chat.py`, `free_sources.py`) :

1. comprendre la question (règles simples ; l'IA gratuite ne sert qu'en secours et
   ne peut que choisir parmi des catégories fixées) ;
2. demander ce qui manque : pour « Combien de buts a João Pedro ? », le joueur exact,
   le club, la saison et la compétition ;
3. consulter les sources (cache de 10 minutes partagé entre tous les visiteurs) ;
4. comparer les sources quand il y en a deux et signaler tout désaccord ;
5. confier les faits à l'IA gratuite pour une phrase simple : la phrase est rejetée
   si elle contient un nombre absent des données ;
6. répondre avec les sections Réponse courte, Faits vérifiés, Analyse (calculs),
   Comparaison des sources, Limites, la date des données et les liens des sources.

Questions couvertes (saison en cours) : classement, position d'une équipe, meilleurs
buteurs, buts d'un joueur (championnat, Ligue des champions ou total vérifiable),
dernier résultat, prochain match. Coupes nationales, Ligue Europa, saisons passées
et pronostics sont refusés avec une explication. Toute demande de clé, de mot de
passe ou d'instruction interne est refusée.

Quotas : chaque fournisseur a un compteur côté serveur réglé sous la limite
officielle. Quand il est atteint, le chatbot l'annonce (« quota gratuit atteint,
réessaie dans N secondes ») sans appeler le fournisseur.

### Déploiement sur Render

`render.yaml` décrit le service (`python server.py`, contrôle de santé sur
`/api/health`). Variables à définir dans Render (les clés ne se mettent **que**
dans Render, jamais dans le dépôt) :

| Variable | Valeur |
|---|---|
| `FOOTBALL_DATA_KEY` | clé gratuite football-data.org |
| `GROQ_API_KEY` | facultatif, clé gratuite Groq |
| `CHAT_ENGINE` | `free` |
| `ENABLE_PUBLIC_AI` | `false` (aucune IA payante) |
| `ALLOWED_ORIGINS` | `https://pronoben.github.io` |
| `TRUST_PROXY` | `true` (Render passe par Cloudflare) |

Protections : 8 questions par 5 minutes et 30 par jour pour chaque visiteur,
1 500 questions par jour pour tout le site, 4 traitements simultanés, questions
limitées à 1 000 caractères, en-tête `Origin` obligatoire.

Sur l'offre gratuite, Render met le service en veille après 15 minutes sans visite ;
la première question peut alors attendre environ une minute.

L'ancien chatbot Claude (`chatbot_ai.py`, payant) reste disponible avec
`CHAT_ENGINE=anthropic` et `ENABLE_PUBLIC_AI=true`.

## Accès par une IA avec MCP

`mcp_server.py` expose en lecture seule les championnats, classements, prochains
matchs et meilleurs buteurs aux assistants compatibles MCP.

```powershell
.\.venv\Scripts\python mcp_server.py
```

Le serveur écoute par défaut sur `http://127.0.0.1:8000/mcp` en Streamable HTTP.
L'adresse locale n'est accessible que sur cet ordinateur. Pour partager l'accès,
déployer le serveur derrière HTTPS ou utiliser un tunnel sécurisé pendant les tests.
N'ajoutez pas d'outil d'écriture sans authentification et autorisations séparées.

## Organisation du code

| Partie | Fichiers |
|---|---|
| Structure et design | `index.html`, `style.css` |
| Navigation et analyses | `app.js`, `analysis.js` |
| Direct et actualités | `live.js`, routes `/api/live` et `/api/news` dans `server.py` |
| Coaching | `training-data.js`, `coach.js` |
| Configuration publique | `config.js` (URL du backend uniquement, jamais de clé) |
| Données des championnats | `data.js`, `leagues.js`, fichiers de championnat |
| Chatbot gratuit | `free_chat.py`, `free_sources.py`, interface `chatbot.js` |
| Assistant local (ancien) | `chat-local.js`, `chat-players.js` |
| Backend web | `server.py` |
| Serveur MCP | `mcp_server.py` |
| IA Claude (payante, désactivée par défaut) | `chatbot_ai.py`, `lineups_ai.py` |
| Vérifications | `tests/` |

## Travailler à deux

1. Faire un **Pull** avant de commencer.
2. Créer une branche pour chaque grosse évolution.
3. Faire des commits courts avec un message clair.
4. Ouvrir une Pull Request et relire les changements avant de fusionner.
5. Ne jamais committer `.env`, `.venv` ou une clé API.

## Données enregistrées

Sans clé, les écrans historiques utilisent les données enregistrées dans les fichiers
JavaScript. Leur date est affichée dans l'interface afin de ne pas les confondre avec
des données en direct.

Sources indiquées dans le projet : Wikipédia, Foot Mercato, ligue1.com et Starting11.
