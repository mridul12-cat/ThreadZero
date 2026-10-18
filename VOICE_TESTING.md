# Manual local speech smoke test

Status: **real production-worker inference verified using synthetic speech; physical microphone not yet manually verified.**

The opt-in Playwright smoke test ran the production Transformers.js 4.3.1/q8 WASM worker in Chromium 156.0.8078.4 on macOS. Input: a locally generated English WAV fixture, `e2e/fixtures/local-speech.wav`. Actual output: “I need to choose a topic. I have to email my teacher tomorrow.” No POST/PUT/PATCH requests were observed. The test took about 20 seconds including browser startup and initial loading; this is not a hardware-independent performance guarantee. A fake-microphone attempt stalled at permission, so this successful test feeds decoded audio directly to the worker and does not verify MediaRecorder end-to-end.

To reproduce, run `npm run build` and `npm run preview -- --port 4173`, then in another terminal:

```sh
THREADZERO_ASR_SMOKE=1 THREADZERO_BASE_URL=http://127.0.0.1:4173 npm run test:e2e -- --grep 'real local Whisper' --project desktop
```

Default browser tests skip this network/model download test. The fixture is synthetic speech, not a recording of a person. The separate unit tests use mocks for recording/worker failures; those cannot establish physical microphone or transcription quality.

## Whisper CPU path

1. Run `npm run dev` on a desktop browser, visit localhost, open DevTools Network. Use a current Chromium browser with microphone, MediaRecorder, WebAssembly, Web Audio, module workers and adequate memory. Keep any extensions that modify microphone/network requests disabled during testing.
2. Click **Speak instead**. Read first-run download/privacy information; select local Whisper.
3. Click **Start recording**, allow the microphone. Speak: “I need to choose a topic. I have to email my teacher tomorrow.” Confirm timer increases and UI indicates recording.
4. Stop. Confirm the browser microphone indicator switches off immediately. Observe honest download file progress and then local transcription. Audio/transcript must never appear in network requests. Requests should be GETs for application assets, model/config/tokenizer weights and ONNX runtime binaries.
5. Confirm actual recognized words appear. Edit the transcript, delete a word, and choose **Use these thoughts**. Confirm text joins the editor and remains editable. Untangle into candidate tasks.
6. Record again; cancel while processing. Verify worker termination, microphone release and that no late transcript appears. Retry successfully.
7. Deny microphone access; confirm an explanatory failure and no false success. Disconnect the microphone and retry. Test a silent recording, device interruption, and blocked model downloads.
8. Test reload/model caching. Disconnect network only after resources are loaded; record again. If it fails, report the exact missing cached asset. Offline shell startup is not implemented and should not be claimed.
9. Use a long recording, max two minutes, and check UI responsiveness and memory. Processing has a four-minute timeout; shorter recordings are recommended on slower devices.

## Native on-device English

1. Use a browser exposing `SpeechRecognition.processLocally` and static `available`/`install` methods. If unsupported, confirm the engine is absent and the app never invokes remote speech.
2. If the English pack is downloadable, use the install button; deny/interrupt installation and test recovery.
3. After local availability is confirmed, choose **Browser on-device English** and record with network disabled after app startup. Confirm actual interim/final words; Stop; edit and confirm.
4. Monitor network to confirm no audio transmission. Test permission denial, silence, cancellation and recognition errors. The app must never fall back to remote recognition.

Record browser version, OS, hardware, chosen engine, network/cache state, model download size, duration, success/failure and transcript accuracy. Only then list that exact configuration as manually supported.
