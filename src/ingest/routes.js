'use strict';

const crypto = require('crypto');
const express = require('express');
const { captureRequest } = require('./captureRequest');
const { parsePayload } = require('./parsePayload');
const { insertEvent } = require('../db');
const { writeLog } = require('../logger');

const router = express.Router();

const bodyLimit = process.env.MAX_BODY_SIZE || '1mb';

// Raw capture applied per-route only — accepts any content type without crashing
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
  const requestId = crypto.randomUUID().split('-')[0];
  const captured = captureRequest(req);
  const { parsed, parseError, diagnosticParsed, diagnosticError, registers } =
    parsePayload(captured.raw_body, captured.content_type);

  const lines = [
    '--- DXM PUSH RECEIVED ---',
    `requestId:     ${requestId}`,
    `timestamp:     ${captured.received_at}`,
    `remoteIp:      ${captured.remote_ip}`,
    `method:        ${captured.method}`,
    `path:          ${captured.path}`,
    `contentType:   ${captured.content_type || '(none)'}`,
    `contentLength: ${req.headers['content-length'] || '(not set)'}`,
    `headers:       ${captured.headers_json}`,
    `rawBody:       ${captured.raw_body || '(empty)'}`,
  ];

  if (parsed !== null) {
    lines.push(`parsedBody:    ${JSON.stringify(parsed)}`);
  } else if (parseError) {
    lines.push('');
    lines.push(`WARNING: DXM payload declared ${captured.content_type || 'unknown'} but failed strict JSON parsing.`);
    lines.push(`requestId:     ${requestId}`);
    lines.push(`parseError:    ${parseError}`);
    lines.push(`rawBody preserved for debugging.`);
    if (diagnosticParsed !== null) {
      lines.push(`diagnosticParsedBody: ${JSON.stringify(diagnosticParsed)}`);
    } else if (diagnosticError) {
      lines.push(`diagnosticParseError: ${diagnosticError}`);
    }
    lines.push('');
  } else {
    lines.push(`parsedBody:    (not parsed — stored as raw text)`);
  }

  if (registers) {
    lines.push('registers:');
    for (const [key, value] of Object.entries(registers)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  lines.push('--- END DXM PUSH ---');
  console.log(lines.join('\n'));

  const record = {
    ...captured,
    parsed_json: parsed !== null ? JSON.stringify(parsed) : null,
    parse_error: parseError || null,
  };

  let dbId;
  try {
    dbId = insertEvent(record);
  } catch (err) {
    console.error('[db] insert failed:', err.message);
  }

  try {
    writeLog({ ...record, db_id: dbId, request_id: requestId });
  } catch (err) {
    console.error('[log] write failed:', err.message);
  }

  res.setHeader('X-DXM-Request-ID', requestId);
  res.status(200).type('text/plain').send('OK');
}

// /dmx/push is a known typo (letters transposed). Returns 200 during testing
// so the gateway does not stall, but logs a clear warning so the misconfiguration
// is immediately obvious.
async function handleTypoPush(req, res) {
  console.warn(
    `\nWARNING: Received ${req.method} on ${req.path}\n` +
    `         HMI Page field should be /dxm/push — check the gateway configuration.\n`
  );
  return handlePush(req, res);
}

// ── /dxm/push ─────────────────────────────────────────────────────────────────

router.get('/dxm/push', (_req, res) => {
  res.status(200).json({
    ok: true,
    endpoint: '/dxm/push',
    methods: ['GET', 'POST'],
    timestamp: new Date().toISOString(),
  });
});

router.post('/dxm/push', rawBody, sharedSecretCheck, handlePush);

// ── /dmx/push — typo alias ────────────────────────────────────────────────────

router.get('/dmx/push', (req, res) => {
  console.warn(
    `\nWARNING: Received GET on ${req.path}\n` +
    `         HMI Page field should be /dxm/push — check the gateway configuration.\n`
  );
  res.status(200).json({
    ok: true,
    endpoint: '/dmx/push',
    warning: 'Typo alias active — configure HMI Page as /dxm/push',
    timestamp: new Date().toISOString(),
  });
});

router.post('/dmx/push', rawBody, sharedSecretCheck, handleTypoPush);

// ── /debug/* — catch-all for experimenting with different Page settings ────────

router.post('/debug/*', rawBody, sharedSecretCheck, handlePush);

module.exports = router;
