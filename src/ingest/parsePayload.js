'use strict';

const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({ ignoreAttributes: false });

/**
 * Relaxed JSON parser for diagnostic use only.
 *
 * Handles two known Banner DXM firmware defects:
 *   1. Trailing commas before } or ]  e.g. "reg0": -1,  }
 *   2. One extra } appended after the closing brace of a valid JSON object
 *
 * Never call this on the strict path — it is only used AFTER strict JSON.parse
 * fails, so the caller always knows the original payload was not valid JSON.
 *
 * TODO: Update this function once more DXM firmware versions are observed.
 */
function relaxedJsonParse(str) {
  // Step 1: strip trailing commas before } or ]
  let cleaned = str.replace(/,(\s*[}\]])/g, '$1').trim();

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // Step 2: if there is content after otherwise-valid JSON (extra trailing }),
    // remove one trailing character and retry once
    if (
      (firstErr.message.includes('Unexpected non-whitespace') ||
        firstErr.message.includes('Unexpected token')) &&
      (cleaned.endsWith('}') || cleaned.endsWith(']'))
    ) {
      try {
        return JSON.parse(cleaned.slice(0, -1).trimEnd());
      } catch (secondErr) {
        throw secondErr;
      }
    }
    throw firstErr;
  }
}

/**
 * Extract register values from the AWS IoT Device Shadow format the DXM uses:
 *   { "state": { "reported": { "reg0": -1, "reg1": 42 } } }
 * Returns the contents of state.reported, or null if not present.
 */
function extractRegisters(obj) {
  try {
    const reported = obj?.state?.reported;
    if (reported && typeof reported === 'object' && !Array.isArray(reported)) {
      return reported;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Parse a raw request body.
 *
 * Returns:
 *   parsed          — strict parse result; null if strict parse failed
 *   parseError      — strict parse error message; null on success
 *   diagnosticParsed — relaxed parse result (only populated when strict failed)
 *   diagnosticError  — relaxed parse error; null if relaxed parse succeeded
 *   registers        — { reg0: ..., reg1: ... } from state.reported, or null
 *
 * The diagnosticParsed value must be treated as diagnostic only.
 * Do not use it for production logic without explicit labeling.
 *
 * TODO: Once real DXM700 sample payloads are collected across firmware versions,
 * add a dedicated parser for the "Default" push packet format.
 */
function parsePayload(rawBody, contentType) {
  const empty = { parsed: null, parseError: null, diagnosticParsed: null, diagnosticError: null, registers: null };

  if (!rawBody || rawBody.trim() === '') return empty;

  const ct = (contentType || '').split(';')[0].trim().toLowerCase();

  let parsed = null;
  let parseError = null;
  let diagnosticParsed = null;
  let diagnosticError = null;

  // ── Strict parse ────────────────────────────────────────────────────────────
  try {
    if (ct === 'application/json') {
      parsed = JSON.parse(rawBody); // strict — no preprocessing
    } else if (ct === 'application/xml' || ct === 'text/xml') {
      parsed = xmlParser.parse(rawBody);
    } else if (ct === 'application/x-www-form-urlencoded') {
      parsed = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      // Unknown / missing content type — best-effort heuristic
      const trimmed = rawBody.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        parsed = relaxedJsonParse(trimmed); // already "best effort" with no declared type
      } else if (trimmed.startsWith('<')) {
        parsed = xmlParser.parse(trimmed);
      }
    }
  } catch (err) {
    parseError = err.message;
  }

  // ── Diagnostic relaxed fallback (JSON only, only when strict fails) ─────────
  if (parseError && ct === 'application/json') {
    try {
      diagnosticParsed = relaxedJsonParse(rawBody);
    } catch (err) {
      diagnosticError = err.message;
    }
  }

  // ── Register extraction ─────────────────────────────────────────────────────
  const registers = extractRegisters(parsed ?? diagnosticParsed);

  return { parsed, parseError, diagnosticParsed, diagnosticError, registers };
}

module.exports = { parsePayload };
