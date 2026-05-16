# AWS EC2 Setup — DXM700 Push Receiver

Stand up a public EC2 instance so the DXM700 can push data to it over the internet
(LAN or cellular). Estimated time: ~15 minutes.

---

## 1. Launch the EC2 instance

### In the AWS Console → EC2 → Launch Instance

| Setting | Value |
|---------|-------|
| Name | `dxm-push-receiver` |
| AMI | Ubuntu Server 24.04 LTS (free tier eligible) |
| Instance type | `t3.micro` (free tier) or `t3.small` |
| Key pair | Create a new key pair → download the `.pem` file |
| Auto-assign public IP | **Enable** |

### Network / Security Group

Create a new security group with these inbound rules:

| Type | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| SSH | TCP | 22 | Your IP only (`My IP`) | Admin access |
| Custom TCP | TCP | 8080 | `0.0.0.0/0` | Node.js server (DXM push) |
| HTTP | TCP | 80 | `0.0.0.0/0` | Optional: if DXM port is fixed at 80 |

> **Tip:** If you know the DXM700's outbound IP or cellular carrier IP range, restrict
> port 8080 to that range instead of `0.0.0.0/0`.

### Storage

8 GB gp3 is fine (default).

Click **Launch instance**.

---

## 2. Note the public IP

After launch, find the instance in EC2 → Instances and copy the **Public IPv4 address**.

If you plan to keep this instance running longer than a single test session, allocate an
**Elastic IP** so the address doesn't change on reboot:

EC2 → Elastic IPs → Allocate → Associate with your instance.

---

## 3. SSH into the instance

```bash
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## 4. Install system dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential python3 git
```

`build-essential` provides `make` and `g++`, which are required to compile `better-sqlite3`.

---

## 5. Install Node.js 20

Using the NodeSource setup script (installs Node 20 LTS):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v20.x.x
npm --version
```

---

## 6. Clone and install the project

```bash
git clone https://github.com/YOUR_USERNAME/banner-gateway.git
cd banner-gateway
npm install
```

`npm install` will compile `better-sqlite3` natively — this takes ~30 seconds on a t3.micro.

---

## 7. Configure the environment

```bash
cp .env.example .env
nano .env
```

Minimum changes:

```
PORT=8080
HOST=0.0.0.0
PUBLIC_BASE_URL=http://YOUR_EC2_PUBLIC_IP:8080
NODE_ENV=production
```

Save and exit (`Ctrl+X`, `Y`, `Enter`).

---

## 8. Start the service

### Quick test (foreground, exits when you close SSH)

```bash
npm start
```

### Background with PM2 (recommended — survives SSH disconnect)

```bash
sudo npm install -g pm2
pm2 start src/server.js --name dxm-push-receiver
pm2 save
pm2 startup   # follow the printed command to enable start-on-boot
```

Useful PM2 commands:

```bash
pm2 logs dxm-push-receiver    # tail logs
pm2 status                    # check running state
pm2 restart dxm-push-receiver
pm2 stop dxm-push-receiver
```

### Alternative: systemd (see docs/systemd/dxm-push-receiver.service)

```bash
sudo cp docs/systemd/dxm-push-receiver.service /etc/systemd/system/
# Edit the file — update User=ubuntu, WorkingDirectory=/home/ubuntu/banner-gateway
sudo systemctl daemon-reload
sudo systemctl enable --now dxm-push-receiver
sudo journalctl -u dxm-push-receiver -f
```

---

## 9. Verify from your laptop

Health check:

```bash
curl -i http://YOUR_EC2_PUBLIC_IP:8080/health
```

Send a test push:

```bash
curl -i -X POST http://YOUR_EC2_PUBLIC_IP:8080/dxm/push \
  -H "Content-Type: text/plain" \
  --data '<test><gateway>DXM700</gateway><value>123</value></test>'
```

Open the UI in a browser:

```
http://YOUR_EC2_PUBLIC_IP:8080/
```

You should see the test event in the table.

---

## 10. Configure the DXM700

In the gateway web UI under **Push → HTTP Cloud Push**:

| DXM700 Field | Value |
|---|---|
| Server name / IP | `YOUR_EC2_PUBLIC_IP` (no `http://`) |
| Page | `/dxm/push` |
| Push port | `8080` |
| Use HTTPS | unchecked |

Save. Trigger a push or wait for the next push interval. Refresh
`http://YOUR_EC2_PUBLIC_IP:8080/` to see the event arrive.

---

## Inspecting captured data

View raw JSONL logs on the server:

```bash
tail -f ~/banner-gateway/logs/$(date +%Y-%m-%d).jsonl
```

Fetch recent events as JSON:

```bash
curl -s http://localhost:8080/events | python3 -m json.tool
```

---

## Troubleshooting

**curl from laptop times out on port 8080**
- Check the EC2 security group inbound rules — port 8080 must be open to `0.0.0.0/0`
- Check the instance firewall: `sudo ufw status` (Ubuntu has ufw disabled by default, so
  the security group is the main control)

**npm install fails**
- Make sure `build-essential` is installed: `sudo apt install -y build-essential python3`

**DXM700 can connect but nothing appears in the UI**
- Confirm `Page` is exactly `/dxm/push` (leading slash, lowercase)
- Check the server log: `pm2 logs dxm-push-receiver` or `journalctl -u dxm-push-receiver`
- Try curling the endpoint from the server itself: `curl -i -X POST http://localhost:8080/dxm/push --data test`

**Port 80 instead of 8080**
If the DXM firmware only allows port 80, use iptables to redirect:

```bash
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
# Make it persistent
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

---

## Cost estimate

| Resource | Cost |
|----------|------|
| t3.micro (first 12 months) | Free tier (750 hrs/month) |
| t3.micro after free tier | ~$0.0104/hr (~$7.50/month) |
| Elastic IP (when associated) | Free |
| Elastic IP (unassociated) | ~$0.005/hr |
| Data transfer out | First 100 GB/month free |

Stop or terminate the instance when not in use to avoid charges.

```bash
# From your laptop — stop without terminating (data preserved)
aws ec2 stop-instances --instance-ids YOUR_INSTANCE_ID
```
