'use strict';

const { escHtml } = require('./escHtml');
const { TEMP_WARN_F, VEL_WARN_MM_S } = require('../ingest/parseSensorReading');

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
      hour12: true, timeZoneName: 'short',
    });
  } catch { return iso; }
}

function fmtNum(val, digits) {
  return (val !== null && val !== undefined) ? Number(val).toFixed(digits) : null;
}

function renderSensorSummary(reading) {
  if (!reading) return '';
  const r = reading;
  const hasSensor = r.temp_f !== null || r.x_vel_mm_s !== null;
  if (!hasSensor && !r.gateway_id) return '';

  const warn = (val, thresh) =>
    (val !== null && val !== undefined && val > thresh) ? ' style="color:#f59e0b;font-weight:600"' : '';

  const row = (label, val, unit, warnAttr = '') =>
    val !== null && val !== undefined
      ? `<tr><th>${escHtml(label)}</th><td${warnAttr}>${escHtml(String(val))} ${escHtml(unit)}</td></tr>`
      : `<tr><th>${escHtml(label)}</th><td style="color:#888">—</td></tr>`;

  return `
  <h2>Sensor Reading</h2>
  <table>
    <tr><th>Gateway ID</th><td>${escHtml(r.gateway_id || '—')}</td></tr>
    <tr><th>Gateway Time</th><td>${escHtml(r.gateway_time_display || r.gateway_time_raw || '—')}</td></tr>
    ${row('Temperature', fmtNum(r.temp_f, 2), '°F', warn(r.temp_f, TEMP_WARN_F))}
    ${row('Temperature', fmtNum(r.temp_c, 2), '°C')}
    ${row('X Velocity', fmtNum(r.x_vel_mm_s, 4), 'mm/s', warn(r.x_vel_mm_s, VEL_WARN_MM_S))}
    ${row('Y Velocity', fmtNum(r.y_vel_mm_s, 4), 'mm/s', warn(r.y_vel_mm_s, VEL_WARN_MM_S))}
    ${row('Z Velocity', fmtNum(r.z_vel_mm_s, 4), 'mm/s', warn(r.z_vel_mm_s, VEL_WARN_MM_S))}
    ${row('HFE Acceleration', fmtNum(r.hfe_accel, 4), 'G')}
  </table>`;
}

function renderEventDetail(event, reading) {
  let headersRows = '';
  try {
    const headers = JSON.parse(event.headers_json || '{}');
    headersRows = Object.entries(headers)
      .map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(String(v))}</td></tr>`)
      .join('');
  } catch {
    headersRows = `<tr><td colspan="2">${escHtml(event.headers_json || '')}</td></tr>`;
  }

  let parsedSection = '';
  if (event.parsed_json) {
    let pretty = event.parsed_json;
    try { pretty = JSON.stringify(JSON.parse(event.parsed_json), null, 2); } catch { /* leave as-is */ }
    parsedSection = `
      <h2>Parsed Body</h2>
      <pre>${escHtml(pretty)}</pre>`;
  }

  let querySection = '';
  if (event.query_json && event.query_json !== '{}') {
    let pretty = event.query_json;
    try { pretty = JSON.stringify(JSON.parse(event.query_json), null, 2); } catch { /* leave as-is */ }
    querySection = `
      <h2>Query Parameters</h2>
      <pre>${escHtml(pretty)}</pre>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Event #${escHtml(String(event.id))} &mdash; DXM700 Vibration Monitor</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #222;
    }
    a { color: #2563eb; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
    th, td { border: 1px solid #d1d5db; padding: 7px 12px; text-align: left; font-size: 0.875rem; }
    th { background: #f3f4f6; font-weight: 600; width: 180px; }
    pre {
      background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px;
      padding: 1rem; overflow-x: auto;
      font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.825rem;
      white-space: pre-wrap; word-break: break-all;
    }
    h2 { margin-top: 2rem; font-size: 1.1rem; }
    .back { margin-bottom: 1.25rem; display: block; }
    .parse-error { color: #dc2626; font-size: 0.85rem; }
  </style>
</head>
<body>
  <a class="back" href="/">&larr; Back to dashboard</a>
  <h1>Push Event #${escHtml(String(event.id))}</h1>

  ${renderSensorSummary(reading)}

  <h2>Summary</h2>
  <table>
    <tr><th>Received At</th><td>${escHtml(fmtTime(event.received_at))}</td></tr>
    <tr><th>Remote IP</th><td>${escHtml(event.remote_ip || '—')}</td></tr>
    <tr><th>Method</th><td>${escHtml(event.method)}</td></tr>
    <tr><th>Path</th><td>${escHtml(event.path)}</td></tr>
    <tr><th>Content-Type</th><td>${escHtml(event.content_type || '(none)')}</td></tr>
    ${event.parse_error ? `<tr><th>Parse Error</th><td class="parse-error">${escHtml(event.parse_error)}</td></tr>` : ''}
  </table>

  <h2>HTTP Headers</h2>
  <table>
    <thead><tr><th>Header</th><th>Value</th></tr></thead>
    <tbody>${headersRows}</tbody>
  </table>

  <h2>Raw Body</h2>
  <pre>${escHtml(event.raw_body || '(empty)')}</pre>

  ${parsedSection}
  ${querySection}

  <p style="margin-top:2rem">
    <a href="/events/${escHtml(String(event.id))}">JSON record</a>
  </p>
</body>
</html>`;
}

module.exports = { renderEventDetail };
