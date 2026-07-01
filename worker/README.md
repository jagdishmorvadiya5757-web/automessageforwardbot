# ForwardFlow Worker

The forwarding engine. It logs into Telegram with **your personal account**
(a "userbot") so it can read any channel you can see — no bot admin needed in
source channels. Login is driven entirely from the dashboard: you enter your
phone number and the code there, and this worker performs the actual Telegram
login, syncs your joined channels back to the dashboard, and mirrors new
messages to the destinations you configured.

## Setup

1. Get `API_ID` and `API_HASH` from https://my.telegram.org → API development tools.
2. Generate a **worker token** on the dashboard's Worker page.
3. Copy `.env.example` to `.env` and fill in the values.
4. Install and run:

   ```bash
   pip install -r requirements.txt
   python main.py
   ```

5. Open the dashboard → **Telegram** page and enter your phone number.
   The worker requests a login code, Telegram sends it to your app, and you
   type it back on the dashboard. If you use two-step verification, enter that
   password on the dashboard too.
6. Once connected, the worker syncs your joined channels to the **Channels**
   page. Build forwarding rules by picking source/destination from dropdowns.
7. Keep it running (systemd, pm2, screen, Railway, Fly.io, a VPS, or a Raspberry Pi).

## Notes

- The Telegram session is stored **only on this machine** (`forwardflow_session`).
  Your phone number, code, and 2FA password are never stored in the dashboard.
- Source/destination identifiers can be `@username` or a numeric chat id.
- Automated forwarding may violate Telegram's Terms of Service. Use an account
  you're comfortable risking.

