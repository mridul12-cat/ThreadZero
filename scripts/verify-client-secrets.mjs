import { loadEnv } from "vite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const env = loadEnv("production", process.cwd(), ["GROQ_", "UPSTASH_"]);
const secrets = [env.GROQ_API_KEY, env.UPSTASH_REDIS_REST_TOKEN].filter(
  Boolean,
);
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else {
      const bytes = await readFile(file);
      if (
        secrets.some((value) => bytes.includes(Buffer.from(value))) ||
        /GROQ_API_KEY|UPSTASH_REDIS_REST_TOKEN|api\.groq\.com/.test(
          bytes.toString("utf8"),
        )
      )
        throw new Error(
          "A server-only credential or integration reference was found in the client output. Details suppressed.",
        );
    }
  }
}
await scan("dist");
console.log(
  "PASS: browser output contains no configured credentials, server credential names, or Groq provider endpoint.",
);
