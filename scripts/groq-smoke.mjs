import { loadEnvFile } from "node:process";
import { spawnSync } from "node:child_process";
try {
  loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT")
    throw new Error(
      "Could not load the local server environment. Details suppressed.",
    );
}
if (!process.env.GROQ_API_KEY) {
  console.log("SKIPPED: GROQ_API_KEY is not configured.");
  process.exit(0);
}
const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "server/groq.live.test.ts"],
  { stdio: "inherit", env: { ...process.env, THREADZERO_GROQ_LIVE: "1" } },
);
process.exit(result.status ?? 1);
