const app = require('./app');
const env = require('./config/env');

// Boot the Profirmo HTTP server.
app.listen(env.port, () => {
  console.log('========================================');
  console.log('  Profirmo API');
  console.log(`  Mode:    ${env.nodeEnv}`);
  console.log(`  Port:    ${env.port}`);
  console.log(`  Health:  http://localhost:${env.port}/api/health`);
  console.log('========================================');
});
