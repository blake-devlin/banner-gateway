'use strict';

const express = require('express');
const { captureRequest } = require('./captureRequest');
const { parsePayload } = require('./parsePayload');
const { insertEvent } = require('../db');
const { writeLog } = require('../logger');

const router = express.Router();

// Configurable body size limit — default 1 MB
const bodyLimit = process.env.MAX_BODY_SIZE || '1mb';

// Apply raw capture on ingest routes only; type '*/*' accepts any content type
const rawBody = express.raw({ type: '*/*', limit: bodyLimit });

function sharedSecretCheck(req, res, next) {
  const secret = process.env.DXM_SHARED_SECRET;
  if (!secret) return next();
  if (req.headers['x-dxm-secret'] !== secret) {
    console.warn(`[auth] rejected push from ${req.ip} — bad or missing X-DXM-Secret`);
    return res.status(403).type('text/plain').send('Forbidden');
  }
  next();
}

async function handlePush(req, res) {
  const captured = captureRequest(req);
  const { parsed, parseError } = parsePayload(captured.raw_body, captured.content_type);

  const record = {
    ...captured,
    parsed_json: parsed !== null ? JSON.stringify(parsed) : null,
    parse_error: parseError || null,
  };

  let dbId;
  try {
    dbId = insertEvent(record);
  } catch (err) {
    // Do not let a DB failure return an error to the gateway
    console.error('[db] insert failed:', err.message);
  }

  try {
    writeLog({ ...record, db_id: dbId });
  } catch (err) {
    console.error('[log] write failed:', err.message);
  }

  console.log(
    `[push] id=${dbId} ip=${captured.remote_ip} ct="${captured.content_type}" bytes=${captured.raw_body.length} path=${captured.path}`
  );

  // Minimal response — embedded gateways expect a simple 200
  res.status(200).type('text/plain').send('OK');
}

router.post('/dxm/push', rawBody, sharedSecretCheck, handlePush);

// Catch-all debug route — same capture pipeline, useful when experimenting
// with different Page settings on the gateway
router.post('/debug/*', rawBody, sharedSecretCheck, handlePush);

module.exports = router;
