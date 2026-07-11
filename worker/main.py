import asyncio
import os

import httpx
from dotenv import load_dotenv
from telethon import TelegramClient, events
from telethon.errors import RPCError, SessionPasswordNeededError

load_dotenv()

API_BASE_URL = os.environ["API_BASE_URL"].rstrip("/")
WORKER_TOKEN = os.environ["WORKER_TOKEN"]
TG_API_ID = int(os.environ["TG_API_ID"])
TG_API_HASH = os.environ["TG_API_HASH"]
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))
LOGIN_POLL_INTERVAL = int(os.environ.get("LOGIN_POLL_INTERVAL", "3"))

HEADERS = {"Authorization": f"Bearer {WORKER_TOKEN}"}

SESSION_PATH = os.environ.get("SESSION_PATH", "forwardflow_session")
client = TelegramClient(SESSION_PATH, TG_API_ID, TG_API_HASH)
http = httpx.AsyncClient(timeout=30)

# In-memory rule cache: { source_key: [rules] }
rules_by_source: dict[str, list[dict]] = {}
# Telegram login bookkeeping
login_ctx: dict = {"phone": None, "phone_code_hash": None}
forwarding_started = False
# Own account id, filled after login. Used to skip messages YOU send.
my_id: int | None = None


def normalize(entity: str) -> str:
    return str(entity).strip().lstrip("@").lower()


# ---------------------------------------------------------------------------
# Dashboard sync helpers
# ---------------------------------------------------------------------------
async def get_login_state() -> dict:
    try:
        r = await http.get(f"{API_BASE_URL}/api/public/worker/login-state", headers=HEADERS)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[login] state fetch failed: {e}")
        return {}


async def post_login_status(status: str, detail: str | None = None, pending_action=None):
    try:
        await http.post(
            f"{API_BASE_URL}/api/public/worker/login-status",
            headers=HEADERS,
            json={"status": status, "detail": detail, "pending_action": pending_action},
        )
    except Exception as e:
        print(f"[login] status post failed: {e}")


async def fetch_rules() -> list[dict]:
    try:
        r = await http.get(f"{API_BASE_URL}/api/public/worker/rules", headers=HEADERS)
        r.raise_for_status()
        return r.json().get("rules", [])
    except Exception as e:
        print(f"[rules] fetch failed: {e}")
        return []


async def post_log(rule_id, status, detail, ref=None):
    try:
        await http.post(
            f"{API_BASE_URL}/api/public/worker/logs",
            headers=HEADERS,
            json={"rule_id": rule_id, "status": status, "detail": detail, "source_msg_ref": ref},
        )
    except Exception as e:
        print(f"[log] post failed: {e}")


async def push_channels(channels: list[dict]):
    try:
        r = await http.post(
            f"{API_BASE_URL}/api/public/worker/channels",
            headers=HEADERS,
            json={"channels": channels},
        )
        r.raise_for_status()
        print(f"[channels] pushed {len(channels)} chat(s)")
    except Exception as e:
        print(f"[channels] push failed: {e}")


async def heartbeat():
    while True:
        try:
            await http.post(f"{API_BASE_URL}/api/public/worker/heartbeat", headers=HEADERS, json={})
        except Exception as e:
            print(f"[heartbeat] failed: {e}")
        await asyncio.sleep(60)


# ---------------------------------------------------------------------------
# Telegram login state machine (driven by the dashboard)
# ---------------------------------------------------------------------------
async def sync_channels():
    channels = []
    async for dialog in client.iter_dialogs():
        entity = dialog.entity
        if dialog.is_channel:
            broadcast = getattr(entity, "broadcast", False)
            kind = "channel" if broadcast else "group"
            can_post = (not broadcast) or bool(getattr(entity, "admin_rights", None)) or bool(getattr(entity, "creator", False))
        elif dialog.is_group:
            kind, can_post = "group", True
        elif getattr(entity, "bot", False):
            kind, can_post = "bot", True
        else:
            continue  # skip private user chats
        channels.append({
            "chat_id": str(dialog.id),
            "title": (dialog.name or "Untitled")[:256],
            "username": getattr(entity, "username", None),
            "kind": kind,
            "can_post": can_post,
        })
    await push_channels(channels)


async def handle_login(state: dict):
    action = state.get("pending_action")
    if not action:
        return

    if action == "request_code":
        phone = state.get("phone")
        if not phone:
            await post_login_status("error", "No phone number provided")
            return
        try:
            sent = await client.send_code_request(phone)
            login_ctx["phone"] = phone
            login_ctx["phone_code_hash"] = sent.phone_code_hash
            await post_login_status("awaiting_code")
            print("[login] code requested")
        except Exception as e:
            await post_login_status("error", str(e))

    elif action == "submit_code":
        code = state.get("code")
        try:
            await client.sign_in(
                phone=login_ctx.get("phone") or state.get("phone"),
                code=code,
                phone_code_hash=login_ctx.get("phone_code_hash"),
            )
            await post_login_status("logged_in")
            print("[login] signed in")
            await sync_channels()
        except SessionPasswordNeededError:
            await post_login_status("password_needed")
        except Exception as e:
            await post_login_status("error", str(e))

    elif action == "submit_password":
        password = state.get("two_fa_password")
        try:
            await client.sign_in(password=password)
            await post_login_status("logged_in")
            print("[login] signed in with 2FA")
            await sync_channels()
        except Exception as e:
            await post_login_status("error", str(e))

    elif action == "logout":
        try:
            await client.log_out()
        except Exception as e:
            print(f"[login] logout error: {e}")
        await post_login_status("logged_out")
        print("[login] logged out")


