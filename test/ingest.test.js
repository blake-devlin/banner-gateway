'use strict';

// Set env before any app modules are loaded
process.env.DB_PATH = ':memory:';
process.env.LOG_DIR = './logs';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../src/app');
const { closeDb } = require('../src/db');

after(() => closeDb());

describe('POST /dxm/push', () => {
  it('accepts a JSON payload and returns 200 OK', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ gateway: 'DXM700', register: 'AI1', value: 123 }));

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('accepts an XML payload without crashing', async () => {
    const xml = '<push><gateway>DXM700</gateway><value>123</value></push>';
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'text/xml')
      .send(xml);

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });

  it('accepts application/xml without crashing', async () => {
    const xml = '<?xml version="1.0"?><data><v>1</v></data>';
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/xml')
      .send(xml);

    assert.equal(res.status, 200);
  });

  it('accepts plain text without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'text/plain')
      .send('plain text payload from gateway');

    assert.equal(res.status, 200);
  });

  it('accepts form-encoded data without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('gateway=DXM700&value=42');

    assert.equal(res.status, 200);
  });

  it('accepts an unknown content type without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/octet-stream')
      .send('binary-ish data');

    assert.equal(res.status, 200);
  });

  it('accepts a missing content type without crashing', async () => {
    const res = await supertest(app)
      .post('/dxm/push')
      .send('no content type header');

    assert.equal(res.status, 200);
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
    assert.ok(latest.body_preview.includes('body-storage-check'),
      'raw body should be stored and appear in body_preview');
  });
});

describe('POST /debug/*', () => {
  it('accepts debug route pushes and returns 200', async () => {
    const res = await supertest(app)
      .post('/debug/test-path')
      .set('Content-Type', 'text/plain')
      .send('debug route test');

    assert.equal(res.status, 200);
    assert.equal(res.text, 'OK');
  });
});

describe('GET /events', () => {
  it('returns an array of captured events', async () => {
    await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'text/plain')
      .send('event-list-test-payload');

    const res = await supertest(app).get('/events');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body), 'should return an array');
    assert.ok(res.body.length >= 1, 'should have at least one event');
  });

  it('GET /events/:id returns full event record', async () => {
    const eventsRes = await supertest(app).get('/events');
    const id = eventsRes.body[0].id;

    const res = await supertest(app).get(`/events/${id}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.id === id);
    assert.ok('raw_body' in res.body, 'detail record should include raw_body');
    assert.ok('headers_json' in res.body, 'detail record should include headers_json');
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
