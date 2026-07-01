# Telegram Auto-Forwarding Bot — Control Plane + External Worker

## The architecture (important)

Because you chose the **userbot** method (read from any channel without being an admin), the forwarding engine must run as a persistent MTProto process. Lovable's edge backend cannot host that. So the system is split in two:

```text
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  LOVABLE APP (this project)  │        │  YOUR SERVER (external, VPS) │
│  - Web dashboard             │  HTTPS │  - Python + Telethon userbot │
│  - User login/accounts       │◄──────►│  - Logs in with YOUR account │
│  - Forwarding rules DB       │  pull  │  - Reads rules via API       │
│  - Forwarding logs/status    │  rules │  - Forwards messages         │
│  - Secure sync API endpoint  │  push  │  - Reports status/logs back  │
└─────────────────────────────┘  logs  └──────────────────────────────┘
```

Lovable builds the left box entirely and provides the worker script for the right box. You run the worker on any always-on machine.

## What Lovable will build

### 1. Backend (Lovable Cloud)
Enable Lovable Cloud for database + auth. Tables:
- `profiles` — one row per user (auto-created on signup).
- `forwarding_rules` — `id`, `user_id`, `source` (channel/bot identifier), `destination` (channel/bot identifier), `source_type`, `destination_type`, `enabled`, `filters` (optional keyword include/exclude), `created_at`.
- `forwarding_logs` — `id`, `rule_id`, `user_id`, `source_msg_ref`, `status` (forwarded/skipped/error), `detail`, `created_at`.
- `worker_tokens` — per-user secret token the external worker uses to authenticate to the sync API (generated in the dashboard, hashed at rest).
- `user_roles` + `has_role()` (separate table, security-definer) for admin.

All tables get RLS scoped to `auth.uid()` and the required GRANTs.

### 2. Secure sync API (server routes under `/api/public/worker/*`)
The external worker calls these with a Bearer worker-token (verified server-side, not user auth):
- `GET /api/public/worker/rules` — returns enabled rules for that token's user.
- `POST /api/public/worker/logs` — worker reports forward results, inserted into `forwarding_logs`.
- `POST /api/public/worker/heartbeat` — worker reports it's alive; dashboard shows online/offline.

### 3. Web dashboard (authenticated)
- **Auth**: email/password login + signup.
- **Rules manager**: create/edit/delete forwarding rules. Each rule picks source, destination, direction type (channel→channel, channel→bot, bot→channel), enable toggle, optional keyword filters.
- **Worker setup page**: generate/copy the worker token, shows worker online/offline status (from heartbeat), and step-by-step instructions to run the worker.
- **Logs page**: recent forwarding activity with status filters.

### 4. The worker script (delivered as files in the repo, run externally)
A `worker/` folder with:
- `main.py` — Telethon userbot: logs in with your account, pulls rules from the sync API on an interval, listens for new messages in source chats, forwards to destinations, posts logs + heartbeat back.
- `requirements.txt`, `.env.example`, `README.md` with setup (get `API_ID`/`API_HASH` from my.telegram.org, first-run phone login, how to keep it running with systemd/pm2).

## What you must provide / do
- Run the worker on an always-on machine (VPS/Railway/Fly/Pi).
- Get `API_ID` + `API_HASH` from https://my.telegram.org and do the one-time phone login for the worker.
- Paste the worker token from the dashboard into the worker's `.env`.

## Important cautions
- Userbot automation can violate Telegram's Terms of Service and risks your account being limited or banned. Use an account you're comfortable risking, respect rate limits (the worker throttles).
- The Lovable app never stores your Telegram password or session; that lives only on your server.

## Technical notes
- Stack: TanStack Start + Lovable Cloud (Supabase under the hood).
- Worker auth uses a hashed token compared server-side in the `/api/public/worker/*` routes; no Supabase user JWT needed for the worker.
- Rules reference chats by username or numeric ID; the worker resolves them via your account's access.

## Build order
1. Enable Lovable Cloud; create tables, RLS, GRANTs, roles.
2. Auth pages + protected dashboard shell.
3. Rules CRUD UI + server functions.
4. Worker token generation + sync API routes + heartbeat/status.
5. Logs page.
6. Worker script folder + README.

I'll confirm the design direction (colors/typography) for the dashboard when we start building unless you have a preference.