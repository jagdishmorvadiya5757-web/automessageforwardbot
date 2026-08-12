#!/usr/bin/env python3
"""Generate the anon + service_role API keys from your JWT_SECRET.

Usage (on the VM):
    python3 gen-keys.py "<JWT_SECRET>"

These are standard HS256 JWTs — exactly what supabase-js expects as the
publishable (anon) key and the service role key.
"""
import base64
import hashlib
import hmac
import json
import sys
import time


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_token(secret: str, role: str, years: int = 10) -> str:
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    now = int(time.time())
    payload = b64(
        json.dumps(
            {"role": role, "iss": "supabase", "iat": now, "exp": now + years * 365 * 24 * 3600},
            separators=(",", ":"),
        ).encode()
    )
    signing_input = f"{header}.{payload}".encode()
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{b64(sig)}"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(1)
    secret = sys.argv[1]
    print("ANON_KEY (public, safe in frontend):\n" + make_token(secret, "anon") + "\n")
    print("SERVICE_ROLE_KEY (SECRET, server only):\n" + make_token(secret, "service_role"))
