// Server-only helpers for authenticating the external worker via its token.
import { createHash } from "crypto";

export async function resolveWorkerUser(
  request: Request,
): Promise<{ userId: string } | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const pepper = process.env.WORKER_TOKEN_PEPPER;
  if (!pepper) return null;
  const tokenHash = createHash("sha256").update(pepper + token).digest("hex");

  const { supabaseAdmin } = await import("./client.server");
  const { data } = await supabaseAdmin
    .from("worker_tokens")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  return data ? { userId: data.user_id } : null;
}
