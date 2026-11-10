/* Configuration publique du frontend.
   Sur GitHub Pages, remplace apiBase par l'URL HTTPS du backend déployé.
   Ne place jamais de clé API dans ce fichier. */
window.FOOTANALYSE_CONFIG = Object.freeze({
  apiBase: "",
});

window.footApiUrl = path => {
  const base = String(window.FOOTANALYSE_CONFIG.apiBase || "").replace(/\/$/, "");
  return `${base}${path}`;
};

window.footApiFetch = (path, options = {}) => fetch(window.footApiUrl(path), {
  ...options,
  headers: {
    Accept: "application/json",
    ...(options.headers || {}),
  },
});

