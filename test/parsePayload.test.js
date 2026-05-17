'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parsePayload } = require('../src/ingest/parsePayload');

// Real DXM700 firmware payload characteristics:
//   - CRLF line endings
//   - Trailing comma after last property value
//   - One extra } after the closing brace of the valid JSON object
const DXM_REAL_PAYLOAD =
  '{\r\n  "state": {\r\n    "reported": {\r\n      "reg0": -1,\r\n    }\r\n  }\r\n}\r\n}';

// ── Strict JSON parse ─────────────────────────────────────────────────────────

describe('parsePayload — strict JSON (application/json)', () => {
  it('parses valid strict JSON successfully', () => {
    const { parsed, parseError, diagnosticParsed } = parsePayload(
      '{"state":{"reported":{"reg0":42}}}',
      'application/json'
    );
    assert.deepEqual(parsed, { state: { reported: { reg0: 42 } } });
    assert.equal(parseError, null);
    assert.equal(diagnosticParsed, null, 'no diagnostic parse needed when strict succeeds');
  });

  it('fails strict parse for DXM real payload (trailing comma + extra brace)', () => {
    const { parsed, parseError } = parsePayload(DXM_REAL_PAYLOAD, 'application/json');
    assert.equal(parsed, null, 'strict parse should fail for malformed DXM payload');
    assert.ok(parseError, 'parseError should be set');
  });

  it('fails strict parse for trailing-comma-only JSON', () => {
    const { parsed, parseError } = parsePayload('{"a":1,}', 'application/json');
    assert.equal(parsed, null);
    assert.ok(parseError);
  });

  it('fails strict parse for truly invalid JSON', () => {
    const { parsed, parseError } = parsePayload('{ not json at all !!!', 'application/json');
    assert.equal(parsed, null);
    assert.ok(parseError);
  });
});

// ── Diagnostic relaxed parse ──────────────────────────────────────────────────

describe('parsePayload — diagnostic relaxed parse fallback', () => {
  it('produces diagnosticParsed for real DXM payload', () => {
    const { diagnosticParsed, diagnosticError } = parsePayload(DXM_REAL_PAYLOAD, 'application/json');
    assert.ok(diagnosticParsed, 'should have diagnostic result');
    assert.equal(diagnosticError, null);
    assert.equal(diagnosticParsed?.state?.reported?.reg0, -1);
  });

  it('produces diagnosticParsed for trailing-comma-only JSON', () => {
    const { diagnosticParsed } = parsePayload(
      '{"state":{"reported":{"reg0":-1,}}}',
      'application/json'
    );
    assert.ok(diagnosticParsed);
    assert.equal(diagnosticParsed?.state?.reported?.reg0, -1);
  });

  it('returns null diagnosticParsed for truly invalid JSON', () => {
    const { diagnosticParsed, diagnosticError } = parsePayload(
      '{ not json at all !!!',
      'application/json'
    );
    assert.equal(diagnosticParsed, null);
    assert.ok(diagnosticError, 'should report why relaxed parse also failed');
  });

  it('does not attempt diagnostic parse when strict parse succeeds', () => {
    const { diagnosticParsed } = parsePayload('{"a":1}', 'application/json');
    assert.equal(diagnosticParsed, null);
  });
});

// ── Register extraction ───────────────────────────────────────────────────────

describe('parsePayload — register extraction from state.reported', () => {
  it('extracts registers from strictly-parsed valid JSON', () => {
    const { registers } = parsePayload(
      '{"state":{"reported":{"reg0":42,"reg1":99}}}',
      'application/json'
    );
    assert.deepEqual(registers, { reg0: 42, reg1: 99 });
  });

  it('extracts registers from diagnosticParsed when strict parse fails', () => {
    const { registers } = parsePayload(DXM_REAL_PAYLOAD, 'application/json');
    assert.ok(registers, 'should extract registers even when strict parse fails');
    assert.equal(registers?.reg0, -1);
  });

  it('returns null registers when state.reported is absent', () => {
    const { registers } = parsePayload('{"foo":"bar"}', 'application/json');
    assert.equal(registers, null);
  });

  it('returns null registers for empty body', () => {
    const { registers } = parsePayload('', 'application/json');
    assert.equal(registers, null);
  });
});

// ── Other content types are unaffected ───────────────────────────────────────

describe('parsePayload — non-JSON content types', () => {
  it('parses XML with text/xml', () => {
    const { parsed, parseError } = parsePayload(
      '<push><reg0>42</reg0></push>',
      'text/xml'
    );
    assert.ok(parsed);
    assert.equal(parseError, null);
  });

  it('parses form-encoded data', () => {
    const { parsed } = parsePayload('reg0=42&reg1=99', 'application/x-www-form-urlencoded');
    assert.deepEqual(parsed, { reg0: '42', reg1: '99' });
  });

  it('handles empty body gracefully', () => {
    const result = parsePayload('', 'application/json');
    assert.equal(result.parsed, null);
    assert.equal(result.parseError, null);
    assert.equal(result.diagnosticParsed, null);
    assert.equal(result.registers, null);
  });
});
