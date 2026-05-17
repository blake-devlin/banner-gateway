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

function fmt(val, unit, digits = 2) {
  if (val === null || val === undefined) return '—';
  return `${Number(val).toFixed(digits)} ${unit}`;
}

function warnClass(val, threshold) {
  if (val === null || val === undefined) return '';
  return val > threshold ? ' warn' : '';
}

function renderCards(r) {
  if (!r) r = {};

  const gatewayStatus = r.gateway_id
    ? `<span class="status-dot live"></span> Live`
    : `<span class="status-dot waiting"></span> Waiting for data`;

  const lastSeen = r.gateway_time_display
    ? escHtml(r.gateway_time_display)
    : (r.gateway_id ? 'unknown' : '—');

  const tempFClass = warnClass(r.temp_f, TEMP_WARN_F);
  const xClass = warnClass(r.x_vel_mm_s, VEL_WARN_MM_S);
  const yClass = warnClass(r.y_vel_mm_s, VEL_WARN_MM_S);
  const zClass = warnClass(r.z_vel_mm_s, VEL_WARN_MM_S);

  return `
  <div class="cards">
    <div class="card card-status">
      <div class="card-label">Gateway</div>
      <div class="card-value status-value">${gatewayStatus}</div>
      <div class="card-sub">${r.gateway_id ? escHtml(r.gateway_id) : '—'}</div>
      <div class="card-sub">Last push: ${lastSeen}</div>
    </div>

    <div class="card card-temp${tempFClass}">
      <div class="card-label">Temperature</div>
      <div class="card-value">${r.temp_f !== null && r.temp_f !== undefined ? escHtml(String(r.temp_f.toFixed(2))) : '—'}<span class="card-unit"> °F</span></div>
      <div class="card-sub">${r.temp_c !== null && r.temp_c !== undefined ? escHtml(String(r.temp_c.toFixed(2))) + ' °C' : '—'}</div>
      ${tempFClass ? '<div class="card-warn">Above threshold (' + TEMP_WARN_F + ' °F)</div>' : ''}
    </div>

    <div class="card card-vel${xClass}">
      <div class="card-label">X Velocity</div>
      <div class="card-value">${r.x_vel_mm_s !== null && r.x_vel_mm_s !== undefined ? escHtml(String(r.x_vel_mm_s.toFixed(4))) : '—'}<span class="card-unit"> mm/s</span></div>
      ${xClass ? '<div class="card-warn">Above threshold (' + VEL_WARN_MM_S + ' mm/s)</div>' : ''}
    </div>

    <div class="card card-vel${yClass}">
      <div class="card-label">Y Velocity</div>
      <div class="card-value">${r.y_vel_mm_s !== null && r.y_vel_mm_s !== undefined ? escHtml(String(r.y_vel_mm_s.toFixed(4))) : '—'}<span class="card-unit"> mm/s</span></div>
      ${yClass ? '<div class="card-warn">Above threshold (' + VEL_WARN_MM_S + ' mm/s)</div>' : ''}
    </div>

    <div class="card card-vel${zClass}">
      <div class="card-label">Z Velocity</div>
      <div class="card-value">${r.z_vel_mm_s !== null && r.z_vel_mm_s !== undefined ? escHtml(String(r.z_vel_mm_s.toFixed(4))) : '—'}<span class="card-unit"> mm/s</span></div>
      ${zClass ? '<div class="card-warn">Above threshold (' + VEL_WARN_MM_S + ' mm/s)</div>' : ''}
    </div>

    <div class="card card-hfe">
      <div class="card-label">HFE Acceleration</div>
      <div class="card-value">${r.hfe_accel !== null && r.hfe_accel !== undefined ? escHtml(String(r.hfe_accel.toFixed(4))) : '—'}<span class="card-unit"> G</span></div>
    </div>
  </div>`;
}

