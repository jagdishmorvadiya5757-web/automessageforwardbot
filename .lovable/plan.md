# Phase 1 — Multi-User Worker + 3-Day Auto Trial

Goal: Ek hi centralized worker (Oracle pe jo chal raha hai) ab sirf aapka account nahi, **har signed-up user ka Telegram account** handle karega. User sirf dashboard pe login → phone verify → rule add → forwarding chalu. Worker ka koi kaam user nahi karega.

---

## 1. Database changes (migration)

**`subscriptions` table (naya):**
- `user_id` (unique)
- `plan` (`trial` / `pro` / `business` / `expired`)
- `trial_ends_at`, `subscription_ends_at`
- `is_active` (boolean)

**Trigger on new signup:** Har naye user ke liye auto-insert `plan='trial'`, `trial_ends_at = now() + 3 days`, `is_active=true`.

**`telegram_sessions` table (naya, server-only):**
- `user_id` (unique)
- `session_string_ciphertext` (AES-256-GCM encrypted Telethon StringSession)
- `phone`, `status` (`logged_out` / `awaiting_code` / `awaiting_password` / `logged_in`)
- Grants: **sirf service_role** — anon/authenticated ko nahi (session leak = account hijack).

**`forwarding_rules` per-user check:** Worker jab rules fetch kare to sirf active subscription wale users ke rules mile.

## 2. Worker refactor (`worker/main.py`)

Abhi: 1 `TelegramClient` instance, file-based session, aapka account.
Naya: **N TelegramClients in a dict `clients[user_id]`**, har ek in-memory `StringSession` se load hota hai jo DB se decrypt karke aata hai.

- `/api/public/worker/users` naya endpoint: worker isse har 30s pe active users ki list leta hai (subscription active + session logged_in).
- Naya user aaya → us user ka session load karo, `NewMessage` handler register karo, `clients[user_id]` me daal do.
- User expire/logout hua → us client ko disconnect, dict se hatao.
- Login flow (phone → code → 2FA) same rahega — worker DB se `telegram_auth` table poll karta hai, per-user client pe run karta hai, session string DB me encrypt karke save karta hai.
- Message forward hone se pehle worker `is_active` check karega (cached, 30s).

## 3. Encryption

`APP_USER_CONNECTION_KEY_SECRET` jaisa ek secret `SESSION_ENCRYPTION_KEY` (32-byte, base64) auto-generate karege. AES-256-GCM se session string encrypt/decrypt hoga — server functions me only.

## 4. Server functions / API

- `getMySubscription` — dashboard pe trial days left dikhane ke liye.
- `/api/public/worker/users` — worker ko active user list + phone/status dena.
- `/api/public/worker/session` — worker se encrypted session string DB me save karne ke liye (worker ke bearer token se auth).
- Existing `login-state`/`login-status` endpoints ko multi-user karna (user_id header/scope se).

## 5. Dashboard UI

- **Trial banner** har page pe top pe: "3 days trial — 2 days left" ya "Trial expired — subscribe to continue".
- **Rule add/edit** block if `!is_active`.
- Forwarding page waise ka waise (already user-scoped hai).

## 6. Worker token model change

Abhi: 1 worker token = 1 user ka data.
Naya: Worker ka **ek master token** hoga (env var `WORKER_MASTER_TOKEN`) jo saare users ka data access kar sake. `worker_tokens` table sirf legacy compatibility ke liye rakhege ya hata dege. Master token aap admin panel se dekh sakoge, users ke saamne nahi aayega.

---

## Kya iss phase me nahi hoga

- License key page / invite links (Phase 2)
- Payment integration / Super Profile link (Phase 2)
- Admin panel UI (Phase 2 — abhi database me aapka user_id ko admin role assign kar dege bas)
- Plan pricing / limits per plan (Phase 2)

---

## Kaam ka order

1. **Migration 1:** `subscriptions` table + trigger + aapko admin role assign.
2. **Migration 2:** `telegram_sessions` table (encrypted).
3. **Secret:** Generate `SESSION_ENCRYPTION_KEY`.
4. **Server fns + APIs:** `getMySubscription`, `/api/public/worker/users`, `/api/public/worker/session`, update `login-state`/`login-status` for multi-user.
5. **Worker rewrite (v10):** Multi-client dict, per-user session, subscription check.
6. **Dashboard:** Trial banner + block-if-expired guard.
7. **Deploy:** Oracle pe worker update, master token set, purana single-user session file hata do.

---

## ⚠️ Important notes

- **Oracle worker restart hoga** ek baar (naya `main.py` deploy karna hoga — `git pull && systemctl restart forwardflow`).
- **Aapka current Telegram login re-do karna padega** ek baar (kyunki session ab DB me encrypted store hoga, file me nahi). Purana file session hata denge.
- **All existing forwarding rules preserve hongi** — sirf session flow badalega.

---

Approve karo to migration 1 se start karta hoon.