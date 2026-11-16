# Sécurité de FootAnalyse

## Signaler une faille

Merci de ne pas publier de faille dans une issue publique. Utilise l'onglet
**Security → Report a vulnerability** du dépôt GitHub (signalement privé) et décris :
la page ou la route concernée, les étapes pour reproduire et l'impact possible.

## Mesures en place

**Site (GitHub Pages)**
- Politique de sécurité du contenu (CSP) : seuls les scripts du site s'exécutent,
  aucun script externe ni code en ligne.
- Tout texte venant d'une API ou de l'IA est échappé avant affichage ; seuls les
  liens HTTPS sont cliquables, ouverts avec `noopener noreferrer`.
- Les statistiques reçues du serveur sont converties en nombres avant affichage.
- Aucune clé ni secret dans le code du navigateur.

**Serveur (`server.py`)**
- Liste blanche des fichiers servis, appliquée à `GET` et `HEAD` : le code, `.env`,
  `.git` et `tests/` ne sont jamais exposés.
- En-têtes de sécurité : CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS derrière HTTPS.
- Version du serveur masquée, connexions lentes coupées après 20 secondes.
- CORS limité à `ALLOWED_ORIGINS`, en-tête `Origin` obligatoire pour les routes IA.
- Limites de requêtes par visiteur, plafond global de dépense IA, appels simultanés
  limités, validation stricte des messages et des demandes de compositions.
- Erreurs renvoyées en JSON générique, détails techniques uniquement dans les journaux.

**Dépôt**
- `.env` ignoré par Git ; clés uniquement dans les variables d'environnement de l'hébergeur.
- Tests automatiques à chaque modification (`.github/workflows/tests.yml`).
- Mises à jour des dépendances proposées par Dependabot.

## Bonnes pratiques pour l'équipe

- Activer la double authentification (2FA) sur GitHub, Render et la console Anthropic.
- Ne jamais coller une clé dans le code, une issue ou un message : si cela arrive,
  la révoquer immédiatement et en créer une nouvelle.
- Passer par une demande de fusion (pull request) et attendre que les tests soient verts.
