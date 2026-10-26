# Karatasi: Understand your documents. Know your next step.

Offline-first document interpreter. Paste an internship offer, scholarship notice or training announcement and get a plain-English explanation, dates and amounts, what is unclear, questions to ask, and an editable checklist. AI runs locally through QVAC (`@qvac/sdk` 0.22.0, model `LLAMA_3_2_1B_INST_Q4_0`). No cloud AI, no CDN, no analytics.

## Run it (Windows, PowerShell)
1. Extract this zip into `C:\Users\ZBOOK\qvac-test`. Your existing `quickstart.js`, `package.json` and `node_modules` stay as they are.
2. In VS Code open that folder, then Terminal > New Terminal.
3. Add the run commands once (no installs, no new dependencies):
```powershell
cd C:\Users\ZBOOK\qvac-test
npm pkg set scripts.start="node server.js"
npm pkg set scripts.test="node --test"
```
4. Run the unit tests (they do not need the model):
```powershell
npm test
```
5. Start the app, then open http://localhost:3000
```powershell
npm start
```
6. Pick a sample and click **Explain this document**. The first analysis loads the model and can take a few minutes. Stop with `Ctrl+C`; restart with `npm start`.

## Offline test (run it yourself and record the result)
1. Run once online so the model is cached (your earlier quickstart did this).
2. `Ctrl+C`, turn Wi-Fi off and unplug Ethernet, then `npm start`.
3. Open http://localhost:3000, load a sample, analyze. The "Browser reports" pill should say offline.
4. Result: ______ (not yet verified offline by the author)
If startup fails offline, copy the terminal error and send it back.

## How it works
Browser UI -> `server.js` (127.0.0.1 only, Host/Origin checks, 60 KB request cap, 8,000-character document cap, one analysis at a time) -> `@qvac/sdk` (`loadModel`, `completion`, `unloadModel`, as in your working `quickstart.js`).
- `lib/prompt.js`: versioned system prompt; the document is marked untrusted.
- `lib/validate.js`: parses the model's JSON, caps sizes, checks every quotation against the original text, downgrades unverified "requirements" to suggestions, and finds dates and amounts by pattern matching.
- The UI uses `textContent` only, so model output never runs as code.
- The checklist is saved in browser localStorage only; "Clear saved checklist" removes it. Documents are never saved or logged.

## Verification status
- Passed (in a sandbox, not your laptop): 6 unit tests; server rejects empty input, over-long input, foreign Origin, foreign Host and path traversal.
- NOT verified: real model output quality, JSON reliability of a 1B model, `system`-role messages with SDK 0.22.0, the offline run.

## Known limitations
- A 1B model may miss details or return unparseable output. Karatasi then shows the raw text labelled unchecked; pattern-matched dates and amounts still appear.
- Text only (no PDF/OCR). English only. Not legal or financial advice.
- Model: Llama 3.2 (Meta community license); check terms before redistributing. Check the QVAC SDK license in its package.

## Demo script (2-3 min)
Load the internship sample > explain > show dates and the green "Found in your text" quotes > show unclear items and questions > tick checklist items > disconnect Wi-Fi > load the scholarship sample (deliberately incomplete) > explain again > point out that missing funding details are flagged as unclear, not as "no funding".
