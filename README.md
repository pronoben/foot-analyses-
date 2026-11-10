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
- **Coaching** : programme local selon le niveau, le pays, le poste, le pied dominant,
  l'objectif, la durée et le nombre de séances.
- **Assistant** : analyse locale sans clé ; fonctions Claude facultatives via le backend.
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
| Coaching | `training.js` |
| Configuration publique | `config.js` (URL du backend uniquement, jamais de clé) |
| Données des championnats | `data.js`, `leagues.js`, fichiers de championnat |
| Assistant local et interface | `chatbot.js`, `chat-local.js`, `chat-players.js` |
| Backend web | `server.py` |
| Serveur MCP | `mcp_server.py` |
| IA Claude | `chatbot_ai.py`, `lineups_ai.py` |
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
