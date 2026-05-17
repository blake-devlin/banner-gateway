'use strict';

// Set env before any app modules are loaded
process.env.DB_PATH = ':memory:';
process.env.LOG_DIR = './logs';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await supertest(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'dxm-push-receiver');
    assert.ok(typeof res.body.uptime === 'number');
    assert.ok(typeof res.body.timestamp === 'string');
  });
});

describe('GET /', () => {
  it('returns 200 HTML home page when no events exist', async () => {
    const res = await supertest(app).get('/');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.text.includes('DXM700 Vibration Monitor'));
    assert.ok(res.text.includes('/dxm/push'));
  });

  it('returns 200 HTML home page when events exist', async () => {
    await supertest(app)
      .post('/dxm/push')
      .set('Content-Type', 'application/json')
      .send('{"gateway":"DXM700","value":1}');

    const res = await supertest(app).get('/');
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('DXM700'));
  });
});
