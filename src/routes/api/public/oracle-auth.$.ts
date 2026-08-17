import { createFileRoute } from "@tanstack/react-router";

const ORACLE_AUTH_URL = "https://automessagebot.duckdns.org/auth/v1";

async function proxyAuth(request: Request) {
  const requestUrl = new URL(request.url);
  const marker = "/api/public/oracle-auth";
  const markerIndex = requestUrl.pathname.indexOf(marker);
  const suffix = markerIndex >= 0 ? requestUrl.pathname.slice(markerIndex + marker.length) : "";
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
  } catch {
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