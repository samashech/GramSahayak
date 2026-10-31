const { config } = require('./config');
const { createApp } = require('./app');
const dbAdapter = require('./adapters/dbAdapter');
const seedService = require('./services/seedService');
const voicePipeline = require('./services/voicePipeline');
const msg = require('./config/messages');

async function main() {
  await dbAdapter.init();
  await seedService.init();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[gramsahayak] gateway on :${config.port} (${config.appEnv})`);
    console.log(`[gramsahayak] db=${dbAdapter.activeDriver()} rag=${config.aiRagUrl} mockAi=${config.useMockAi} demo=${config.demoMode}`);
    console.log(`[gramsahayak] CORS origins: ${config.frontendOrigins.join(', ')}`);
  });

  // Sarvam warm-up: render the fixed IVR prompts once so the first call plays instantly (background).
  const prompts = [msg.IVR.greetingParts];
  for (const lang of ['hi-IN', 'mr-IN', 'ta-IN']) {
    for (const t of [msg.IVR.categoryMenu, msg.IVR.speak, msg.IVR.goodbye]) prompts.push({ lang, text: t[lang] });
  }
  const t0 = Date.now();
  voicePipeline.prewarm(prompts)
    .then((n) => n && console.log(`[voice] ${n} IVR prompts pre-rendered by Sarvam in ${Date.now() - t0} ms`))
    .catch((err) => console.warn('[voice] prewarm failed:', err.message));

  const shutdown = async (signal) => {
    console.log(`[gramsahayak] ${signal}, shutting down`);
    server.close();
    await dbAdapter.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[gramsahayak] failed to start:', err);
  process.exit(1);
});
