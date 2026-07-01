import asyncio
import os
import time

import httpx
from dotenv import load_dotenv
from telethon import TelegramClient, events
from telethon.errors import RPCError

load_dotenv()

API_BASE_URL = os.environ["API_BASE_URL"].rstrip("/")
WORKER_TOKEN = os.environ["WORKER_TOKEN"]
TG_API_ID = int(os.environ["TG_API_ID"])
TG_API_HASH = os.environ["TG_API_HASH"]
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))

HEADERS = {"Authorization": f"Bearer {WORKER_TOKEN}"}

client = TelegramClient("forwardflow_session", TG_API_ID, TG_API_HASH)
http = httpx.AsyncClient(timeout=30)

# In-memory rule cache: { source_key: [rules] }
rules_by_source: dict[str, list[dict]] = {}


def normalize(entity: str) -> str:
    """Normalize a source identifier for matching."""
    return str(entity).strip().lstrip("@").lower()


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


async def heartbeat():
    while True:
        try:
            await http.post(f"{API_BASE_URL}/api/public/worker/heartbeat", headers=HEADERS, json={})
        except Exception as e:
            print(f"[heartbeat] failed: {e}")
        await asyncio.sleep(60)


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


@client.on(events.NewMessage())
async def on_message(event):
    chat = await event.get_chat()
    keys = source_keys_for_chat(chat)
    matched = []
    for k in keys:
        matched.extend(rules_by_source.get(k, []))
    if not matched:
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
        except RPCError as e:
            await post_log(rule["id"], "error", str(e), str(event.message.id))
            print(f"[fwd] error: {e}")
        except Exception as e:
            await post_log(rule["id"], "error", str(e), str(event.message.id))
            print(f"[fwd] error: {e}")


async def main():
    await client.start()
    print("[tg] logged in")
    asyncio.create_task(refresh_rules())
    asyncio.create_task(heartbeat())
    print(f"[worker] running, syncing with {API_BASE_URL}")
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
