# Step 2 — Oracle VM par apna Supabase-compatible API stack

Aapke VM par Postgres already chal raha hai (`forwardflow` DB, schema imported).
Ab uske upar do services chalayenge taaki app bina rewrite ke chale:

| Service | Kaam | URL path |
|---|---|---|
| **GoTrue** | Signup / login / JWT / password reset | `/auth/v1/*` |
| **PostgREST** | Tables + RPC (Data API), RLS ke saath | `/rest/v1/*` |
| **nginx** | Dono ko ek hi port par jodta hai | `:8000` |

Iske baad app me sirf **URL + keys** badalne hote hain — baaki poora code same rehta hai.

> ⚠️ Chat me bheja gaya password (`secure_password_123`) ab safe nahi hai.
> Pehle use badlo: `sudo -u postgres psql -c "ALTER USER dbuser WITH PASSWORD '<naya>';"`

---

## 1. Files VM par le jao

```bash
ssh -i ~/.ssh/oracle_key ubuntu@137.23.33.160
git clone <YOUR_REPO_URL> ~/forwardflow || (cd ~/forwardflow && git pull)
cd ~/forwardflow/deploy/oracle-supabase
```

## 2. Docker install (ek baar)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

## 3. Postgres ko Docker se reachable banao

```bash
sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
echo "host all all 172.17.0.0/16 scram-sha-256" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf
sudo systemctl restart postgresql
```

> Port 5432 ko internet par mat kholo — Oracle security list me sirf **8000** open karo.
> App sirf gateway se baat karega, direct DB se nahi.

## 4. Roles banao

```bash
# passwords ko file me pehle edit kar lo
nano 03_api_roles.sql       # AUTHENTICATOR_PASSWORD, AUTH_PASSWORD badlo
sudo -u postgres psql -d forwardflow -f 03_api_roles.sql
```

## 5. Secrets generate karo

```bash
openssl rand -hex 32          # ye JWT_SECRET hai — copy karo
python3 gen-keys.py "<JWT_SECRET>"    # ANON_KEY + SERVICE_ROLE_KEY milenge
```

## 6. .env bharo aur stack start karo

```bash
cp .env.example .env
nano .env      # API_EXTERNAL_URL, JWT_SECRET, dono DB URLs, passwords
docker compose up -d
docker compose logs -f auth   # "GoTrue API started" dikhna chahiye
```

Test:

```bash
curl http://localhost:8000/auth/v1/health
curl "http://localhost:8000/rest/v1/plans?select=id" -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```

## 7. Firewall

```bash
sudo iptables -I INPUT -p tcp --dport 8000 -j ACCEPT
sudo netfilter-persistent save
```
Oracle Console → VCN → Security List → Ingress rule: TCP **8000**, source `0.0.0.0/0`.

## 8. HTTPS (zaroori)

Browser HTTPS site se `http://` API call block karta hai (mixed content).
Domain point karke:

```bash
sudo apt install -y certbot
# nginx.conf me 443 + certs add karo, ya Cloudflare proxy (orange cloud) laga do — sabse aasan
```
Sabse simple: domain Cloudflare par le jao, `api.yourdomain.com` → VM IP, proxy ON.
Phir `API_EXTERNAL_URL=https://api.yourdomain.com`.

---

## 9. App ko switch karo

Jab step 6 ka curl kaam kare, mujhe ye 3 cheezein batao (password/keys chat me nahi — main secure form khol dunga):

1. Gateway ka public URL (jaise `https://api.yourdomain.com`)
2. ANON_KEY
3. SERVICE_ROLE_KEY

Main phir app ke Supabase URL/keys switch kar dunga aur worker (`worker/main.py`) ka `API_BASE_URL` bhi update kar dunga.

## 10. Users migrate

Purane hosted backend ke users automatically nahi aate — password hashes export nahi hote.
Do options: (a) users dobara signup karein, ya (b) admin ke taur par main ek "reset password on first login" flow bana du.

## Auth signup/login repair

If signup returns `Database error finding user` or login returns
`Database error querying schema`, the old bootstrap stub is still installed.
From the repository root, run this single command:

```bash
git pull
sudo bash deploy/oracle-supabase/repair-auth.sh
```

Do not run `05_relink_auth.sql` separately or before the script. The repair
copies SQL to `/tmp`, so the `postgres` OS user is not blocked by repository
directory permissions. A successful run ends with `AUTH REPAIR COMPLETE`.
