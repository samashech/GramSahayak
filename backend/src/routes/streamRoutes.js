const { Router } = require('express');
const eventBus = require('../services/eventBus');

// B-08: GET /api/stream/events (SSE) -> data:{type, step?, ms?, channel, phone?, digit?, text?, ts}
// Contract section 6: unnamed `data:` events carrying `type` (pipeline | dtmf | transcript | sms | hello),
// so EventSource.onmessage receives all of them; heartbeat comment every 15 s.
const HEARTBEAT_MS = 15000;
const router = Router();

let clients = 0;

router.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // no proxy buffering (cloudflared / nginx)
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');

  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  send({ type: 'hello', channel: 'web', clients: ++clients, ts: new Date().toISOString() });

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_MS);
  eventBus.bus.on('event', send);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.bus.off('event', send);
    clients -= 1;
  });
});

module.exports = router;
