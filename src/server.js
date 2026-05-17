'use strict';

require('dotenv').config();

const app = require('./app');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  const publicHost = base.replace(/^https?:\/\//, '').replace(/:\d+$/, '');

  console.log('─────────────────────────────────────────────────');
  console.log('DXM700 Push Receiver started');
  console.log(`  Bind: ${HOST}:${PORT}`);
  console.log('');
  console.log('DXM receiver enabled:');
  console.log(`  GET  /dxm/push   alive check`);
  console.log(`  POST /dxm/push   receiver`);
  console.log(`  GET  /dmx/push   temporary typo alias (logs warning)`);
  console.log(`  POST /dmx/push   temporary typo alias (logs warning)`);
  console.log('');
  console.log('Banner HMI settings:');
  console.log('  Use HTTPS:      No');
  console.log(`  Server Name/IP: ${publicHost}`);
  console.log(`  Push Port:      ${PORT}`);
  console.log('  Page:           /dxm/push');
  console.log('  Push Format:    JSON');
  console.log('');
  console.log('Example local tests:');
  console.log(`  curl -i http://127.0.0.1:${PORT}/dxm/push`);
  console.log(`  curl -i -X POST http://127.0.0.1:${PORT}/dxm/push -H "Content-Type: application/json" -d '{"test":true}'`);
  console.log('');
  console.log(`  Auth: ${process.env.DXM_SHARED_SECRET ? 'X-DXM-Secret required' : 'open (no secret set)'}`);
  console.log('─────────────────────────────────────────────────');
});
