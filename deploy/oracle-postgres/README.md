# Oracle VM par apna Postgres — Step 1: Database Migration

Ye folder aapka database Lovable Cloud se hata kar **apni Oracle Always Free VM** par le jaata hai.
Sab kuch Termux se SSH karke ho jayega — PC ki zarurat nahi.

Files:
- `01_bootstrap.sql` — roles + `auth.users` + `auth.uid()` (jo hosted backend free me deta tha)
- `02_schema.sql` — aapke saare tables, RLS policies, functions, triggers (sab migrations ek file me)

---

## 1. VM me login

Termux me:

```bash
ssh -i ~/.ssh/oracle_key ubuntu@<YOUR_VM_IP>
```

## 2. Postgres install

```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

## 3. Database aur user banao

```bash
sudo -u postgres psql -c "CREATE USER forwardflow WITH PASSWORD 'STRONG_PASSWORD_HERE';"
sudo -u postgres psql -c "CREATE DATABASE forwardflow OWNER forwardflow;"
```

`STRONG_PASSWORD_HERE` ko apna strong password se badlo aur safe jagah note karo.

## 4. Schema files VM par le jao

VM par hi GitHub se clone karna sabse aasan hai:

```bash
cd ~ && git clone <YOUR_REPO_URL> app
cd app/deploy/oracle-postgres
```

## 5. Schema apply karo

```bash
sudo -u postgres psql -d forwardflow -f 01_bootstrap.sql
sudo -u postgres psql -d forwardflow -f 02_schema.sql
sudo -u postgres psql -d forwardflow -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO forwardflow;"
sudo -u postgres psql -d forwardflow -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO forwardflow;"
```

Verify:

```bash
sudo -u postgres psql -d forwardflow -c "\dt public.*"
```

Saare tables (forwarding_rules, wallets, plans, claim_codes, subscriptions, worker_health, ...) dikhne chahiye.

## 6. Remote connection allow karo

```bash
sudo sed -i "s/^#listen_addresses.*/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
echo "hostssl all all 0.0.0.0/0 scram-sha-256" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf
sudo systemctl restart postgresql

# firewall
sudo iptables -I INPUT -p tcp --dport 5432 -j ACCEPT
sudo netfilter-persistent save
```

Oracle Console me bhi: **Networking → VCN → Security List → Ingress Rule** add karo — Source `0.0.0.0/0`, TCP port `5432`.

> Behtar security ke liye baad me source ko sirf apne app server ke IP tak limit kar dena.

## 7. Connection string

```
postgresql://forwardflow:STRONG_PASSWORD_HERE@<YOUR_VM_IP>:5432/forwardflow
```

Ye string mujhe mat bhejo (password hai) — ise app ke secret me store karenge.

## 8. Purana data copy (optional)

Agar existing rules/users bachane hain to hosted DB resume hone ke baad main aapko per-table CSV export de dunga, jise aap `\copy` se import kar sakte ho.

---

## Step 2 kya bacha hai (important)

Database ab aapka hai, lekin app abhi bhi hosted backend se baat karta hai. Poori aazadi ke liye baaki hai:

1. **Auth replacement** — abhi login hosted auth se hota hai. Apne Postgres par shift karne ke liye email/password + session JWT khud handle karna padega (`auth.users` table already ready hai).
2. **Data layer rewiring** — app ke server functions ko Supabase client ki jagah direct Postgres (`postgres`/`pg` driver) par le jaana hoga, aur har query me `SET LOCAL app.user_id` set karna hoga taaki RLS waise hi kaam kare.
3. **App hosting** — website abhi Lovable par hai. Usko bhi usi Oracle VM par chalana ho to Node build + systemd + Caddy/Nginx setup karenge.

Ye teeno main aapke liye kar dunga — bas Step 1 complete karke batao.
