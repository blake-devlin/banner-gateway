# DXM700 Push Receiver

A proof-of-concept ingestion service for the **Banner DXM700 wireless gateway** using its
HTTP Cloud Push feature. The service captures all incoming push payloads, stores them in a
local SQLite database and daily JSONL log files, and provides a simple web UI and JSON API
to inspect received data.

---

## What this does

- Accepts `POST /dxm/push` from the DXM700 gateway
- Stores every push: timestamp, IP, headers, raw body, and best-effort parsed body
- Serves a browser UI at `/` showing recent events (auto-refreshes every 30 s)
- Provides a JSON API at `/events` and `/events/:id`
- Writes daily JSONL logs to `./logs/YYYY-MM-DD.jsonl` for easy terminal inspection
- Does **not fail** on unexpected content types — captures everything safely

---

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/banner-gateway.git
cd banner-gateway
npm install
cp .env.example .env
# Edit .env — at minimum set PUBLIC_BASE_URL to your server's IP or hostname
```

Requirements: Node.js ≥ 18, npm, Python 3 + `make` + `g++` (for `better-sqlite3` native build).
On Ubuntu/Debian: `sudo apt install build-essential python3`.

---

## Running

### Development (auto-restart on file changes)

```bash
npm run dev
```

### Production

```bash
NODE_ENV=production npm start
```

The service starts on `http://0.0.0.0:8080` by default. Open `http://localhost:8080/` in a
browser to see the UI.

---

## Tests

```bash
npm test
```

Uses Node's built-in test runner (`node:test`) with `supertest`. Tests cover:

- `GET /health` returns 200
- `POST /dxm/push` accepts JSON, XML, plain text, form-encoded, and unknown content types
- `POST /dxm/push` stores the raw body
- `GET /events` returns captured events
- `GET /events/:id` and `/events/:id/view` return event detail

---

## Testing with curl

Health check:

```bash
curl -i http://localhost:8080/health
```

Send a plain-text push (simulating a DXM700 default packet):

```bash
curl -i -X POST http://localhost:8080/dxm/push \
  -H "Content-Type: text/plain" \
  --data '<test><gateway>DXM700</gateway><value>123</value></test>'
```

Send an XML push:

```bash
curl -i -X POST http://localhost:8080/dxm/push \
  -H "Content-Type: text/xml" \
  --data '<?xml version="1.0"?><push><gateway>DXM700</gateway><AI1>42</AI1></push>'
```

Send a JSON push:

```bash
curl -i -X POST http://localhost:8080/dxm/push \
  -H "Content-Type: application/json" \
  --data '{"gateway":"DXM700","register":"AI1","value":123}'
```

Send with shared secret header (if `DXM_SHARED_SECRET` is set):

```bash
curl -i -X POST http://localhost:8080/dxm/push \
  -H "Content-Type: text/plain" \
  -H "X-DXM-Secret: your-secret-here" \
  --data 'test payload'
```

List captured events:

```bash
curl -s http://localhost:8080/events | python3 -m json.tool
```

View event detail:

```bash
curl -s http://localhost:8080/events/1 | python3 -m json.tool
```

---

## Configuring the DXM700 gateway

In the DXM700 web UI, navigate to **Push → HTTP Cloud Push** and set:

| DXM700 Field | Value | Notes |
|---|---|---|
| Push method | HTTP Cloud Push | |
| Server name / IP | `YOUR_SERVER_IP_OR_DOMAIN` | No `http://` prefix |
| Page | `/dxm/push` | The ingestion path |
| Push port | `80` (dev) or `443` (prod) | See notes below |
| Use HTTPS | unchecked (dev) / checked (prod) | |
| Push packet format | Default | |

**Gateway ID / GUID** — the DXM has an option "Include XML GUID in first push". Leave this
checked; the receiver stores the full raw body so the GUID will be captured.

---

## Port 80 vs 8080

- **Port 8080**: easiest for initial testing — Node binds directly, no root required.
  Point the DXM to `YOUR_IP:8080`.
- **Port 80**: required if you cannot change the DXM's push port (some firmware limits
  it to 80). You can either run Node as root (not recommended), use `authbind`, or put
  nginx on port 80 proxying to Node on 8080.

See `docs/deployment.md` for the nginx configuration.

---

## HTTPS / port 443 for production

When the DXM700 is pushing over **cellular** (mobile data), the server must have a public
IP and a valid TLS certificate — self-signed will be rejected by the gateway.

1. Point a domain at your server.
2. Install nginx + Certbot: `sudo certbot --nginx -d YOUR_DOMAIN`.
3. Set `Use HTTPS: checked` and `Push port: 443` on the DXM700.
4. Bind Node to `127.0.0.1` (`HOST=127.0.0.1` in `.env`) so only nginx can reach it.

Full instructions: `docs/deployment.md`.

---

## Project structure

```
banner-gateway/
├── src/
│   ├── app.js                  # Express app (routes, no server.listen)
│   ├── server.js               # Entry point — binds the port
│   ├── db.js                   # SQLite helpers via better-sqlite3
│   ├── logger.js               # Daily JSONL log writer
│   ├── ingest/
│   │   ├── routes.js           # POST /dxm/push and POST /debug/*
│   │   ├── captureRequest.js   # Extracts all request fields
│   │   └── parsePayload.js     # Best-effort JSON / XML / form-encoded parse
│   └── views/
│       ├── escHtml.js          # HTML escaping utility
│       ├── renderHome.js       # Home page (event list + DXM settings)
│       └── renderEventDetail.js # Event detail page
├── test/
│   ├── health.test.js
│   └── ingest.test.js
├── docs/
│   ├── deployment.md
│   └── systemd/
│       └── dxm-push-receiver.service
├── data/                       # SQLite files (gitignored)
├── logs/                       # JSONL log files (gitignored)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Environment variables

See `.env.example` for the full list with descriptions. Key variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port to listen on |
| `HOST` | `0.0.0.0` | Interface to bind |
| `PUBLIC_BASE_URL` | `http://localhost:8080` | Shown in UI + logs |
| `DB_PATH` | `./data/dxm_ingest.sqlite` | SQLite database path |
| `LOG_DIR` | `./logs` | JSONL log directory |
| `MAX_BODY_SIZE` | `1mb` | Reject bodies larger than this |
| `DXM_SHARED_SECRET` | _(unset)_ | If set, `X-DXM-Secret` header must match |

---

## Troubleshooting

**Gateway times out when pushing / no events appear**
- Check firewall: `sudo ufw status` — ensure the push port is open
- Verify the server name/IP and page fields in the DXM UI exactly match this service
- Try `curl -i -X POST http://YOUR_SERVER_IP:PORT/dxm/push --data test` from your laptop

**`npm install` fails with build errors**
- Install build tools: `sudo apt install build-essential python3`
- Then retry `npm install`

**Port 80 is refused**
- Node cannot bind to ports < 1024 without root. Use port 8080 and put nginx on port 80,
  or use `authbind`: `sudo apt install authbind && sudo authbind --deep npm start`

**`Use HTTPS` is checked but the gateway cannot connect**
- The certificate must be from a public CA (Let's Encrypt). Self-signed certificates will
  be rejected by the DXM700 firmware.

**Events appear with no parsed body**
- The `parsePayload` module does best-effort parsing. If the DXM sends a proprietary format
  not recognised as JSON, XML, or form-encoded, the `parsed_json` column will be null but
  `raw_body` will still contain the full payload. Open an event's detail page to inspect it.
  Once real sample packets are collected, update `src/ingest/parsePayload.js` with a
  dedicated parser.
