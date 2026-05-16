# Meritori — AWS EC2 Deployment Guide

A talent-first mentorship platform. Single HTML file, Node.js backend, deployable on EC2 in under 20 minutes.

---

## Project Structure

```
meritori/
├── meritori.html          ← Single-page app (landing + application form)
├── server.js              ← Express backend (serves app, handles submissions)
├── package.json           ← Node dependencies
├── submissions.json       ← Created automatically on first submission
└── public/
    └── meritori.html      ← Copy meritori.html here after setup
```

---

## Prerequisites

- AWS account with EC2 access
- SSH key pair (`.pem` file)
- Domain name (optional, but recommended)

---

## Step 1 — Launch an EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**

2. Configure:
   | Setting | Value |
   |---------|-------|
   | **Name** | `meritori-server` |
   | **AMI** | Ubuntu Server 24.04 LTS (Free tier eligible) |
   | **Instance type** | `t2.micro` (free tier) or `t3.small` for better performance |
   | **Key pair** | Select existing or create new `.pem` key |
   | **Storage** | 8 GB gp3 (default is fine) |

3. **Security Group** — add these inbound rules:

   | Type | Port | Source | Purpose |
   |------|------|--------|---------|
   | SSH | 22 | Your IP only | Server access |
   | HTTP | 80 | 0.0.0.0/0 | Web traffic |
   | HTTPS | 443 | 0.0.0.0/0 | SSL (optional) |
   | Custom TCP | 3000 | 0.0.0.0/0 | Direct Node access (disable after Nginx setup) |

4. Click **Launch Instance**. Note the **Public IPv4 address**.

---

## Step 2 — Connect to your Instance

```bash
# Fix key permissions
chmod 400 your-key.pem

# SSH in
ssh -i your-key.pem ubuntu@<YOUR-EC2-IP>
```

---

## Step 3 — Install Node.js

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v    # should show v20.x
npm -v     # should show 10.x
```

---

## Step 4 — Upload Project Files

**From your local machine**, run these commands in the folder containing your project files:

```bash
# Create project directory on server
ssh -i your-key.pem ubuntu@<EC2-IP> "mkdir -p ~/meritori/public"

# Upload all project files
scp -i your-key.pem meritori.html server.js package.json ubuntu@<EC2-IP>:~/meritori/

# Copy the HTML into the public folder
ssh -i your-key.pem ubuntu@<EC2-IP> "cp ~/meritori/meritori.html ~/meritori/public/"
```

---

## Step 5 — Install Dependencies & Configure

```bash
# SSH back into server
ssh -i your-key.pem ubuntu@<EC2-IP>

# Go to project folder
cd ~/meritori

# Install Node dependencies
npm install

# Test that it runs (Ctrl+C to stop)
ADMIN_TOKEN=test-secret node server.js
# Should print: Meritori running on http://localhost:3000
```

Open `http://<EC2-IP>:3000` in your browser to verify it works.

---

## Step 6 — Keep it Running with PM2

PM2 keeps the app alive after you disconnect and restarts it on crashes.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the app with your secret admin token
ADMIN_TOKEN=your-strong-secret-here pm2 start server.js --name meritori

# Save the process list
pm2 save

# Enable auto-start on reboot (run the printed command)
pm2 startup
# It will print something like: sudo env PATH=... pm2 startup systemd -u ubuntu
# Run that exact command.

# Useful PM2 commands
pm2 status           # Check if running
pm2 logs meritori    # Tail live logs
pm2 restart meritori # Restart the app
pm2 stop meritori    # Stop the app
```

At this point, your app is accessible at `http://<EC2-IP>:3000`.

---

## Step 7 — Set up Nginx (Serve on Port 80)

Nginx proxies port 80 traffic to your Node app on port 3000.

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/meritori
```

Paste this configuration (replace `YOUR_DOMAIN_OR_IP` with your EC2 IP or domain):

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/meritori /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t
# Should print: syntax is ok / test is successful

# Start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Now your app runs at `http://<EC2-IP>` (no port needed).