function renderReadingsTable(events) {
  if (events.length === 0) {
    return '<p class="empty">No events received yet. Waiting for first push from the gateway&hellip;</p>';
  }

  const rows = events.map(e => {
    const r = e.reading || {};
    const tempFClass = warnClass(r.temp_f, TEMP_WARN_F);
    const velClass =
      warnClass(r.x_vel_mm_s, VEL_WARN_MM_S) ||
      warnClass(r.y_vel_mm_s, VEL_WARN_MM_S) ||
      warnClass(r.z_vel_mm_s, VEL_WARN_MM_S);

    const hasSensorData = r.temp_f !== null || r.x_vel_mm_s !== null;
    const rowClass = hasSensorData ? '' : ' class="no-sensor"';

    return `<tr${rowClass}>
      <td>${escHtml(fmtTime(e.received_at))}</td>
      <td>${escHtml(r.gateway_id || '—')}</td>
      <td class="${tempFClass ? 'warn-cell' : ''}">${r.temp_f !== null && r.temp_f !== undefined ? escHtml(r.temp_f.toFixed(2)) + ' °F' : '—'}</td>
      <td>${r.temp_c !== null && r.temp_c !== undefined ? escHtml(r.temp_c.toFixed(2)) + ' °C' : '—'}</td>
      <td class="${velClass ? 'warn-cell' : ''}">${r.x_vel_mm_s !== null && r.x_vel_mm_s !== undefined ? escHtml(r.x_vel_mm_s.toFixed(4)) : '—'}</td>
      <td class="${velClass ? 'warn-cell' : ''}">${r.y_vel_mm_s !== null && r.y_vel_mm_s !== undefined ? escHtml(r.y_vel_mm_s.toFixed(4)) : '—'}</td>
      <td class="${velClass ? 'warn-cell' : ''}">${r.z_vel_mm_s !== null && r.z_vel_mm_s !== undefined ? escHtml(r.z_vel_mm_s.toFixed(4)) : '—'}</td>
      <td>${r.hfe_accel !== null && r.hfe_accel !== undefined ? escHtml(r.hfe_accel.toFixed(4)) : '—'}</td>
      <td><a href="/events/${escHtml(String(e.id))}/view">Detail</a></td>
    </tr>`;
  }).join('');

  return `<table>
    <thead>
      <tr>
        <th>Received At</th>
        <th>Gateway ID</th>
        <th>Temp (°F)</th>
        <th>Temp (°C)</th>
        <th>X Vel (mm/s)</th>
        <th>Y Vel (mm/s)</th>
        <th>Z Vel (mm/s)</th>
        <th>HFE Accel (G)</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderHome(events, baseUrl) {
  const latestReading = (events[0] && events[0].reading) ? events[0].reading : {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>DXM700 Vibration Monitor</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      margin: 0;
      padding: 1.5rem;
    }
    header {
      display: flex;
      align-items: baseline;
      gap: 1rem;
      margin-bottom: 1.75rem;
      flex-wrap: wrap;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f1f5f9;
      margin: 0;
      letter-spacing: -0.01em;
    }
    .badge {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: #22c55e;
      color: #fff;
      border-radius: 4px;
      padding: 3px 8px;
      vertical-align: middle;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 0.875rem;
      margin: 0;
    }

    /* Cards */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 1.1rem 1.25rem;
    }
    .card.warn {
      border-color: #f59e0b;
      background: #1c1a0f;
    }
    .card-label {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 0.4rem;
    }
    .card-value {
      font-size: 2rem;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1.1;
    }
    .card.warn .card-value { color: #fbbf24; }
    .card-unit {
      font-size: 1rem;
      font-weight: 400;
      color: #94a3b8;
    }
    .card-sub {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 0.3rem;
    }
    .card-warn {
      font-size: 0.7rem;
      color: #f59e0b;
      margin-top: 0.4rem;
      font-weight: 600;
    }
    .status-value {
      font-size: 1.1rem;
      font-weight: 600;
    }
    .status-dot {
      display: inline-block;
      width: 9px; height: 9px;
      border-radius: 50%;
      vertical-align: middle;
      margin-right: 5px;
    }
    .status-dot.live     { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
    .status-dot.waiting  { background: #64748b; }

    /* Table */
    h2 {
      font-size: 1rem;
      font-weight: 600;
      color: #cbd5e1;
      margin: 0 0 0.75rem;
    }
    .table-wrap { overflow-x: auto; }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 0.825rem;
    }
    th, td {
      border: 1px solid #1e293b;
      padding: 7px 12px;
      text-align: left;
      white-space: nowrap;
    }
    th {
      background: #1e293b;
      color: #94a3b8;
      font-weight: 600;
      font-size: 0.75rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    tbody tr { background: #0f172a; }
    tbody tr:nth-child(even) { background: #111827; }
    tbody tr.no-sensor td { color: #475569; }
    .warn-cell { color: #fbbf24; font-weight: 600; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .empty { color: #475569; font-style: italic; }
    .footer {
      margin-top: 1.25rem;
      font-size: 0.75rem;
      color: #475569;
    }
    .footer a { color: #38bdf8; }
  </style>
</head>
<body>
  <header>
    <h1>DXM700 Vibration Monitor <span class="badge">running</span></h1>
    <p class="subtitle">QM30VT3 &mdash; Banner DXM700 HTTP Cloud Push</p>
  </header>

  ${renderCards(latestReading)}

  <h2>Recent Readings <span style="font-size:0.8rem;font-weight:normal;color:#475569">(last 50, newest first)</span></h2>
  <div class="table-wrap">
    ${renderReadingsTable(events)}
  </div>

  <div class="footer">
    Page auto-refreshes every 30&nbsp;s &nbsp;&mdash;&nbsp;
    <a href="/events">JSON event list</a> &nbsp;&mdash;&nbsp;
    <a href="/health">Health check</a> &nbsp;&mdash;&nbsp;
    Push endpoint: <code>/dxm/push</code>
  </div>
</body>
</html>`;
}

module.exports = { renderHome };
