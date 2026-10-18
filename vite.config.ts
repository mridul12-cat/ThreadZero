import { loadEnv } from "vite";
import { createUntangleService } from "./server/untangle";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "threadzero-local-api",
      configureServer(server) {
        const env = loadEnv(server.config.mode, server.config.root, [
          "GROQ_",
          "UPSTASH_",
        ]);
        const handle = createUntangleService(env);
        server.middlewares.use("/api/untangle", async (req, res) => {
          try {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of req) {
              const part = Buffer.from(chunk);
              size += part.length;
              if (size > 12000) {
                res.statusCode = 413;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Request is too large." }));
                return;
              }
              chunks.push(part);
            }
            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers))
              if (value !== undefined)
                headers.set(
                  key,
                  Array.isArray(value) ? value.join(",") : value,
                );
            const response = await handle(
              new Request(`http://${req.headers.host}/api/untangle`, {
                method: req.method,
                headers,
                body:
                  req.method === "POST"
                    ? Buffer.concat(chunks).toString("utf8")
                    : undefined,
              }),
            );
            res.writeHead(
              response.status,
              Object.fromEntries(response.headers.entries()),
            );
            res.end(await response.text());
          } catch {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: "Magic Untangle is unavailable. Use the local parser.",
              }),
            );
          }
        });
      },
    },
  ],
  worker: { format: "es" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
    setupFiles: ["./src/tests/setup.ts"],
  },
});
