'use strict';

const { escHtml } = require('./escHtml');

function renderHome(events, baseUrl) {
  const hostname = baseUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');

  const rows = events.map(e => `
    <tr>
      <td>${escHtml(e.received_at)}</td>
      <td>${escHtml(e.remote_ip || '—')}</td>
      <td>${escHtml(e.content_type || '(none)')}</td>
      <td><code>${escHtml((e.body_preview || '').slice(0, 120))}</code></td>
      <td><a href="/events/${escHtml(String(e.id))}/view">View</a></td>
    </tr>
  `).join('');

  const tableHtml = events.length === 0
    ? '<p class="empty">No events received yet. Waiting for first push from the gateway&hellip;</p>'
    : `<table>
        <thead>
          <tr>
            <th>Received At</th>
            <th>Remote IP</th>
            <th>Content-Type</th>
            <th>Body Preview</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
       </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>DXM700 Push Receiver</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 1100px; margin: 2rem auto; padding: 0 1rem;
      color: #222;
    }
    h1 { margin-bottom: 0.2rem; }
    .sub { color: #666; margin: 0 0 1.5rem; font-size: 0.95rem; }
    .badge {
      display: inline-block; background: #22c55e; color: #fff;
      border-radius: 4px; padding: 2px 9px; font-size: 0.75rem;
      vertical-align: middle; margin-left: 6px;
    }
    .card {
      background: #f8f8f8; border: 1px solid #ddd; border-radius: 6px;
      padding: 1rem 1.5rem; margin-bottom: 2rem;
    }
    .card h3 { margin-top: 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td {
      border: 1px solid #d1d5db; padding: 7px 12px;
      text-align: left; font-size: 0.875rem;
    }
    th { background: #f3f4f6; font-weight: 600; }
    tbody tr:nth-child(even) { background: #fafafa; }
    code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.8rem; }
    a { color: #2563eb; }
    .empty { color: #888; font-style: italic; }
    .api-link { margin-top: 0.75rem; font-size: 0.85rem; }
    .refresh-note { font-size: 0.75rem; color: #999; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>DXM700 Push Receiver <span class="badge">running</span></h1>
  <p class="sub">Banner DXM700 HTTP Cloud Push ingestion service &mdash; captures and stores all incoming push payloads.</p>

  <div class="card">
    <h3>Configure your DXM700 gateway with these settings</h3>
    <table>
      <tr><th>DXM700 Field</th><th>Value</th><th>Notes</th></tr>
      <tr>
        <td>Push method</td>
        <td>HTTP Cloud Push</td>
        <td></td>
      </tr>
      <tr>
        <td>Server name / IP</td>
        <td><strong>${escHtml(hostname)}</strong></td>
        <td>Set <code>PUBLIC_BASE_URL</code> env var to change this</td>
      </tr>
      <tr>
        <td>Page</td>
        <td>/dxm/push</td>
        <td>Ingestion endpoint on this server</td>
      </tr>
      <tr>
        <td>Push port</td>
        <td>80 (HTTP&nbsp;test) &nbsp;/&nbsp; 443 (HTTPS&nbsp;production)</td>
        <td>Use 80 for initial LAN/dev testing; switch to 443 + HTTPS for cellular</td>
      </tr>
      <tr>
        <td>Use HTTPS</td>
        <td>Off for dev, On for production</td>
        <td>See <code>docs/deployment.md</code> for nginx + Let&rsquo;s Encrypt setup</td>
      </tr>
    </table>
  </div>

  <h2>Recent Push Events <span style="font-size:0.85rem;font-weight:normal;color:#666">(last 50)</span></h2>
  ${tableHtml}
  <p class="refresh-note">Page auto-refreshes every 30 seconds.</p>
  <p class="api-link"><a href="/events">JSON event list</a> &mdash; <a href="/health">Health check</a></p>
</body>
</html>`;
}

module.exports = { renderHome };
