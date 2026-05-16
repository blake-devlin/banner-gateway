'use strict';

require('dotenv').config();

const app = require('./app');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  console.log(`DXM700 Push Receiver listening on ${HOST}:${PORT}`);
  console.log(`  UI:     ${base}/`);
  console.log(`  Health: ${base}/health`);
  console.log(`  Push:   POST ${base}/dxm/push`);
});