---

## Step 8 — Add HTTPS with Let's Encrypt (Recommended)

> Only do this if you have a domain name pointed to your EC2 IP via an A record.

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d meritori.io -d www.meritori.io

# Auto-renewal is set up automatically. Test it:
sudo certbot renew --dry-run
```

Your site is now at `https://meritori.io` with automatic SSL renewal.

---

## Step 9 — Point your Domain (if applicable)

In your domain registrar's DNS settings:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<EC2-IP>` | 300 |
| A | `www` | `<EC2-IP>` | 300 |

Changes propagate in 5–30 minutes.

---

## Viewing Submissions

### JSON via browser or curl
```bash
curl "http://YOUR-DOMAIN/admin/submissions?token=your-strong-secret-here"
```

### Download as CSV spreadsheet
```bash
curl "http://YOUR-DOMAIN/admin/csv?token=your-strong-secret-here" \
  -o submissions.csv
```

### Directly on the server
```bash
cat ~/meritori/submissions.json
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port Node.js listens on |
| `ADMIN_TOKEN` | `change-this-secret` | Password for `/admin/*` endpoints |

Set them in PM2:
```bash
pm2 delete meritori
ADMIN_TOKEN=your-new-secret PORT=3000 pm2 start server.js --name meritori
pm2 save
```

---

## Updating the App

When you make changes to `meritori.html`:

```bash
# On your local machine
scp -i your-key.pem meritori.html ubuntu@<EC2-IP>:~/meritori/
ssh -i your-key.pem ubuntu@<EC2-IP> "cp ~/meritori/meritori.html ~/meritori/public/"

# Restart the app
ssh -i your-key.pem ubuntu@<EC2-IP> "pm2 restart meritori"
```

---

## Security Checklist

- [ ] Change `ADMIN_TOKEN` to a strong random string (use `openssl rand -hex 32`)
- [ ] Restrict SSH port 22 to your IP only in the Security Group
- [ ] Close port 3000 in Security Group once Nginx is set up
- [ ] Enable HTTPS via Let's Encrypt if you have a domain
- [ ] Back up `submissions.json` periodically:
  ```bash
  # Add to crontab: daily backup at 2am
  crontab -e
  # Add: 0 2 * * * cp ~/meritori/submissions.json ~/meritori/submissions.$(date +\%Y\%m\%d).json
  ```
- [ ] Keep Node.js and OS updated: `sudo apt update && sudo apt upgrade -y`

---

## Troubleshooting

**App not responding on port 80?**
```bash
sudo systemctl status nginx     # Check Nginx is running
pm2 status                      # Check Node app is running
sudo nginx -t                   # Validate Nginx config
pm2 logs meritori               # Check for Node errors
```

**Submissions not saving?**
```bash
ls -la ~/meritori/submissions.json   # Check file exists
node -e "require('./server.js')"     # Check for startup errors
```

**502 Bad Gateway?**
```bash
pm2 status                # Node app probably crashed
pm2 logs meritori         # See why it crashed
pm2 restart meritori      # Restart it
```

**Can't SSH in?**
- Verify your IP hasn't changed (dynamic IPs)
- Check Security Group inbound rules allow port 22 from your current IP

---

## Quick Reference

```bash
# SSH in
ssh -i your-key.pem ubuntu@<EC2-IP>

# App status
pm2 status

# View live logs
pm2 logs meritori

# Restart app
pm2 restart meritori

# View submissions
curl "http://your-domain/admin/submissions?token=YOUR_SECRET"

# Download CSV
curl "http://your-domain/admin/csv?token=YOUR_SECRET" -o data.csv

# Nginx status
sudo systemctl status nginx

# Renew SSL
sudo certbot renew
```

---

*Built by Meritori · meritori.io*
