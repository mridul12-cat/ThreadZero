import { env, pipeline } from "@huggingface/transformers";
env.allowLocalModels = false;
env.useBrowserCache = true;
let busy = false;
self.onmessage = async (event: MessageEvent<{ audio: Float32Array }>) => {
  if (busy) return;
  busy = true;
  try {
    self.postMessage({ type: "progress", text: "Loading local Whisper…" });
    const transcriber = await pipeline(
      "automatic-speech-recognition",
      "onnx-community/whisper-tiny.en",
      {
        device: "wasm",
        dtype: "q8",
        progress_callback: (p) => {
          if ("progress" in p && typeof p.progress === "number")
            self.postMessage({
              type: "progress",
              text: `Downloading ${"file" in p ? p.file : "model"} · ${Math.round(p.progress)}%`,
            });
        },
      },
    );
    self.postMessage({
      type: "progress",
      text: "Transcribing on your device…",
    });
    const output = await transcriber(event.data.audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    });
    const text = Array.isArray(output)
      ? output.map((o) => o.text).join(" ")
      : output.text;
    self.postMessage({ type: "result", text });
    await transcriber.dispose();
  } catch (error) {
    self.postMessage({
      type: "error",
      text: error instanceof Error ? error.message : "Local model failed.",
    });
  } finally {
    busy = false;
  }
};