async def control_loop():
    """Continuously reconcile Telegram session with the dashboard's requests."""
    global forwarding_started, my_id
    while True:
        authorized = await client.is_user_authorized()
        state = await get_login_state()

        if not authorized:
            await handle_login(state)
        else:
            if my_id is None:
                try:
                    me = await client.get_me()
                    my_id = me.id
                    print(f"[worker] logged in as id={my_id}")
                except Exception as e:
                    print(f"[worker] get_me failed: {e}")
            action = state.get("pending_action")
            if action == "logout":
                await handle_login(state)
            elif action == "sync_channels":
                await post_login_status("logged_in")  # clears pending_action + secrets
                await sync_channels()
            elif state.get("status") != "logged_in":
                await post_login_status("logged_in")

            if not forwarding_started:
                forwarding_started = True
                asyncio.create_task(refresh_rules())
                print("[worker] forwarding active")

        await asyncio.sleep(LOGIN_POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Forwarding
# ---------------------------------------------------------------------------
async def refresh_rules():
    global rules_by_source
    while True:
        rules = await fetch_rules()
        grouped: dict[str, list[dict]] = {}
        for rule in rules:
            key = normalize(rule["source"])
            grouped.setdefault(key, []).append(rule)
        rules_by_source = grouped
        print(f"[rules] loaded {len(rules)} active rule(s)")
        await asyncio.sleep(POLL_INTERVAL)


def matches_filters(text: str, rule: dict) -> bool:
    text_l = (text or "").lower()
    include = [k.lower() for k in rule.get("include_keywords", [])]
    exclude = [k.lower() for k in rule.get("exclude_keywords", [])]
    if include and not any(k in text_l for k in include):
        return False
    if exclude and any(k in text_l for k in exclude):
        return False
    return True


def source_keys_for_chat(chat) -> list[str]:
    keys = []
    if getattr(chat, "username", None):
        keys.append(normalize(chat.username))
    if getattr(chat, "id", None) is not None:
        keys.append(normalize(chat.id))
        keys.append(normalize(f"-100{chat.id}"))
    return keys


def is_bot_chat(chat, matched_rules: list[dict]) -> bool:
    """True when the actual Telegram source is a bot chat.

    Older/manual rules may have source_type saved as "channel", so do not rely
    only on the dashboard value. The Telegram entity itself is the safest signal.
    """
    return bool(getattr(chat, "bot", False)) or any(
        rule.get("source_type") == "bot" for rule in matched_rules
    )


async def is_message_from_me(event) -> bool:
    """Detect messages sent by the logged-in account.

    In bot PMs Telethon may surface sent-message updates slightly differently,
    so check the event flags first, then compare sender id as a fallback.
    """
    if bool(getattr(event, "out", False)) or bool(getattr(event.message, "out", False)):
        return True

    sender_id = getattr(event.message, "sender_id", None)
    if my_id is not None and sender_id == my_id:
        return True

    try:
        sender = await event.get_sender()
        if my_id is not None and getattr(sender, "id", None) == my_id:
            return True
    except Exception:
        pass

    return False


@client.on(events.NewMessage())
async def on_message(event):
    chat = await event.get_chat()
    keys = source_keys_for_chat(chat)
    matched = []
    for k in keys:
        matched.extend(rules_by_source.get(k, []))
    if not matched:
        return

    bot_source = is_bot_chat(chat, matched)
    is_from_me = await is_message_from_me(event)

    # In bot chats, the message you type is also a NewMessage update. It must
    # never be forwarded; only the incoming bot response should be forwarded.
    if bot_source and is_from_me:
        print(f"[skip] user message to bot: {getattr(event.message, 'id', '')}")
        return

    for rule in matched:
        text = event.message.message or ""
        if not matches_filters(text, rule):
            await post_log(rule["id"], "skipped", "filtered out by keywords", str(event.message.id))
            continue

        try:
            dest = rule["destination"]
            entity = dest if dest.startswith("@") else int(dest) if dest.lstrip("-").isdigit() else dest
            await client.send_message(entity, event.message)
            await post_log(rule["id"], "forwarded", f"to {dest}", str(event.message.id))
            print(f"[fwd] {rule['source']} -> {dest}")
        except (RPCError, Exception) as e:
            await post_log(rule["id"], "error", str(e), str(event.message.id))
            print(f"[fwd] error: {e}")


async def main():
    await client.connect()
    print(f"[worker] connected, syncing with {API_BASE_URL}")
    asyncio.create_task(heartbeat())
    asyncio.create_task(control_loop())
    # Stay alive without calling run_until_disconnected(), which would issue an
    # authenticated request and crash before the account is logged in. The
    # control loop drives login from the dashboard; once authorized, Telethon
    # delivers NewMessage updates over the live connection.
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())
