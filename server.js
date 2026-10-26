import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_PROMPT, buildUserMessage, PROMPT_VERSION } from "./lib/prompt.js";
import { MAX_CHARS, parseSections, detect } from "./lib/validate.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = "127.0.0.1"; // localhost only
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const allowed = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript" };

let sdk, modelId, loading = null, busy = false, state = "not loaded", progress = 0, lastError = "";

function ensureModel() {
  if (modelId) return Promise.resolve(modelId);
  if (!loading) {
    loading = (async () => {
      state = "loading"; progress = 0;
      try {
        sdk = await import("@qvac/sdk");
       modelId = await sdk.loadModel({
  modelSrc: sdk.LLAMA_3_2_1B_INST_Q4_0,
  modelType: "llm",
  modelConfig: { ctx_size: 32768 },
  onProgress: (p) => { progress = Math.round(p.percentage); },
});
        state = "ready"; lastError = "";
        return modelId;
      } catch (e) { state = "error"; lastError = String(e?.message || e); throw e; }
      finally { loading = null; }
    })();
  }
  return loading;
}

async function generate(doc) {
  const id = await ensureModel();
  const run = sdk.completion({
    modelId: id,
    history: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: buildUserMessage(doc) }],
    stream: true,
  });
  let out = "";
  for await (const t of run.tokenStream) { out += t; if (out.length > 12000) break; }
  return out;
}

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};

function readBody(req, limit = 200000) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on("data", (c) => { n += c.length; if (n > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host, origin = req.headers.origin;
    if (!allowed.has(`http://${host}`) || (origin && !allowed.has(origin))) return send(res, 403, { error: "Request blocked." });
    const url = new URL(req.url, `http://${host}`);

    if (req.method === "GET" && url.pathname === "/api/status")
      return send(res, 200, { state, progress, error: lastError, maxChars: MAX_CHARS, promptVersion: PROMPT_VERSION });

    if (req.method === "POST" && url.pathname === "/api/analyze") {
      let text;
      try { text = JSON.parse(await readBody(req)).text; } catch { return send(res, 400, { error: "That request was too large or not valid." }); }
      if (typeof text !== "string" || !text.trim()) return send(res, 400, { error: "Paste or load a document first." });
      if (text.length > MAX_CHARS) return send(res, 400, { error: `This document is too long (limit ${MAX_CHARS} characters). Paste the most important part.` });
      if (busy) return send(res, 429, { error: "Karatasi is still working on another analysis." });
      busy = true;
      const t0 = Date.now();
      try {
        const raw = await generate(text);
        const result = parseSections(raw);
        const hasContent = !!(result.paraphrase || result.keyPoints.length || result.whatToDo.length);
        return send(res, 200, {
          structured: hasContent,
          result: hasContent ? result : null,
          rawText: hasContent ? undefined : raw.slice(0, 4000),
          detected: detect(text),
          ms: Date.now() - t0,
        });
      } catch (e) {
        console.error("Analysis failed:", String(e?.message || e)); // never log document text
        return send(res, 500, { error: "The local AI model could not finish. Check the terminal for details, then retry.", detected: detect(text) });
      } finally { busy = false; }
    }

    if (req.method === "GET") {
      const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const file = path.join(PUB, path.normalize(rel));
      if (!file.startsWith(PUB + path.sep)) return send(res, 403, { error: "Blocked." });
      try {
        const data = await fs.readFile(file);
        res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
        return res.end(data);
      } catch { return send(res, 404, { error: "Not found." }); }
    }
    send(res, 405, { error: "Not allowed." });
  } catch { send(res, 500, { error: "Unexpected error." }); }
});

async function shutdown() {
  console.log("\nShutting down...");
  try { if (modelId && sdk) await sdk.unloadModel({ modelId }); } catch (e) { console.error("Could not unload model:", e?.message); }
  process.exit(0);
}
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);

server.listen(PORT, HOST, () => console.log(`Karatasi is running. Open http://localhost:${PORT} in your browser.`));
