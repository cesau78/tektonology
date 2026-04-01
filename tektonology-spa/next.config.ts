import { readFileSync } from "fs";
import { resolve } from "path";
import type { NextConfig } from "next";

/** Load vars from root .env.local and map to NEXT_PUBLIC_* at build time. */
function loadRootEnv(): Record<string, string> {
  const raw: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(process.cwd(), "../.env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      raw[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // file missing — rely on real env vars (CI/CD)
  }

  const mapped: Record<string, string> = {
    NEXT_PUBLIC_AUTH0_DOMAIN: raw.AUTH0_DOMAIN ?? "",
    NEXT_PUBLIC_AUTH0_CLIENT_ID: raw.AUTH0_CLIENT_ID ?? "",
    NEXT_PUBLIC_AUTH0_AUDIENCE: raw.AUTH0_AUDIENCE ?? "",
    NEXT_PUBLIC_FINOPS_API_URL: raw.FINOPS_API_URL ?? `http://localhost:${raw.API_PORT ?? "3001"}`,
  };

  // Also inject into process.env so next dev picks them up for client components
  for (const [key, value] of Object.entries(mapped)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  return mapped;
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  env: loadRootEnv(),
};

export default nextConfig;
