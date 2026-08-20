"""ForwardFlow multi-user worker (v10).

One process runs many Telegram accounts. Each signed-up user with an active
subscription and a saved Telegram session gets a dedicated TelegramClient.
The worker is stateless across restarts: sessions live in the DB (encrypted)
and are pulled on-demand.

Auth model: the worker holds one WORKER_TOKEN (master token). Every API
call carries an `X-User-Id` header to tell the backend which user the call
is acting for.
"""
from __future__ import annotations

import asyncio
import os
from typing import Optional

import httpx
from dotenv import load_dotenv
from telethon import TelegramClient, events
from telethon.errors import FloodWaitError, RPCError, SessionPasswordNeededError
from telethon.sessions import StringSession

load_dotenv()

API_BASE_URL = os.environ["API_BASE_URL"].rstrip("/")
WORKER_TOKEN = os.environ["WORKER_TOKEN"]  # this is now the MASTER token
TG_API_ID = int(os.environ["TG_API_ID"])
TG_API_HASH = os.environ["TG_API_HASH"]
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))
LOGIN_POLL_INTERVAL = int(os.environ.get("LOGIN_POLL_INTERVAL", "3"))
USERS_POLL_INTERVAL = int(os.environ.get("USERS_POLL_INTERVAL", "5"))
IDLE_POLL_INTERVAL = int(os.environ.get("IDLE_POLL_INTERVAL", "30"))
SPAWN_CONCURRENCY = int(os.environ.get("SPAWN_CONCURRENCY", "5"))
SPAWN_GAP = float(os.environ.get("SPAWN_GAP", "0.4"))
FORWARD_DELAY = float(os.environ.get("FORWARD_DELAY", "0"))
FLOOD_WAIT_EXTRA = float(os.environ.get("FLOOD_WAIT_EXTRA", "3"))

BASE_HEADERS = {"Authorization": f"Bearer {WORKER_TOKEN}"}
WORKER_VERSION = "2026-08-20-multiuser-v12"

http = httpx.AsyncClient(timeout=30)


def user_headers(user_id: str) -> dict:
    return {**BASE_HEADERS, "X-User-Id": user_id}


def normalize(entity: str) -> str:
    return str(entity).strip().lstrip("@").lower()


# ---------------------------------------------------------------------------
# Per-user runtime state
# ---------------------------------------------------------------------------
class UserRuntime:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.client: Optional[TelegramClient] = None
        self.rules_by_source: dict[str, list[dict]] = {}
        self.my_id: Optional[int] = None
        self.forward_queue: "asyncio.Queue[dict]" = asyncio.Queue()
        self.login_ctx: dict = {"phone": None, "phone_code_hash": None}
        self.forwarding_started = False
        self.pending = True  # supervisor flips this from the /users payload
        self._tasks: list[asyncio.Task] = []

    async def close(self):
        for t in self._tasks:
            t.cancel()
        if self.client:
            try:
                await self.client.disconnect()
            except Exception:
                pass


users: dict[str, UserRuntime] = {}


# ---------------------------------------------------------------------------
# API helpers (all user-scoped)
# ---------------------------------------------------------------------------
async def api_get(path: str, user_id: Optional[str] = None) -> Optional[dict]:
    try:
        headers = user_headers(user_id) if user_id else BASE_HEADERS
        r = await http.get(f"{API_BASE_URL}{path}", headers=headers)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[api] GET {path} failed: {e}")
        return None


async def api_post(path: str, user_id: Optional[str], body: dict) -> Optional[dict]:
    try:
        headers = user_headers(user_id) if user_id else BASE_HEADERS
        r = await http.post(f"{API_BASE_URL}{path}", headers=headers, json=body)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[api] POST {path} failed: {e}")
        return None


