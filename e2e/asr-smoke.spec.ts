import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";
// Opt-in real model inference using synthetic audio, without a physical microphone.
test("real local Whisper inference from synthetic audio", async ({
  page,
}, info) => {
  test.skip(
    !process.env.THREADZERO_ASR_SMOKE || info.project.name !== "desktop",
    "Opt-in model download smoke test",
  );
  test.setTimeout(300000);
  const uploads: string[] = [];
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH"].includes(r.method())) uploads.push(r.url());
  });
  await page.route("**/synthetic-speech.wav", (route) =>
    route.fulfill({
      path:
        process.env.THREADZERO_AUDIO_FIXTURE || "e2e/fixtures/local-speech.wav",
      contentType: "audio/wav",
    }),
  );
  await page.goto("/");
  const workerPath =
    "/assets/" +
    readdirSync("dist/assets").find(
      (n) => n.startsWith("asr.worker-") && n.endsWith(".js"),
    );
  const text = await page.evaluate(async (workerPath) => {
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(
      await (await fetch("/synthetic-speech.wav")).arrayBuffer(),
    );
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * 16000),
      16000,
    );
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const audio = (await offline.startRendering()).getChannelData(0).slice();
    await ctx.close();
    const worker = new Worker(workerPath, { type: "module" });
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Real model smoke test timed out"));
      }, 240000);
      worker.onmessage = (e) => {
        if (e.data.type === "progress") console.log("LOCAL ASR:", e.data.text);
        else {
          clearTimeout(timer);
          worker.terminate();
          if (e.data.type === "error") reject(new Error(e.data.text));
          else resolve(e.data.text);
        }
      };
      worker.onerror = (e) => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(e.message));
      };
      worker.postMessage({ audio }, [audio.buffer]);
    });
  }, workerPath);
  console.log("REAL WHISPER TRANSCRIPT:", text);
  expect(text.toLowerCase()).toContain("topic");
  expect(text.toLowerCase()).toContain("teacher");
  expect(uploads).toEqual([]);
});
