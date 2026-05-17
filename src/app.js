'use strict';

require('dotenv').config();

const express = require('express');
const { getEvents, getEvent } = require('./db');
const { renderHome } = require('./views/renderHome');
const { renderEventDetail } = require('./views/renderEventDetail');
const ingestRouter = require('./ingest/routes');
const { parsePayload } = require('./ingest/parsePayload');
const { parseSensorReading } = require('./ingest/parseSensorReading');

const app = express();

// Trust X-Forwarded-For from a local reverse proxy (nginx)
app.set('trust proxy', 'loopback');

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'dxm-push-receiver',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ── DXM ingest & debug routes (raw body parser applied inside the router) ─────

app.use(ingestRouter);

// ── Helpers ───────────────────────────────────────────────────────────────────

function withReading(event) {
  const { parsed, diagnosticParsed } = parsePayload(event.raw_body, event.content_type);
  const payload = parsed ?? diagnosticParsed;
  return { ...event, reading: parseSensorReading(payload) };
}

// ── Web UI ────────────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  const events = getEvents(50).map(withReading);
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8080}`;
  res.type('html').send(renderHome(events, baseUrl));
});

// ── Events API ────────────────────────────────────────────────────────────────

app.get('/events', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  res.json(getEvents(limit));
});

app.get('/events/:id', (req, res) => {
  const event = getEvent(parseInt(req.params.id, 10));
  if (!event) return res.status(404).json({ error: 'Not found' });
  res.json(event);
});

app.get('/events/:id/view', (req, res) => {
  const event = getEvent(parseInt(req.params.id, 10));
  if (!event) return res.status(404).type('html').send('<h1>Event not found</h1><p><a href="/">Back</a></p>');
  const enriched = withReading(event);
  res.type('html').send(renderEventDetail(enriched, enriched.reading));
});

module.exports = app;