async def api_delete(path: str, user_id: str) -> Optional[dict]:
    try:
        r = await http.request(
            "DELETE", f"{API_BASE_URL}{path}", headers=user_headers(user_id)
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[api] DELETE {path} failed: {e}")
        return None


async def post_log(user_id: str, rule_id, status, detail, ref=None):
    await api_post(
        "/api/public/worker/logs",
        user_id,
        {"rule_id": rule_id, "status": status, "detail": detail, "source_msg_ref": ref},
    )


async def post_login_status(
    user_id: str,
    status: str,
    detail: str | None = None,
    pending_action=None,
    phone_code_hash: str | None = None,
):
    body = {"status": status, "detail": detail, "pending_action": pending_action}
    if phone_code_hash is not None:
        body["phone_code_hash"] = phone_code_hash
    await api_post(
        "/api/public/worker/login-status",
        user_id,
        body,
    )


async def reserve_forwarding_slot(user_id: str, rule_id: str) -> dict:
    result = await api_post(
        "/api/public/worker/forward-slots",
        user_id,
        {"rule_id": rule_id, "action": "reserve"},
    )
    if not result:
        return {"allowed": False}
    return result.get("result") or {"allowed": False}


async def release_forwarding_slot(user_id: str, rule_id: str):
    await api_post(
        "/api/public/worker/forward-slots",
        user_id,
        {"rule_id": rule_id, "action": "release"},
    )


async def push_channels(user_id: str, channels: list[dict]):
    await api_post("/api/public/worker/channels", user_id, {"channels": channels})


async def save_session(user_id: str, session_string: str, phone: Optional[str]):
    await api_post(
        "/api/public/worker/session",
        user_id,
        {"session_string": session_string, "phone": phone or ""},
    )


async def load_session(user_id: str) -> tuple[Optional[str], Optional[str], str]:
    data = await api_get("/api/public/worker/session", user_id)
    if not data:
        return None, None, "logged_out"
    return data.get("session_string"), data.get("phone"), data.get("status", "logged_out")


async def clear_session(user_id: str):
    await api_delete("/api/public/worker/session", user_id)


# ---------------------------------------------------------------------------
# Per-user Telegram plumbing
# ---------------------------------------------------------------------------
async def sync_channels(rt: UserRuntime):
    if not rt.client:
        return
    channels = []
    async for dialog in rt.client.iter_dialogs():
        entity = dialog.entity
        if dialog.is_channel:
            broadcast = getattr(entity, "broadcast", False)
            kind = "channel" if broadcast else "group"
            can_post = (not broadcast) or bool(getattr(entity, "admin_rights", None)) or bool(
                getattr(entity, "creator", False)
            )
        elif dialog.is_group:
            kind, can_post = "group", True
        elif getattr(entity, "bot", False):
            kind, can_post = "bot", True
        else:
            continue
        channels.append({
            "chat_id": str(dialog.id),
            "title": (dialog.name or "Untitled")[:256],
            "username": getattr(entity, "username", None),
            "kind": kind,
            "can_post": can_post,
        })
    await push_channels(rt.user_id, channels)


async def handle_login(rt: UserRuntime, state: dict):
    action = state.get("pending_action")
    if not action:
        return

    if action == "request_code":
        phone = state.get("phone")
        if not phone:
            await post_login_status(rt.user_id, "error", "No phone provided")
            return
        try:
            sent = await rt.client.send_code_request(phone)
            rt.login_ctx["phone"] = phone
            rt.login_ctx["phone_code_hash"] = sent.phone_code_hash
            await post_login_status(rt.user_id, "awaiting_code", phone_code_hash=sent.phone_code_hash)
        except Exception as e:
            await post_login_status(rt.user_id, "error", str(e))

    elif action == "submit_code":
        code = state.get("code")
        phone_code_hash = rt.login_ctx.get("phone_code_hash") or state.get("phone_code_hash")
        phone = rt.login_ctx.get("phone") or state.get("phone")
        if not phone_code_hash:
            await post_login_status(
                rt.user_id,
                "error",
                "OTP session expired. Press Send code again, then enter the new code.",
            )
            return
        try:
            await rt.client.sign_in(
                phone=phone,
                code=code,
                phone_code_hash=phone_code_hash,
            )
            session_string = rt.client.session.save()
            await save_session(rt.user_id, session_string, phone)
            await post_login_status(rt.user_id, "logged_in")
            await sync_channels(rt)
        except SessionPasswordNeededError:
            await post_login_status(rt.user_id, "password_needed")
        except Exception as e:
            await post_login_status(rt.user_id, "error", str(e))

    elif action == "submit_password":
        password = state.get("two_fa_password")
        try:
            await rt.client.sign_in(password=password)
            session_string = rt.client.session.save()
            await save_session(rt.user_id, session_string, rt.login_ctx.get("phone"))
            await post_login_status(rt.user_id, "logged_in")
            await sync_channels(rt)
        except Exception as e:
            await post_login_status(rt.user_id, "error", str(e))

    elif action == "logout":
        try:
            await rt.client.log_out()
        except Exception:
            pass
        await clear_session(rt.user_id)
        await post_login_status(rt.user_id, "logged_out")


async def control_loop_for(rt: UserRuntime):
    """Login state machine + rule polling for one user."""
    while True:
        try:
            authorized = await rt.client.is_user_authorized()
            state = await api_get("/api/public/worker/login-state", rt.user_id) or {}

            if not authorized:
                await handle_login(rt, state)
            else:
                if rt.my_id is None:
                    try:
                        me = await rt.client.get_me()
                        rt.my_id = me.id
                        print(f"[{rt.user_id[:8]}] logged in as id={rt.my_id}")
                    except Exception as e:
                        print(f"[{rt.user_id[:8]}] get_me failed: {e}")

                action = state.get("pending_action")
                if action == "logout":
                    await handle_login(rt, state)
                    return  # runtime will be reaped by supervisor
                elif action == "sync_channels":
                    await post_login_status(rt.user_id, "logged_in")
                    await sync_channels(rt)
                elif state.get("status") != "logged_in":
                    await post_login_status(rt.user_id, "logged_in")

                if not rt.forwarding_started:
                    rt.forwarding_started = True
                    rt._tasks.append(asyncio.create_task(refresh_rules(rt)))
                    rt._tasks.append(asyncio.create_task(forward_worker(rt)))
                    print(f"[{rt.user_id[:8]}] forwarding active")
        except Exception as e:
            print(f"[{rt.user_id[:8]}] control loop error: {e}")

        # Fast polling only while something is pending (login / logout / sync).
        # Idle logged-in users poll slowly so 500 users don't hammer the API.
        await asyncio.sleep(LOGIN_POLL_INTERVAL if rt.pending else IDLE_POLL_INTERVAL)


async def refresh_rules(rt: UserRuntime):
    while True:
        data = await api_get("/api/public/worker/rules", rt.user_id) or {}
        rules = data.get("rules", [])
        grouped: dict[str, list[dict]] = {}
        for rule in rules:
            key = normalize(rule["source"])
            grouped.setdefault(key, []).append(rule)
        rt.rules_by_source = grouped
        await asyncio.sleep(POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Message filtering / forwarding
# ---------------------------------------------------------------------------
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


def peer_id_value(peer) -> Optional[int]:
    if peer is None:
        return None
    for attr in ("user_id", "channel_id", "chat_id", "id"):
        value = getattr(peer, attr, None)
        if value is not None:
            try:
                return int(value)
            except (TypeError, ValueError):
                return None
    try:
        return int(peer)
    except (TypeError, ValueError):
        return None


def same_user_id(value, expected: Optional[int]) -> bool:
    if value is None or expected is None:
        return False
    try:
        return abs(int(value)) == abs(int(expected))
    except (TypeError, ValueError):
        return False


def is_bot_chat(chat, matched_rules: list[dict]) -> bool:
    return bool(getattr(chat, "bot", False)) or any(
        rule.get("source_type") == "bot" for rule in matched_rules
    )


def message_sender_id(event) -> Optional[int]:
    message = event.message
    sender_id = getattr(event, "sender_id", None) or getattr(message, "sender_id", None)
    if sender_id is not None:
        try:
            return int(sender_id)
        except (TypeError, ValueError):
            return None
    return peer_id_value(getattr(message, "from_id", None))


async def is_message_from_me(event, my_id: Optional[int]) -> bool:
    message = event.message
    original_update = getattr(event, "original_update", None)
    if (
        bool(getattr(event, "out", False))
        or bool(getattr(message, "out", False))
        or bool(getattr(original_update, "out", False))
    ):
        return True
    sender_id = getattr(event, "sender_id", None) or getattr(message, "sender_id", None)
    if same_user_id(sender_id, my_id):
        return True
    from_id = peer_id_value(getattr(message, "from_id", None))
    if same_user_id(from_id, my_id):
        return True
    try:
        sender = await event.get_sender()
        if same_user_id(getattr(sender, "id", None), my_id):
            return True
    except Exception:
        pass
    return False


def make_message_handler(rt: UserRuntime):
    async def on_message(event):
        chat = await event.get_chat()
        keys = source_keys_for_chat(chat)
        matched = []
        for k in keys:
            matched.extend(rt.rules_by_source.get(k, []))
        if not matched:
            return

        is_from_me = await is_message_from_me(event, rt.my_id)
        bot_source = is_bot_chat(chat, matched)

        if bot_source and not same_user_id(message_sender_id(event), getattr(chat, "id", None)):
            return
        if is_from_me:
            return

        for rule in matched:
            text = event.message.message or ""
            if not matches_filters(text, rule):
                await post_log(rt.user_id, rule["id"], "skipped", "filtered by keywords", str(event.message.id))
                continue

            slot = await reserve_forwarding_slot(rt.user_id, rule["id"])
            if not slot.get("allowed"):
                detail = "limit reached; rule off" if slot.get("disabled") else "disabled or limit reached"
                await post_log(rt.user_id, rule["id"], "skipped", detail, str(event.message.id))
                continue

            await rt.forward_queue.put({
                "rule_id": rule["id"],
                "source": rule["source"],
                "destination": rule["destination"],
                "text": text,
                "message": event.message,
                "msg_ref": str(event.message.id),
                "delay": rule.get("forward_delay") or 0,
            })
    return on_message


async def forward_worker(rt: UserRuntime):
    while True:
        job = await rt.forward_queue.get()
        dest = job["destination"]
        try:
            entity = dest if dest.startswith("@") else int(dest) if dest.lstrip("-").isdigit() else dest
        except Exception:
            entity = dest

        try:
            rule_delay = float(job.get("delay") or 0)
        except (TypeError, ValueError):
            rule_delay = 0.0
        delay = rule_delay if rule_delay > 0 else FORWARD_DELAY

        while True:
            try:
                message = job.get("message")
                media = getattr(message, "media", None) if message else None
                if media is not None:
                    await rt.client.send_file(entity, file=media, caption=job["text"] or "")
                else:
                    await rt.client.send_message(entity, job["text"])
                await post_log(rt.user_id, job["rule_id"], "forwarded", f"to {dest}", job["msg_ref"])
                break
            except FloodWaitError as e:
                wait = float(getattr(e, "seconds", 0)) + FLOOD_WAIT_EXTRA
                await post_log(rt.user_id, job["rule_id"], "waiting", f"flood limit, retry {int(wait)}s", job["msg_ref"])
                await asyncio.sleep(wait)
            except (RPCError, Exception) as e:
                await release_forwarding_slot(rt.user_id, job["rule_id"])
                await post_log(rt.user_id, job["rule_id"], "error", str(e), job["msg_ref"])
                break

        rt.forward_queue.task_done()
        if delay > 0:
            await post_log(rt.user_id, job["rule_id"], "waiting", f"delaying {delay}s", job["msg_ref"])
            await asyncio.sleep(delay)


# ---------------------------------------------------------------------------
# Supervisor: adds/removes UserRuntimes based on the API's active-user list.
# ---------------------------------------------------------------------------
async def spawn_user(user_id: str):
    """Create a runtime + connected TelegramClient for one user."""
    session_str, phone, _status = await load_session(user_id)
    tg_session = StringSession(session_str) if session_str else StringSession()

    client = TelegramClient(tg_session, TG_API_ID, TG_API_HASH)
    await client.connect()

    rt = UserRuntime(user_id)
    rt.client = client
    rt.pending = True
    rt.login_ctx["phone"] = phone
    client.add_event_handler(make_message_handler(rt), events.NewMessage(incoming=True))
    users[user_id] = rt

    # control loop drives login + starts forwarding tasks once authorized
    rt._tasks.append(asyncio.create_task(control_loop_for(rt)))
    print(f"[supervisor] spawned user {user_id[:8]}")


async def reap_user(user_id: str):
    rt = users.pop(user_id, None)
    if rt:
        await rt.close()
        print(f"[supervisor] reaped user {user_id[:8]}")


async def supervisor():
    """Sync the local `users` dict with the API's active-user list."""
    while True:
        data = await api_get("/api/public/worker/users") or {}
        entries = data.get("users", [])
        wanted = {u["user_id"]: bool(u.get("pending", True)) for u in entries}

        for uid in list(users.keys()):
            if uid not in wanted:
                await reap_user(uid)

        # Keep each runtime's poll cadence in sync with the API view.
        for uid, pending in wanted.items():
            rt = users.get(uid)
            if rt:
                rt.pending = pending

        missing = [uid for uid in wanted if uid not in users]
        if missing:
            sem = asyncio.Semaphore(SPAWN_CONCURRENCY)

            async def spawn_guarded(uid: str, index: int):
                # Stagger connects so a restart with hundreds of users does not
                # open every Telegram socket in the same instant.
                await asyncio.sleep(index * SPAWN_GAP)
                async with sem:
                    try:
                        await spawn_user(uid)
                    except Exception as e:
                        print(f"[supervisor] spawn failed {uid[:8]}: {e}")

            await asyncio.gather(
                *(spawn_guarded(uid, i) for i, uid in enumerate(missing))
            )

        await asyncio.sleep(USERS_POLL_INTERVAL)


async def heartbeat():
    while True:
        try:
            any_user = next(iter(users), None)
            headers = user_headers(any_user) if any_user else BASE_HEADERS
            await http.post(
                f"{API_BASE_URL}/api/public/worker/heartbeat",
                headers=headers,
                json={},
            )
        except Exception as e:
            print(f"[heartbeat] {e}")
        await asyncio.sleep(60)


async def main():
    print(f"[worker] version {WORKER_VERSION}")
    print(f"[worker] connected, syncing with {API_BASE_URL}")
    asyncio.create_task(heartbeat())
    asyncio.create_task(supervisor())
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())
