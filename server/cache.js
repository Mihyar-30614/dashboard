export class Cache {
  constructor({ max = 500 } = {}) {
    this.max = max;
    this.map = new Map();
  }

  set(key, value, ttlMs) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, until: Date.now() + ttlMs });
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  get(key) {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.until < Date.now()) { this.map.delete(key); return undefined; }
    return e.value;
  }

  size() { return this.map.size; }
}

export const metricsCache = new Cache({ max: 1000 });
