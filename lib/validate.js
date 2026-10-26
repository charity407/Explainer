export const MAX_CHARS = 30000;
const strip = (s) => String(s).trim().replace(/^["“'‘]+|["”'’]+$/g, "");
const norm = (s) => strip(s).replace(/\s+/g, " ").trim().toLowerCase();

export function verifyQuote(quote, doc) {
  if (typeof quote !== "string") return false;
  const q = norm(quote);
  return q.length >= 8 && norm(doc).includes(q);
}

// Parse the model's plain-text section output into a structured object.
// Splits on the four known headings; robust to extra text before/after.
export function parseSections(raw) {
  const result = { paraphrase: "", keyPoints: [], whatToDo: [], watchOut: [] };
  if (!raw || typeof raw !== "string") return result;

  // Split on any of the four section headings (case-insensitive, colon optional)
  const headerRe = /^(WHAT THIS MEANS|KEY POINTS|WHAT YOU SHOULD DO|THINGS TO CHECK)\s*:?/im;
  const parts = raw.split(/(WHAT THIS MEANS|KEY POINTS|WHAT YOU SHOULD DO|THINGS TO CHECK)\s*:?/i);
  // parts[0] = text before first header, then pairs of [header, content]

  for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i].trim().toUpperCase();
    const content = (parts[i + 1] || "").trim();

    if (header === "WHAT THIS MEANS") {
      // Join non-empty lines into a paragraph
      result.paraphrase = content
        .split("\n")
        .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
        .filter(Boolean)
        .join(" ");
    } else {
      const key = header === "KEY POINTS" ? "keyPoints"
        : header === "WHAT YOU SHOULD DO" ? "whatToDo"
        : "watchOut";
      result[key] = content
        .split("\n")
        .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
        .filter(Boolean)
        .slice(0, key === "watchOut" ? 5 : key === "whatToDo" ? 8 : 10);
    }
  }
  return result;
}

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";
const DATE = new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\.?,?\\s+\\d{4}\\b|\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b|\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b`, "gi");
const MONEY = /\b(?:KES|KSh|Ksh|USD)\s?[\d,]+(?:\.\d+)?|\$\s?[\d,]+(?:\.\d+)?/g;

// Deterministic: values come straight from the text, so quotes are verified by construction.
export function detect(doc) {
  const out = [], seen = new Set();
  const sentences = doc.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    for (const [kind, re] of [["date", DATE], ["amount", MONEY]]) {
      for (const m of s.matchAll(re)) {
        const key = kind + m[0].toLowerCase() + s;
        if (!seen.has(key) && out.length < 25) { seen.add(key); out.push({ kind, value: m[0], sourceQuote: s }); }
      }
    }
  }
  return out;
}
