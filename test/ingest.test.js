'use strict';

process.env.DB_PATH = ':memory:';
process.env.LOG_DIR = './logs';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../src/app');
const { closeDb } = require('../src/db');

after(() => closeDb());

// ── GET /dxm/push ─────────────────────────────────────────────────────────────

describe('GET /dxm/push', () => {
  it('returns 200 alive check', async () => {
    const res = await supertest(app).get('/dxm/push');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.endpoint, '/dxm/push');
    assert.ok(typeof res.body.timestamp === 'string');
  });

  it('is not blocked by auth or catch-all middleware', async () => {
    // GET with no headers, no auth — must return 200
    const res = await supertest(app).get('/dxm/push');
    assert.equal(res.status, 200);
  });
});

// ── POST /dxm/push ────────────────────────────────────────────────────────────

describe('POST /dxm/push', () => {
  it('accepts JSON and returns 200 OK text/plain', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ gateway: 'DXM700', register: 'AI1', value: 123 }));

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
    assert.ok(res.headers['x-dxm-request-id'], 'should include X-DXM-Request-ID header');
  });

  it('parses Banner DXM JSON with trailing commas (real firmware quirk)', async () => {
    // The Banner DXM firmware sends trailing commas after the last value and
    // uses \r\n line endings (CRLF). The trailing comma is invalid standard JSON.
    // Note: the terminal may render the \r\n body with apparent extra braces — the
    // actual payload has matched open/close braces; only the comma is the problem.
    const dxmPayload = '{\r\n  "state": {\r\n    "reported": {\r\n"reg0": -1,\r\n    }\r\n  }\r\n}';
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/json')
      .send(dxmPayload);

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');

    // Verify parsed body was stored (not a parse error)
    const eventsRes = await supertest(app).get('/events');
    const latest = eventsRes.body[0];
    const detail = await supertest(app).get(`/events/${latest.id}`);
    assert.ok(detail.body.parsed_json, 'DXM trailing-comma JSON should parse successfully');
    assert.equal(detail.body.parse_error, null, 'should have no parse error');
  });

  it('does not crash on truly malformed JSON — still returns 200 OK', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/json')
      .send('{ this is not valid json !!!');

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('accepts text/xml without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'text/xml')
      .send('<push><gateway>DXM700</gateway><value>123</value></push>');

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('accepts application/xml without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/xml')
      .send('<?xml version="1.0"?><data><v>1</v></data>');

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('accepts text/plain without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'text/plain')
      .send('plain text payload from gateway');

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('accepts application/x-www-form-urlencoded without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('gateway=DXM700&value=42');

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('accepts unknown content type without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/octet-stream')
      .send('binary-ish data');

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('accepts missing content type without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .send('no content type header');

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('stores the raw body in the database', async () => {
    const payload = '<test><raw>body-storage-check</raw></test>';
    await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'text/xml')
      .send(payload);

    const eventsRes = await supertest(app).get('/events');
    assert.equal(eventsRes.status, 200);
    const latest = eventsRes.body[0];
    assert.ok(
      latest.body_preview.includes('body-storage-check'),
      'raw body should be stored and appear in body_preview'
    );
  });
});

// ── /dmx/push — typo alias ────────────────────────────────────────────────────

describe('GET /dmx/push (typo alias)', () => {
  it('returns 200 with a typo warning in the response body', async () => {
    const res = await supertest(app).get('/dmx/push');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(
      res.body.warning && res.body.warning.includes('/dxm/push'),
      'response should warn about the correct path'
    );
  });
});

describe('POST /dmx/push (typo alias)', () => {
  it('returns 200 OK so the gateway does not stall', async () => {
    const res = await supertest(app)
      .post('/dmx/push')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ test: true }));

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('still includes X-DXM-Request-ID header on typo path', async () => {
    const res = await supertest(app)
      .post('/dmx/push')
      .set('Content-Type', 'text/plain')
      .send('typo path test');

    assert.equal(res.status, 200);
    assert.ok(res.headers['x-dxm-request-id'], 'should include correlation ID even on typo path');
  });
});

// ── /debug/* ──────────────────────────────────────────────────────────────────

describe('POST /debug/*', () => {
  it('accepts debug route pushes and returns 200 OK', async () => {
    const res = await supertest(app)
      .post('/debug/test-path')
      .set('Content-Type', 'text/plain')
      .send('debug route test');

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });
});

// ── Events API ────────────────────────────────────────────────────────────────

describe('GET /events', () => {
  it('returns an array of captured events', async () => {
    await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'text/plain')
      .send('event-list-test-payload');

    const res = await supertest(app).get('/events');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
  });

  it('GET /events/:id returns full event record', async () => {
    const eventsRes = await supertest(app).get('/events');
    const id = eventsRes.body[0].id;

    const res = await supertest(app).get(`/events/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, id);
    assert.ok('raw_body' in res.body);
    assert.ok('headers_json' in res.body);
  });

  it('GET /events/:id/view returns HTML', async () => {
    const eventsRes = await supertest(app).get('/events');
    const id = eventsRes.body[0].id;

    const res = await supertest(app).get(`/events/${id}/view`);
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.text.includes('Push Event'));
  });

  it('GET /events/:id returns 404 for unknown id', async () => {
    const res = await supertest(app).get('/events/9999999');
    assert.equal(res.status, 404);
  });
});
