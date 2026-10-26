import test from "node:test";
import assert from "node:assert/strict";
import { verifyQuote, extractJson, sanitize, detect } from "../lib/validate.js";

const doc = "Applications close on 30 April 2025.\nThe fee is KES 5,000 and must be paid on admission.";

test("verifyQuote accepts exact text, ignoring whitespace, case and quote marks", () => {
  assert.equal(verifyQuote('"applications  close on 30 April 2025"', doc), true);
});
test("verifyQuote rejects invented, empty and non-string quotes", () => {
  assert.equal(verifyQuote("Accommodation is provided free", doc), false);
  assert.equal(verifyQuote("", doc), false);
  assert.equal(verifyQuote(null, doc), false);
});
test("extractJson handles surrounding prose and garbage", () => {
  assert.deepEqual(extractJson('Sure! {"a":1} done'), { a: 1 });
  assert.equal(extractJson("no json here"), null);
  assert.equal(extractJson("{broken"), null);
});
test("sanitize flags unverified quotes and downgrades fake requirements", () => {
  const r = sanitize({
    summary: "<script>alert(1)</script>",
    importantDetails: [{ label: "Deadline", value: "30 April", sourceQuote: "Applications close on 30 April 2025." },
                       { label: "Housing", value: "free", sourceQuote: "Free housing is included" }],
    nextSteps: [{ task: "Apply", type: "requirement", sourceQuote: "fake words not in doc" }],
  }, doc);
  assert.equal(r.importantDetails[0].sourceVerified, true);
  assert.equal(r.importantDetails[1].sourceVerified, false);
  assert.equal(r.nextSteps[0].type, "suggestion");
});
test("sanitize survives wrong types", () => {
  const r = sanitize({ importantDetails: "x", nextSteps: [1, null, {}], questionsToAsk: [5] }, doc);
  assert.deepEqual(r.importantDetails, []);
  assert.deepEqual(r.nextSteps, []);
  assert.deepEqual(r.questionsToAsk, []);
});
test("detect finds dates and amounts, each with a verifiable sentence", () => {
  const d = detect(doc);
  assert.ok(d.some((x) => x.kind === "date" && x.value === "30 April 2025"));
  assert.ok(d.some((x) => x.kind === "amount" && x.value === "KES 5,000"));
  assert.ok(d.every((x) => verifyQuote(x.sourceQuote, doc)));
});
