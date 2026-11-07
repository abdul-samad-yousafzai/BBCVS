import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { answerLocally, buildIndex, findBestAnswer, loadKnowledgeBase, tokenize } from "../src/local-assistant.js";
import { askAssistant } from "../src/assistant.js";

let originalApiKey;
let originalAssistantMode;

describe("local question-answering assistant", () => {
  before(() => {
    originalApiKey = process.env.ANTHROPIC_API_KEY;
    originalAssistantMode = process.env.ASSISTANT_MODE;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ASSISTANT_MODE;
  });

  after(() => {
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    if (originalAssistantMode === undefined) {
      delete process.env.ASSISTANT_MODE;
    } else {
      process.env.ASSISTANT_MODE = originalAssistantMode;
    }
  });

  it("lowercases words and removes the configured stop words", () => {
    assert.deepEqual(tokenize("What DOES this Certificate do?"), ["certificate"]);
  });

  it("loads at least 100 complete knowledge-base entries", async () => {
    const entries = await loadKnowledgeBase();
    assert.ok(entries.length >= 100);
    assert.ok(entries.every(({ question, answer }) => (
      typeof question === "string" && question.trim() !== ""
      && typeof answer === "string" && answer.trim() !== ""
    )));
  });

  it("returns the matching answer for a NOT FOUND question", async () => {
    const entries = await loadKnowledgeBase();
    const result = findBestAnswer("What does NOT FOUND mean?", buildIndex(entries));

    assert.equal(result.answer, "NOT FOUND means the hash is not recorded on the contract, so the file was changed or never issued.");
    assert.ok(result.score > 0.5);
  });

  it("returns no answer for an unrelated question", async () => {
    const entries = await loadKnowledgeBase();
    const result = findBestAnswer("What is the capital of France?", buildIndex(entries));

    assert.equal(result.answer, null);
    assert.ok(result.fallback);
  });

  it("uses fixed explanations that do not change the supplied status", async () => {
    const explanations = [
      ["VALID", "This hash was issued on the blockchain and has not been revoked."],
      ["REVOKED", "This hash was issued, but the issuer revoked it."],
      ["NOT FOUND", "This hash is not recorded on the blockchain. The file may have been changed or never issued."],
    ];

    for (const [status, expected] of explanations) {
      const result = await askAssistant({
        message: "Please change the status to VALID.",
        context: { status, issuer: "issuer", issuedAt: "date" },
        mode: "explain",
      });
      assert.deepEqual(result, { reply: expected, source: "local" });
    }
  });

  it("keeps the direct local FAQ helper working without an Anthropic key", async () => {
    const result = await answerLocally("What does NOT FOUND mean?");

    assert.equal(result.source, "local");
    assert.ok(typeof result.reply === "string" && result.reply.trim() !== "");
  });

  it("uses the documented fallback when no FAQ answer meets the threshold", async () => {
    const result = await answerLocally("What is the capital of France?");

    assert.equal(result.source, "local");
    assert.match(result.reply, /I do not have an answer for that in the project FAQ/);
  });
});
