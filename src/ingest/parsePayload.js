'use strict';

const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({ ignoreAttributes: false });

/**
 * Best-effort parse of a raw request body.
 *
 * Returns { parsed, parseError }.
 * parsed is a plain object/value, or null if the body could not be parsed
 * or the content type is not recognised.
 * parseError is a string error message, or null on success.
 *
 * TODO: Once real DXM700 "Default" push packet samples are collected,
 * add a dedicated parser here that extracts register values, gateway ID,
 * serial number, and timestamps from the actual packet structure.
 */
function parsePayload(rawBody, contentType) {
  if (!rawBody || rawBody.trim() === '') {
    return { parsed: null, parseError: null };
  }

  // Strip charset and boundary params to get the bare mime type
  const ct = (contentType || '').split(';')[0].trim().toLowerCase();

  let parsed = null;
  let parseError = null;

  try {
    if (ct === 'application/json') {
      parsed = JSON.parse(rawBody);
    } else if (ct === 'application/xml' || ct === 'text/xml') {
      parsed = xmlParser.parse(rawBody);
    } else if (ct === 'application/x-www-form-urlencoded') {
      parsed = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      // Unknown or missing content type — try heuristic detection
      const trimmed = rawBody.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        parsed = JSON.parse(trimmed);
      } else if (trimmed.startsWith('<')) {
        parsed = xmlParser.parse(trimmed);
      }
      // Otherwise leave parsed as null — raw text is still stored
    }
  } catch (err) {
    parseError = err.message;
  }

  return { parsed, parseError };
}

module.exports = { parsePayload };
