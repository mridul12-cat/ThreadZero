import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import {
  nativeAvailability,
  createNative,
  stopTracks,
  voiceError,
  type LocalConstructor,
} from "../voice/native";
import VoicePanel from "../voice/VoicePanel";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("privacy and speech capabilities", () => {
  it("does not treat default web speech as local support", async () => {
    class RemoteOnly {
      static available = undefined;
    }
    expect(
      await nativeAvailability(RemoteOnly as unknown as LocalConstructor),
    ).toBe("unsupported");
    await expect(
      createNative(RemoteOnly as unknown as LocalConstructor),
    ).rejects.toThrow(/not available/);
  });
  it("requires available local language pack and sets local-only mode", async () => {
    class Local {
      processLocally = false;
      static available = vi.fn().mockResolvedValue("available");
    }
    const r = await createNative(Local as unknown as LocalConstructor);
    expect(r.processLocally).toBe(true);
    expect(Local.available).toHaveBeenCalledWith({
      langs: ["en-US"],
      processLocally: true,
    });
  });
  it("never enables recognition if pack is unavailable", async () => {
    class Local {
      processLocally = false;
      static available = vi.fn().mockResolvedValue("downloadable");
    }
    await expect(
      createNative(Local as unknown as LocalConstructor),
    ).rejects.toThrow();
  });
  it("explains permission denial and missing microphones", () => {
    expect(voiceError(new DOMException("denied", "NotAllowedError"))).toMatch(
      /permission was denied/,
    );
    expect(voiceError(new DOMException("missing", "NotFoundError"))).toMatch(
      /No microphone/,
    );
  });
  it("releases every audio track", () => {
    const stop = vi.fn();
    stopTracks({
      getTracks: () => [{ stop }, { stop }],
    } as unknown as MediaStream);
    expect(stop).toHaveBeenCalledTimes(2);
    stopTracks(null);
  });
  it("shows honest unsupported recording state", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("MediaRecorder", undefined);
    render(<VoicePanel onClose={() => {}} onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(
      await screen.findByText(/Local recording is not supported/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use these thoughts" }),
    ).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("allows editing and confirming actual native transcript events", async () => {
    let recognition: Record<string, unknown> | undefined;
    class Native {
      processLocally = false;
      static available = async () => "available";
      start() {
        recognition = this as unknown as Record<string, unknown>;
      }
      stop() {}
      abort() {}
    }
    vi.stubGlobal("isSecureContext", true);
    Object.defineProperty(window, "SpeechRecognition", {
      value: Native,
      configurable: true,
    });
    const confirm = vi.fn();
    render(<VoicePanel onClose={() => {}} onConfirm={confirm} />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Check browser on-device English",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Browser on-device English" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    await waitFor(() => expect(recognition).toBeDefined());
    const result = recognition?.onresult as (e: unknown) => void;
    const end = recognition?.onend as () => void;
    const { act } = await import("@testing-library/react");
    await act(async () => {
      result({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: "Buy milk" } }],
      });
      end();
    });
    const editor = screen.getByRole("textbox", { name: "Edit transcript" });
    fireEvent.change(editor, { target: { value: "Buy oat milk" } });
    fireEvent.click(screen.getByRole("button", { name: "Use these thoughts" }));
    expect(confirm).toHaveBeenCalledWith("Buy oat milk");
    Reflect.deleteProperty(window, "SpeechRecognition");
    vi.unstubAllGlobals();
  });
});

describe("microphone and local worker recovery", () => {
  function recordingEnvironment() {
    const stop = vi.fn();
    const recorderInstances: MockRecorder[] = [];
    const workerInstances: MockWorker[] = [];
    class MockRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      constructor() {
        recorderInstances.push(this);
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"]) });
        this.onstop?.();
      }
    }
    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      terminate = vi.fn();
      postMessage = vi.fn();
      constructor() {
        workerInstances.push(this);
      }
    }
    const audio = {
      duration: 1,
      getChannelData: () => new Float32Array([0.1, 0.2]),
    };
    class MockAudioContext {
      close = vi.fn().mockResolvedValue(undefined);
      decodeAudioData = vi.fn().mockResolvedValue(audio);
    }
    class MockOffline {
      destination = {};
      createBufferSource() {
        return { buffer: null, connect: vi.fn(), start: vi.fn() };
      }
      startRendering = vi.fn().mockResolvedValue(audio);
    }
    class MockBlob {
      size = 5;
      arrayBuffer = async () => new ArrayBuffer(4);
    }
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("MediaRecorder", MockRecorder);
    vi.stubGlobal("Worker", MockWorker);
    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("OfflineAudioContext", MockOffline);
    vi.stubGlobal("Blob", MockBlob);
    const getUserMedia = vi
      .fn()
      .mockResolvedValue({ getTracks: () => [{ stop }] });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    return { stop, recorderInstances, workerInstances, getUserMedia };
  }
  afterEach(() => vi.unstubAllGlobals());
  it("reports permission denial without a success transcript", async () => {
    const env = recordingEnvironment();
    env.getUserMedia.mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    render(<VoicePanel onClose={() => {}} onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(
      await screen.findByText(/permission was denied/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit transcript")).not.toBeInTheDocument();
  });
  it("records, stops tracks, handles worker failure, and retries", async () => {
    const env = recordingEnvironment();
    render(<VoicePanel onClose={() => {}} onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Stop recording" }),
    );
    await waitFor(() => expect(env.workerInstances).toHaveLength(1));
    expect(env.stop).toHaveBeenCalled();
    const { act } = await import("@testing-library/react");
    await act(async () =>
      env.workerInstances[0].onmessage?.(
        new MessageEvent("message", {
          data: { type: "error", text: "Model download failed" },
        }),
      ),
    );
    expect(
      await screen.findByText("Model download failed"),
    ).toBeInTheDocument();
    expect(env.workerInstances[0].terminate).toHaveBeenCalled();
    expect(screen.queryByLabelText("Edit transcript")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Try recording again" }),
    );
    await screen.findByRole("button", { name: "Stop recording" });
    expect(env.getUserMedia).toHaveBeenCalledTimes(2);
  });
  it("cancels recording and releases resources on unmount", async () => {
    const env = recordingEnvironment();
    const view = render(<VoicePanel onClose={() => {}} onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    await screen.findByRole("button", { name: "Stop recording" });
    view.unmount();
    expect(env.stop).toHaveBeenCalled();
    expect(env.recorderInstances[0].state).toBe("inactive");
    expect(env.workerInstances).toHaveLength(0);
  });
  it("does not turn an empty transcription into success", async () => {
    const env = recordingEnvironment();
    render(<VoicePanel onClose={() => {}} onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Stop recording" }),
    );
    await waitFor(() => expect(env.workerInstances).toHaveLength(1));
    const { act } = await import("@testing-library/react");
    await act(async () =>
      env.workerInstances[0].onmessage?.(
        new MessageEvent("message", { data: { type: "result", text: "" } }),
      ),
    );
    expect(
      await screen.findByText(/No speech was recognized/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit transcript")).not.toBeInTheDocument();
  });
});

it("releases a microphone permission result that arrives after cancellation", async () => {
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("MediaRecorder", class {});
  const stop = vi.fn();
  let resolveStream: (stream: unknown) => void = () => {};
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise((resolve) => {
          resolveStream = resolve;
        }),
    },
  });
  const view = render(<VoicePanel onClose={() => {}} onConfirm={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
  await screen.findByRole("button", { name: "Cancel" });
  view.unmount();
  const { act } = await import("@testing-library/react");
  await act(async () => resolveStream({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});
