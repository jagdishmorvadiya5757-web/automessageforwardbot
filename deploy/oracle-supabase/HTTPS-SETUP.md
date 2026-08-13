# HTTPS gateway (free, ~10 minutes)

Browser HTTPS site se `http://IP:8000` block karta hai (mixed content).
Isliye gateway ko ek domain + free SSL chahiye. Sabse aasan: **DuckDNS + Caddy**.

## 1. Free subdomain (DuckDNS)

1. https://www.duckdns.org kholo → Google/GitHub se login
2. Ek naam banao, jaise `forwardflow` → milega `forwardflow.duckdns.org`
3. "current ip" box me apna VM ka public IP `137.23.33.160` daalo → **update ip**

## 2. Ports kholo (80 + 443)

Oracle Console → Networking → VCN → Security List → Ingress Rules → Add:
- TCP **80**, source `0.0.0.0/0`
- TCP **443**, source `0.0.0.0/0`

VM par:
```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Caddy chalao (auto SSL)

```bash
cd ~/automessageforwardbot/deploy/oracle-supabase
export GATEWAY_DOMAIN=forwardflow.duckdns.org   # apna naam
sudo -E docker compose -f docker-compose.yml -f docker-compose.https.yml up -d
```

Caddy khud Let's Encrypt se certificate le lega (pehli baar 30-60 sec).

## 4. Test

```bash
curl https://forwardflow.duckdns.org/auth/v1/health
```

`{"name":"GoTrue",...}` aana chahiye.

## 5. .env update

```bash
nano .env
# API_EXTERNAL_URL=https://forwardflow.duckdns.org
sudo docker compose up -d
```

Uske baad domain + ANON_KEY mujhe bhejo — main app switch kar dunga.
