'use strict';

require('dotenv').config();

const app = require('./app');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  console.log('─────────────────────────────────────────');
  console.log('DXM700 Push Receiver started');
  console.log(`  Bind:     ${HOST}:${PORT}`);
  console.log(`  UI:       ${base}/`);
  console.log(`  Health:   ${base}/health`);
  console.log(`  DXM push: GET  ${base}/dxm/push  (alive check)`);
  console.log(`  DXM push: POST ${base}/dxm/push  (receiver) [enabled]`);
  console.log(`  Auth:     ${process.env.DXM_SHARED_SECRET ? 'X-DXM-Secret required' : 'open (no secret set)'}`);
  console.log('─────────────────────────────────────────');
});
