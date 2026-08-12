#!/usr/bin/env bash
# Fix: GoTrue/PostgREST "connect: no route to host" to host Postgres.
#
# Run ON THE ORACLE VM:
#   cd ~/automessageforwardbot/deploy/oracle-supabase
#   chmod +x fix-db-access.sh && sudo ./fix-db-access.sh
#
# Do teen cheezein karta hai:
#   1. Postgres ko sab interfaces par sunwata hai (listen_addresses = '*')
#   2. pg_hba.conf me Docker subnet (172.16.0.0/12) allow karta hai
#   3. Oracle ka default REJECT iptables rule bypass karne ke liye
#      docker0 se aane wale 5432 packets ko ACCEPT karta hai
set -euo pipefail

echo "==> 1/4 Postgres listen_addresses"
PGCONF=$(ls /etc/postgresql/*/main/postgresql.conf | head -n1)
PGHBA=$(dirname "$PGCONF")/pg_hba.conf
sed -i "s/^#\?listen_addresses.*/listen_addresses = '*'/" "$PGCONF"

echo "==> 2/4 pg_hba.conf Docker subnet"
grep -q "172.16.0.0/12" "$PGHBA" || \
  echo "host    all    all    172.16.0.0/12    scram-sha-256" >> "$PGHBA"

echo "==> 3/4 iptables (Oracle default REJECT ko bypass)"
# docker0 interface se aane wale DB packets ko sabse upar ACCEPT karo
iptables -C INPUT -i docker0 -p tcp --dport 5432 -j ACCEPT 2>/dev/null || \
  iptables -I INPUT 1 -i docker0 -p tcp --dport 5432 -j ACCEPT
# user-defined bridge networks (172.18.x etc.) ke liye source-based rule
iptables -C INPUT -s 172.16.0.0/12 -p tcp --dport 5432 -j ACCEPT 2>/dev/null || \
  iptables -I INPUT 1 -s 172.16.0.0/12 -p tcp --dport 5432 -j ACCEPT
command -v netfilter-persistent >/dev/null && netfilter-persistent save || \
  echo "   (netfilter-persistent nahi mila: sudo apt install -y iptables-persistent)"

echo "==> 4/4 Postgres restart"
systemctl restart postgresql

echo
echo "Verify:"
ss -lntp | grep 5432 || true
echo
echo "Ab: docker compose down && docker compose up -d && docker compose logs -f auth"
