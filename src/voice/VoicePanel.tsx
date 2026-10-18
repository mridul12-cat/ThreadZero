import { useState, useRef, useEffect } from "react";
import { Mic, Square, X, Check, Download, ShieldCheck } from "lucide-react";
import {
  createNative,
  nativeAvailability,
  nativeConstructor,
  stopTracks,
  voiceError,
  type LocalRecognition,
} from "./native";
type Phase =
  "idle" | "permission" | "recording" | "processing" | "transcript" | "error";
export default function VoicePanel({
  onConfirm,
  onClose,
}: {
  onConfirm: (text: string) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [engine, setEngine] = useState<"native" | "whisper">("whisper");
  const [availability, setAvailability] = useState("checking");
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const native = useRef<LocalRecognition | null>(null);
  const worker = useRef<Worker | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const context = useRef<AudioContext | null>(null);
  const cancelled = useRef(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const chunks = useRef<Blob[]>([]);
  function cleanup() {
    generation.current += 1;
    stopTracks(stream.current);
    stream.current = null;
    if (native.current) {
      native.current.onresult = null;
      native.current.onend = null;
      native.current.onerror = null;
      native.current.abort();
      native.current = null;
    }
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.onerror = null;
      recorder.current.ondataavailable = null;
      if (recorder.current.state === "recording") recorder.current.stop();
    }
    recorder.current = null;
    worker.current?.terminate();
    worker.current = null;
    void context.current?.close().catch(() => {});
    context.current = null;
    clearTimeout(timeout.current);
    chunks.current = [];
    busy.current = false;
  }
  useEffect(() => {
    cancelled.current = false;
    setAvailability(
      nativeConstructor()?.available ? "unchecked" : "unsupported",
    );
    return () => {
      cancelled.current = true;
      cleanup();
    };
  }, []);
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  function fail(error: unknown) {
    if (cancelled.current) return;
    setMessage(voiceError(error));
    setPhase("error");
    cleanup();
  }
  async function processAudio(session: number) {
    if (cancelled.current || session !== generation.current) return;
    setPhase("processing");
    setMessage("Preparing your audio locally…");
    try {
      const blob = new Blob(chunks.current, {
        type: recorder.current?.mimeType || "audio/webm",
      });
      chunks.current = [];
      stopTracks(stream.current);
      stream.current = null;
      const ctx = new AudioContext();
      context.current = ctx;
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      const offline = new OfflineAudioContext(
        1,
        Math.ceil(decoded.duration * 16000),
        16000,
      );
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      const rendered = await offline.startRendering();
      const audio = rendered.getChannelData(0).slice();
      await ctx.close();
      context.current = null;
      if (cancelled.current || session !== generation.current) return;
      const w = new Worker(new URL("./asr.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      timeout.current = setTimeout(
        () =>
          fail(
            new Error(
              "Local transcription timed out. Try a shorter recording.",
            ),
          ),
        240000,
      );
      w.onerror = () =>
        fail(
          new Error(
            "The local speech worker could not start. Try a current browser or use text.",
          ),
        );
      w.onmessage = (e: MessageEvent<{ type: string; text: string }>) => {
        if (cancelled.current || session !== generation.current) return;
        if (e.data.type === "progress") setMessage(e.data.text);
        else if (e.data.type === "error") fail(new Error(e.data.text));
        else {
          if (!e.data.text.trim()) {
            fail(new Error("No speech was recognized. Please retry."));
            return;
          }
          setTranscript(e.data.text.trim());
          setPhase("transcript");
          cleanup();
        }
      };
      w.postMessage({ audio }, [audio.buffer]);
    } catch (e) {
      if (session === generation.current) fail(e);
    }
  }
  async function start() {
    if (busy.current) return;
    busy.current = true;
    const session = ++generation.current;
    cancelled.current = false;
    setPhase("permission");
    setMessage("Allow microphone access to begin.");
    setSeconds(0);
    setTranscript("");
    try {
      if (!window.isSecureContext)
        throw new Error("Microphone access needs HTTPS or localhost.");
      if (engine === "native") {
        const r = await createNative();
        if (cancelled.current || session !== generation.current) {
          r.abort();
          return;
        }
        native.current = r;
        let final = "";
        r.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
            else interim += e.results[i][0].transcript;
          }
          setTranscript(final + interim);
        };
        r.onerror = (e) =>
          fail(
            new Error(
              `On-device recognition: ${e.error}. No remote fallback was used.`,
            ),
          );
        r.onend = () => {
          if (!cancelled.current) {
            setTranscript((current) => {
              if (!current.trim()) {
                setPhase("error");
                setMessage("No speech recognized. Please retry.");
              } else setPhase("transcript");
              return current;
            });
            busy.current = false;
          }
        };
        r.start();
        setPhase("recording");
        return;
      }
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Local recording is not supported by this browser. Text entry is always available.",
        );
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (cancelled.current || session !== generation.current) {
        stopTracks(acquired);
        return;
      }
      stream.current = acquired;
      const r = new MediaRecorder(acquired);
      recorder.current = r;
      chunks.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size && !cancelled.current) chunks.current.push(e.data);
      };
      r.onerror = () =>
        fail(new Error("Recording was interrupted. Please retry."));
      r.onstop = () => {
        if (!cancelled.current && session === generation.current)
          void processAudio(session);
      };
      r.start(250);
      setPhase("recording");
    } catch (e) {
      if (session === generation.current) fail(e);
    }
  }
  function stop() {
    if (engine === "native") {
      native.current?.stop();
    } else recorder.current?.stop();
    setPhase("processing");
    setMessage("Finishing your recording…");
  }
  useEffect(() => {
    if (phase === "recording" && seconds >= 120) {
      if (engine === "native") native.current?.stop();
      else recorder.current?.stop();
      setPhase("processing");
      setMessage("Finishing your recording…");
    }
  }, [seconds, phase, engine]); // hard limit keeps local memory bounded
  return (
    <section className="voice-panel" aria-label="Speak your thoughts">
      <button
        className="icon-button voice-close"
        onClick={() => {
          cancelled.current = true;
          cleanup();
          onClose();
        }}
        aria-label="Close voice capture"
      >
        <X size={18} />
      </button>
      <span className="eyebrow">A LITTLE SPACE TO SPEAK</span>
      <h2>Let it out, one thought at a time.</h2>
      <p>Just talk. No need to organize anything yet.</p>
      <div className={`voice-orb ${phase === "recording" ? "listening" : ""}`}>
        <Mic size={32} />
      </div>
      <div role="status" aria-live="polite">
        {phase === "recording"
          ? `Listening to your thoughts… ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
          : phase === "transcript"
            ? "Here’s what I heard. You can change anything."
            : message || "English · up to 2 minutes"}
      </div>
      {phase === "recording" && engine === "native" && transcript && (
        <p className="interim-transcript">{transcript}</p>
      )}
      {phase === "recording" && (
        <div className="wave" aria-hidden="true">
          {Array.from({ length: 25 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${i * 0.07}s` }} />
          ))}
        </div>
      )}
      {(phase === "idle" || phase === "error") && (
        <>
          <label className="field">
            Transcription engine
            <select
              value={engine}
              onChange={(e) =>
                setEngine(e.target.value as "native" | "whisper")
              }
            >
              <option value="whisper">Local Whisper · CPU / WASM</option>
              {availability === "available" && (
                <option value="native">Browser on-device English</option>
              )}
            </select>
          </label>
          {availability === "unchecked" && (
            <button
              className="button secondary"
              onClick={async () => {
                setMessage("Checking the browser’s on-device English pack…");
                const result = await nativeAvailability();
                if (cancelled.current) return;
                setAvailability(result);
                if (result === "available") {
                  setEngine("native");
                  setMessage("On-device English is ready.");
                } else if (result === "unsupported" || result === "unavailable")
                  setMessage(
                    "Browser on-device English is unavailable. Local Whisper is still an option.",
                  );
              }}
            >
              Check browser on-device English
            </button>
          )}
          {(availability === "downloadable" ||
            availability === "downloading") && (
            <button
              className="button secondary"
              onClick={async () => {
                setMessage("Installing browser English language pack…");
                try {
                  const installed = await nativeConstructor()?.install?.({
                    langs: ["en-US"],
                  });
                  if (!installed)
                    throw new Error(
                      "English pack installation failed. Local Whisper is available as an alternative.",
                    );
                  setAvailability(await nativeAvailability());
                } catch (e) {
                  fail(e);
                }
              }}
            >
              <Download size={16} /> Install browser English pack
            </button>
          )}
          <p className="small muted">
            {engine === "whisper"
              ? "First use downloads an open-source Whisper model (roughly 75–150 MB plus runtime). Audio is transcribed in a local worker, after you stop. Model resources may be cached by your browser."
              : "The browser has confirmed its on-device English pack. Remote recognition is never enabled."}
          </p>
          <button className="button primary" onClick={() => void start()}>
            <Mic size={17} />
            {phase === "error" ? "Try recording again" : "Start recording"}
          </button>
        </>
      )}
      {phase === "recording" && (
        <button className="button primary" onClick={stop}>
          <Square size={16} /> Stop recording
        </button>
      )}
      {(phase === "processing" || phase === "permission") && (
        <button
          className="button secondary"
          onClick={() => {
            cancelled.current = true;
            cleanup();
            setPhase("idle");
            setMessage("Cancelled. Your thoughts stay yours.");
          }}
        >
          Cancel
        </button>
      )}
      {phase === "transcript" && (
        <>
          <textarea
            aria-label="Edit transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
          />
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => {
                setTranscript("");
                setPhase("idle");
              }}
            >
              Delete transcript
            </button>
            <button
              className="button primary"
              disabled={!transcript.trim()}
              onClick={() => onConfirm(transcript)}
            >
              <Check size={16} /> Use these thoughts
            </button>
          </div>
        </>
      )}
      <p className="privacy-line">
        <ShieldCheck size={15} /> No audio uploads. No recordings saved.
      </p>
    </section>
  );
}
