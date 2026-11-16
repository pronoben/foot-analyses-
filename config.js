/* Configuration publique du frontend.
   apiBase : adresse HTTPS du Worker Cloudflare du chatbot.
   turnstileSiteKey : clé PUBLIQUE du widget Turnstile (la clé secrète reste
   uniquement dans Cloudflare). Ne place jamais de clé secrète dans ce fichier. */
window.FOOTANALYSE_CONFIG = Object.freeze({
  apiBase: "",
  turnstileSiteKey: "",
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

