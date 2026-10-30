const { EventEmitter } = require('node:events');

// In-process bus for live telemetry. GET /api/stream/events (B-08) relays every 'event' as SSE.
// Event shape (contract section 6): {type, step?, ms?, channel, phone?, digit?, text?, ts}
const bus = new EventEmitter();
bus.setMaxListeners(100);

function emit(type, fields = {}) {
  const event = { type, ...fields, ts: new Date().toISOString() };
  bus.emit('event', event);
  return event;
}

const pipeline = (step, ms, fields = {}) => emit('pipeline', { step, ms: Math.round(ms), ...fields });

module.exports = { bus, emit, pipeline };
