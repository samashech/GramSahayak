const { config } = require('../config');

// HTTP bridge to the Python RAG service (contract section 9).
// R2/R3: RAG is stateless and Node is its only caller.

async function getJson(url, { timeoutMs }) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`RAG ${url} -> HTTP ${res.status}`);
  return res.json();
}

async function health({ timeoutMs = 1500 } = {}) {
  try {
    const body = await getJson(`${config.aiRagUrl}/health`, { timeoutMs });
    return {
      ok: body.status === 'ok',
      vectorCount: Number.isFinite(body.vector_count) ? body.vector_count : null,
      mode: body.mode || null,
    };
  } catch (err) {
    return { ok: false, vectorCount: null, mode: null, error: err.name === 'TimeoutError' ? 'timeout' : err.message };
  }
}

module.exports = { health };
