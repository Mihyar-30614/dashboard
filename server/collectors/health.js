export async function checkHealth(url, { timeoutMs = 5_000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort('timeout'), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: ac.signal });
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - started };
  } catch (err) {
    return { ok: false, error: String(err.message || err), latency_ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}
