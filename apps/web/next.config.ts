import type { NextConfig } from "next";

/**
 * STATIC_DEMO=1 builds a public, read-only demo: bundled synthetic fixtures, no backend
 * calls, no API proxy, no token and no role switcher. The proxy route is named
 * `route.proxy.ts` and is only a route when "proxy.ts" is a page extension, so the static
 * demo leaves it out of the build entirely.
 */
const staticDemo = process.env.STATIC_DEMO === "1";

/** Server-side settings that must never be present in the static demo's environment. */
export const SERVER_SECRET_VARIABLES = [
  "DEMO_API_TOKEN",
  "E2E_DEMO_TOKEN",
  "API_INTERNAL_URL",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_URL",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
] as const;

if (staticDemo) {
  const present = SERVER_SECRET_VARIABLES.filter((name) => process.env[name]);
  if (present.length)
    throw new Error(
      `Refusing to build or start the static demo while server-side settings are set: ${present.join(", ")}. Unset them and try again.`,
    );
}

const config: NextConfig = {
  pageExtensions: staticDemo ? ["tsx", "ts"] : ["proxy.ts", "tsx", "ts"],
  env: { NEXT_PUBLIC_STATIC_DEMO: staticDemo ? "1" : "" },
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
