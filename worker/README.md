# ForwardFlow Worker

The forwarding engine. It logs into Telegram with **your personal account**
(a "userbot") so it can read any channel you can see — no bot admin needed in
source channels. It pulls forwarding rules from your ForwardFlow dashboard and
mirrors new messages to the destinations you configured.

## Setup

1. Get `API_ID` and `API_HASH` from https://my.telegram.org → API development tools.
2. Generate a **worker token** on the dashboard's Worker page.
3. Copy `.env.example` to `.env` and fill in the values.
4. Install and run:

   ```bash
   pip install -r requirements.txt
   python main.py
   ```

5. On first run, complete the one-time phone-number login.
6. Keep it running (systemd, pm2, screen, Railway, Fly.io, a VPS, or a Raspberry Pi).

## Notes

- Source/destination identifiers can be `@username` or a numeric chat id
  (e.g. `-1001234567890`).
- Automated forwarding may violate Telegram's Terms of Service. Use an account
  you're comfortable risking.
