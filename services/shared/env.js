import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return; // file doesn't exist — skip silently
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // Don't overwrite — first file loaded wins
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// Load local .env first (service-specific, takes priority)
loadEnv(path.resolve(process.cwd(), ".env"));

// Then load root .env (shared vars fill in gaps)
loadEnv(path.resolve(__dirname, "../../.env"));
