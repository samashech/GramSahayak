const { config } = require('./config');
const { createApp } = require('./app');
const dbAdapter = require('./adapters/dbAdapter');

async function main() {
  await dbAdapter.init();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[gramsahayak] gateway on :${config.port} (${config.appEnv})`);
    console.log(`[gramsahayak] db=${dbAdapter.activeDriver()} rag=${config.aiRagUrl} mockAi=${config.useMockAi} demo=${config.demoMode}`);
    console.log(`[gramsahayak] CORS origins: ${config.frontendOrigins.join(', ')}`);
  });

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
