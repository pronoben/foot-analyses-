# Worker Cloudflare du chatbot FootAnalyse

Version 1 **gratuite** du chatbot : le site (GitHub Pages) envoie les questions à ce
Worker, qui consulte des sources de données gratuites, compare leurs résultats et
renvoie une réponse vérifiable. Aucune clé n'est visible dans le navigateur.

## Principe

1. comprendre la question (règles déterministes, le texte n'est jamais envoyé à l'IA) ;
2. repérer ce qui manque et le demander (« Combien de buts a João Pedro ? » → joueur
   exact, club, saison, compétition) ;
3. consulter les sources autorisées (cache partagé, quotas) ;
4. comparer les sources ;
5. transmettre **uniquement les faits** à Workers AI ;
6. produire une réponse courte (la phrase de l'IA est rejetée si elle contient un
   nombre absent des faits) ;
7. afficher les sources et la date de vérification.

Le serveur supprime tout fait sans source et, sans aucun fait sourcé, répond :
« Je ne peux pas confirmer cette information avec une source fiable pour le moment.
Je préfère ne pas donner de chiffre plutôt que d'en inventer un. »

## Services gratuits et limites

| Service | Rôle | Limite gratuite | Au-delà |
|---|---|---|---|
| Cloudflare Workers Free | API du chatbot | 100 000 requêtes/jour, 10 ms de CPU par requête | erreur 1027, pas de facturation |
| Workers AI | Reformulation finale (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) | 10 000 neurons/jour ; plafond interne 150 appels/jour | erreur → réponse modèle, pas de facturation |
| Cloudflare D1 | Cache partagé, limites, quotas | 5 M lectures, 100 000 écritures/jour, 5 Go | erreur, pas de facturation |
| Cloudflare Turnstile | Anti-robot | illimité, 20 widgets | — |
| API-Football | Source prioritaire (joueurs, buts, classements) | 100 requêtes/jour ; l'offre gratuite refuse la saison en cours | refus mémorisé 6 h, bascule automatique |
| football-data.org | Classements, matchs, buteurs | 10 requêtes/minute (plafond interne 9) | message « quota atteint » |
| TheSportsDB | 2ᵉ source du classement | 30 requêtes/minute (plafond interne 25), 5 premières places | idem |
| OpenLigaDB | 2ᵉ source Bundesliga | pas de limite publiée (plafond interne 30/min) | idem |
| Wikipédia | Informations générales (courte synthèse + lien) | plafond interne 30/min | idem |
| IFAB | Règles du jeu (Lois du Jeu 2026/27) | lien vers la publication officielle | — |

Durées de cache : scores et prochains matchs 60 s, classement et calendrier 10 min,
statistiques de joueurs 6 h, informations générales 3 jours. En cas de panne d'un
fournisseur, une copie de moins de 48 h est utilisée et sa date est affichée.

## Protections

- CORS limité à `ALLOWED_ORIGINS` (`https://pronoben.github.io` + origines locales) ;
- Turnstile obligatoire (sans clé secrète configurée, le service reste fermé) ;
- 10 questions par heure et par visiteur (adresse IP hachée, jamais stockée en clair),
  2 000 questions par jour pour tout le site ;
- questions de 500 caractères maximum, conversation bornée, corps JSON ≤ 16 Ko ;
- temporisation de 10 minutes après 5 erreurs ;
- demandes de clé, de mot de passe ou d'instructions internes refusées ; filtre final
  qui masque toute valeur ressemblant à une clé.

## Déploiement (tableau de bord Cloudflare, sans ligne de commande)

1. Se connecter sur <https://dash.cloudflare.com> (compte gratuit).
2. **D1** : Storage & Databases → D1 → *Create* → nom `foot-analyses-chat`.
3. **Worker** : Workers & Pages → *Create* → *Start with Hello World* → nom
   `foot-analyses-chat` → *Deploy*, puis *Edit code* : remplacer le contenu par
   `dist/worker.js` (généré par `npm run build`) → *Deploy*.
4. **Liaisons** (Settings → Bindings) : *Workers AI* nommée `AI` ; *D1 database*
   nommée `DB` → `foot-analyses-chat`.
5. **Variables** (Settings → Variables and Secrets), en texte :
   `ALLOWED_ORIGINS`, `QUESTIONS_PER_HOUR`, `QUESTIONS_PER_DAY`, `AI_MODEL`,
   `AI_DAILY_CALLS` (valeurs dans `wrangler.toml`).
6. **Turnstile** : Turnstile → *Add widget* → hostname `pronoben.github.io` → mode
   *Invisible* ou *Managed*. Garder la **clé du site** (publique) pour `config.js`.
7. **Secrets** (type *Secret*, saisis par le propriétaire du compte uniquement) :
   `FOOTBALL_DATA_KEY`, `TURNSTILE_SECRET_KEY`, et facultativement `API_FOOTBALL_KEY`.
8. Dans `config.js` du site : `apiBase` = adresse du Worker
   (`https://foot-analyses-chat.<sous-domaine>.workers.dev`) et `turnstileSiteKey` =
   clé publique du widget.

Avec la ligne de commande (équivalent) : `npm install`, `npx wrangler d1 create
foot-analyses-chat` (copier l'id dans `wrangler.toml`), `npx wrangler secret put
FOOTBALL_DATA_KEY` (etc.), puis `npm run deploy`.

## Tests

```bash
npm test          # 46 tests, sans réseau (fournisseurs simulés)
```

Ils couvrent les 8 scénarios obligatoires : question ambiguë, question complète,
classement actuel, absence de source, sources en désaccord, fournisseur principal
indisponible (source secondaire et cache de secours), quota épuisé, tentative
d'obtenir une clé ; plus Turnstile, CORS, limite horaire, temporisation, cache
partagé et 20 visiteurs simultanés.

Développement local : copier `.dev.vars.example` en `.dev.vars`, puis `npm run dev`
(Worker sur <http://localhost:8787>).
