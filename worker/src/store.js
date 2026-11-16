// Stockage partagé entre tous les visiteurs : cache, compteurs (limites et
// quotas). Production : Cloudflare D1 (gratuit, cohérent). Tests : mémoire.

const nowSec = () => Math.floor(Date.now() / 1000);

export class MemoryStore {
  constructor() {
    this.cache = new Map();
    this.counters = new Map();
  }

  async get(key) {
    return this.cache.get(key) || null;
  }

  async put(key, value, ttlSec) {
    const storedAt = nowSec();
    this.cache.set(key, { value, storedAt, expiresAt: storedAt + ttlSec });
  }

  async hit(bucket, limit, windowSec, increment = true) {
    const window = Math.floor(nowSec() / windowSec);
    const key = `${bucket}:${window}`;
    const count = (this.counters.get(key) || 0) + (increment ? 1 : 0);
    if (increment) this.counters.set(key, count);
    const retryAfter = (window + 1) * windowSec - nowSec();
    return { allowed: count <= limit, count, retryAfter };
  }
}

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, stored_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at INTEGER NOT NULL)",
];

export class D1Store {
  constructor(db) {
    this.db = db;
    this.ready = null;
  }

  init() {
    if (!this.ready) {
      this.ready = this.db.batch(SCHEMA.map(sql => this.db.prepare(sql))).catch(err => {
        this.ready = null;
        throw err;
      });
    }
    return this.ready;
  }

  async get(key) {
    await this.init();
    const row = await this.db.prepare("SELECT v, stored_at, expires_at FROM cache WHERE k = ?").bind(key).first();
    if (!row) return null;
    return { value: JSON.parse(row.v), storedAt: row.stored_at, expiresAt: row.expires_at };
  }

  async put(key, value, ttlSec) {
    await this.init();
    const storedAt = nowSec();
    const text = JSON.stringify(value);
    if (text.length > 900_000) return; // ne stocke pas de valeurs démesurées
    await this.db
      .prepare("INSERT INTO cache (k, v, stored_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, stored_at = excluded.stored_at, expires_at = excluded.expires_at")
      .bind(key, text, storedAt, storedAt + ttlSec)
      .run();
    // Nettoyage occasionnel des entrées très anciennes (garde 2 jours de secours).
    if (Math.random() < 0.02) {
      await this.db.prepare("DELETE FROM cache WHERE expires_at < ?").bind(storedAt - 172800).run();
      await this.db.prepare("DELETE FROM counters WHERE reset_at < ?").bind(storedAt).run();
    }
  }

  async hit(bucket, limit, windowSec, increment = true) {
    await this.init();
    const now = nowSec();
    const window = Math.floor(now / windowSec);
    const key = `${bucket}:${window}`;
    const resetAt = (window + 1) * windowSec;
    let count;
    if (increment) {
      const row = await this.db
        .prepare("INSERT INTO counters (k, n, reset_at) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n")
        .bind(key, resetAt)
        .first();
      count = row ? row.n : 1;
    } else {
      const row = await this.db.prepare("SELECT n FROM counters WHERE k = ?").bind(key).first();
      count = row ? row.n : 0;
    }
    return { allowed: count <= limit, count, retryAfter: resetAt - now };
  }
}
