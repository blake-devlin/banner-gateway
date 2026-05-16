# Deployment Guide

This guide covers running the DXM700 Push Receiver on a Linux server, with notes on
HTTP-only testing, nginx reverse proxy, HTTPS via Let's Encrypt, and firewall configuration.

---

## Quick start (direct Node, no nginx)

Bind Node directly to all interfaces on port 8080:

```bash
cp .env.example .env
# Edit .env — set PUBLIC_BASE_URL to your server's IP or domain
npm install
npm start
```

Point the DXM700 at `http://YOUR_SERVER_IP:8080` with Page `/dxm/push`.

This is the fastest way to verify end-to-end data flow. The Node process listens on
port 8080, so no root privileges are needed.

---

## Systemd service

Copy the service file and adapt the paths:

```bash
sudo cp docs/systemd/dxm-push-receiver.service /etc/systemd/system/
# Edit the file — update User=, WorkingDirectory=, EnvironmentFile= to match your setup
sudo systemctl daemon-reload
sudo systemctl enable dxm-push-receiver
sudo systemctl start dxm-push-receiver
sudo journalctl -u dxm-push-receiver -f   # tail logs
```

Set `HOST=127.0.0.1` in `.env` when running behind nginx so the Node process only
accepts connections from the local machine.

---

## Running behind nginx

### Why nginx?

- Terminates TLS (HTTPS on port 443)
- Handles client certificates, rate limiting, and access logging
- Lets Node run as a non-root user even when accepting traffic on ports 80/443

### HTTP-only nginx config (for initial testing)

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP_OR_DOMAIN;

    location /dxm/push {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    # Optional: also forward the UI and API
    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Reload nginx after changes:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Set `HOST=127.0.0.1` in `.env` so Node only accepts connections from nginx.

---

## HTTPS with Let's Encrypt (production / cellular)

Use Certbot to obtain a certificate and configure nginx automatically:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN.example.com
```

Certbot will update your nginx config to listen on port 443 and redirect port 80 to HTTPS.

After this is working, update the DXM700 settings:

| Field | Value |
|-------|-------|
| Push port | 443 |
| Use HTTPS | checked |

Certificates auto-renew via a systemd timer installed by Certbot.

---

## Firewall notes

### During initial LAN testing

If the DXM is on the same local network and you're not using cellular:

```bash
# Open port 8080 (Node direct) or 80 (nginx) on the local network
sudo ufw allow from 192.168.1.0/24 to any port 8080
```

### For cellular push (DXM using mobile data)

The gateway sends data over the public internet — the server's public IP must be reachable:

```bash
sudo ufw allow 80/tcp    # HTTP test
sudo ufw allow 443/tcp   # HTTPS production
```

### Principle of least privilege

- Bind Node to `127.0.0.1` when nginx is in front (`HOST=127.0.0.1` in `.env`)
- Only open the ports nginx listens on externally; never expose port 8080 publicly in production
- Use `ProtectSystem=full` and `NoNewPrivileges=true` in the systemd unit (already included)

---

## Shared secret header (optional)

The DXM700 supports custom HTTP headers. Once the basic push is working, add a header
`X-DXM-Secret: <value>` in the gateway UI and set `DXM_SHARED_SECRET=<value>` in `.env`.
The receiver will then reject any push that does not include the matching header.

---

## Useful commands

```bash
# Check recent events
curl -s http://localhost:8080/events | head -c 2000

# Watch the JSONL log live
tail -f logs/$(date +%Y-%m-%d).jsonl

# Check systemd service status
sudo systemctl status dxm-push-receiver

# Tail systemd logs
sudo journalctl -u dxm-push-receiver -f --since "1 hour ago"
```
