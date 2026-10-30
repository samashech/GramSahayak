const http = require('node:http');

// Tiny HTTP stand-ins for RAG :8000 and Sarvam. handler(req, body) -> {status?, json?, delayMs?}
async function startStub(handler) {
  const calls = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks);
      const call = { method: req.method, url: req.url, headers: req.headers, raw };
      try { call.json = JSON.parse(raw.toString('utf8')); } catch { call.json = null; }
      calls.push(call);
      const out = (await handler(call)) || {};
      if (out.delayMs) await new Promise((r) => setTimeout(r, out.delayMs));
      if (res.destroyed) return;
      res.writeHead(out.status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out.json ?? {}));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
  };
}

// A contract-shaped /rag/query response (contract section 9).
function ragResponse({ answer, matched = null, sms = null, sources = [], mode = 'llm', confidence }) {
  return {
    answer, sources, matched_scheme_id: matched, sms_summary: sms, confidence: confidence ?? (matched ? 0.91 : 0.42), mode, latency_ms: 120,
  };
}

module.exports = { startStub, ragResponse };
