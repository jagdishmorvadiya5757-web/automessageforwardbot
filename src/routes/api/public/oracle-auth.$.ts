import { createFileRoute } from "@tanstack/react-router";
import {
  buildUserSession,
  identityFromRefreshToken,
  verifySupabaseJwt,
} from "@/lib/direct-auth.server";

const ORACLE_AUTH_URL = "https://automessagebot.duckdns.org/auth/v1";

/**
 * Serves session endpoints for direct (admin + phone) logins locally, so the
 * dashboard keeps working while the upstream auth service is unavailable.
 */
async function handleDirectSession(
  request: Request,
  suffix: string,
  search: string,
): Promise<Response | null> {
  const secret = process.env['ORACLE_JWT_SECRET'];
  if (!secret) return null;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (suffix === "/user" && token) {
    const c = verifySupabaseJwt(token, secret) as Record<string, unknown> | null;
    if (c?.sub) {
      const meta = (c.user_metadata as { display_name?: string } | undefined) ?? {};
      return Response.json(
        buildUserSession(
          {
            userId: c.sub as string,
            email: (c.email as string) || undefined,
            phone: (c.phone as string) || undefined,
            name: meta.display_name,
          },
          secret,
        ).user,
      );
    }
  }
  if (suffix === "/logout") {
    return new Response(null, { status: 204 });
  }
  if (suffix === "/token" && new URLSearchParams(search).get("grant_type") === "refresh_token") {
    const body = (await request.clone().json().catch(() => null)) as { refresh_token?: string } | null;
    const id = body?.refresh_token ? identityFromRefreshToken(body.refresh_token, secret) : null;
    if (!id) {
      return Response.json(
        { error: "invalid_grant", error_description: "Session expired. Please sign in again." },
        { status: 400 },
      );
    }
    return Response.json(buildUserSession(id, secret));
  }
  return null;
}

async function proxyAuth(request: Request) {
  const requestUrl = new URL(request.url);
  const marker = "/api/public/oracle-auth";
  const markerIndex = requestUrl.pathname.indexOf(marker);
  const suffix = markerIndex >= 0 ? requestUrl.pathname.slice(markerIndex + marker.length) : "";

  const local = await handleDirectSession(request, suffix, requestUrl.search);
  if (local) return local;

  const targetUrl = `${ORACLE_AUTH_URL}${suffix}${requestUrl.search}`;

  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("origin");
  headers.delete("referer");
  headers.delete("x-supabase-api-version");

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
    });
  } catch (error) {
    console.error("Oracle authentication upstream is unreachable", {
      method: request.method,
      path: suffix,
      error: error instanceof Error ? error.message : "Unknown network error",
    });
    return Response.json(
      { message: "Authentication service is temporarily offline. Please try again shortly." },
      { status: 503 },
    );
  }
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("access-control-allow-origin");
  responseHeaders.delete("access-control-allow-credentials");
  responseHeaders.delete("access-control-allow-headers");
  responseHeaders.delete("access-control-allow-methods");

  if (upstream.status >= 500) {
    console.error("Oracle authentication upstream failed", {
      method: request.method,
      path: suffix,
      status: upstream.status,
    });

    const contentType = responseHeaders.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return Response.json(
        {
          code: upstream.status,
          error_code: "authentication_service_error",
          msg: "Authentication service is temporarily unavailable. Please try again shortly.",
        },
        { status: upstream.status },
      );
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/api/public/oracle-auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyAuth(request),
      POST: ({ request }) => proxyAuth(request),
      PUT: ({ request }) => proxyAuth(request),
      PATCH: ({ request }) => proxyAuth(request),
      DELETE: ({ request }) => proxyAuth(request),
    },
  },
});