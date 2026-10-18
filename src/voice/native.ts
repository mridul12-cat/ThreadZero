export interface RecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}
export interface LocalRecognition {
  processLocally: boolean;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
export interface LocalConstructor {
  new (): LocalRecognition;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<string>;
  install?: (options: { langs: string[] }) => Promise<boolean>;
}
export function nativeConstructor(): LocalConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: LocalConstructor;
    webkitSpeechRecognition?: LocalConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
export async function nativeAvailability(
  ctor = nativeConstructor(),
): Promise<string> {
  if (!ctor?.available) return "unsupported";
  try {
    const instance = new ctor();
    if (!("processLocally" in instance)) return "unsupported";
    return await ctor.available({ langs: ["en-US"], processLocally: true });
  } catch {
    return "unsupported";
  }
}
export async function createNative(
  ctor = nativeConstructor(),
): Promise<LocalRecognition> {
  if (!ctor || (await nativeAvailability(ctor)) !== "available")
    throw new Error(
      "On-device English recognition is not available. Use local Whisper or type your thoughts.",
    );
  const r = new ctor();
  r.processLocally = true;
  r.lang = "en-US";
  r.continuous = true;
  r.interimResults = true;
  return r;
}
export function voiceError(error: unknown) {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone permission was denied. Allow access in your browser settings, or type your thoughts.";
  if (name === "NotFoundError")
    return "No microphone was found. Connect one, or use the text editor.";
  return error instanceof Error
    ? error.message
    : "Local transcription failed. Please retry or use text.";
}
export function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
