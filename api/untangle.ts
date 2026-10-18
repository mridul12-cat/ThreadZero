import type { IncomingMessage, ServerResponse } from "node:http";
import { createUntangleService } from "../server/untangle";
export const config = { maxDuration: 30 };
const service = createUntangleService(process.env, {
  requireDistributed: true,
});
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  try {
    let body: string | undefined;
    if (req.method === "POST") {
      if (req.body !== undefined)
        body =
          typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      else {
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of req) {
          const part = Buffer.from(chunk);
          bytes += part.length;
          if (bytes > 12000) {
            res.writeHead(413, {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            });
            res.end(JSON.stringify({ error: "Request is too large." }));
            return;
          }
          chunks.push(part);
        }
        body = Buffer.concat(chunks).toString("utf8");
      }
      if (Buffer.byteLength(body ?? "") > 12000) {
        res.writeHead(413, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify({ error: "Request is too large." }));
        return;
      }
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value !== undefined)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    const response = await service(
      new Request(`https://${req.headers.host ?? "localhost"}/api/untangle`, {
        method: req.method,
        headers,
        body,
      }),
    );
    res.writeHead(
      response.status,
      Object.fromEntries(response.headers.entries()),
    );
    res.end(await response.text());
  } catch {
    res.writeHead(500, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        error: "Magic Untangle is unavailable. Use the local parser.",
      }),
    );
  }
}
