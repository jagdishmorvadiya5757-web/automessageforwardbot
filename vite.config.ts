// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const oracleCorsCompatibilityPlugin = {
  name: "oracle-cors-compatibility",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (!id.replaceAll("\\", "/").endsWith("/src/integrations/supabase/client.ts")) return null;

    const fetchCall = "headers.set('apikey', supabaseKey);\n    return fetch(input, { ...init, headers });";
    if (!code.includes(fetchCall)) return null;

    return code.replace(
      fetchCall,
      "headers.set('apikey', supabaseKey);\n    // The self-hosted Oracle gateway does not accept this newer optional header.\n    headers.delete('x-supabase-api-version');\n    return fetch(input, { ...init, headers });",
    );
  },
};

// Self-hosted backend (Oracle VM) — overrides the managed Cloud values in .env.
const ORACLE_SUPABASE_URL = "/api/public/oracle";
const ORACLE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg2Njc3MDI5LCJleHAiOjIxMDIwMzcwMjl9.opLVy21IydwNWp6-VnfFZUuybiwKEJYk_cIp7V2qXKI";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [oracleCorsCompatibilityPlugin],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(ORACLE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(ORACLE_SUPABASE_ANON_KEY),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(ORACLE_SUPABASE_ANON_KEY),
    },
  },
});

