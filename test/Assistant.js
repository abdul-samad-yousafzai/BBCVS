import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { once } from "node:events";
import { app } from "../src/server.js";

const API_KEY = "test-anthropic-key-never-return-this";
const server = createServer(app);
let baseUrl;
let originalApiKey;
let originalModel;
let originalAssistantFetchFn;

async function postAssistant(body) {
  const response = await fetch(`${baseUrl}/assistant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  assert.equal(text.includes(API_KEY), false);
  return { status: response.status, body: JSON.parse(text) };
}

describe("AI assistant endpoint", () => {
  before(async () => {
    originalApiKey = process.env.ANTHROPIC_API_KEY;
    originalModel = process.env.ANTHROPIC_MODEL;
    originalAssistantFetchFn = app.locals.assistantFetchFn;
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    process.env.ANTHROPIC_MODEL = "test-model";
  });

  after(async () => {
    server.close();
    await once(server, "close");
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    if (originalModel === undefined) {
      delete process.env.ANTHROPIC_MODEL;
    } else {
      process.env.ANTHROPIC_MODEL = originalModel;
    }
    if (originalAssistantFetchFn === undefined) {
      delete app.locals.assistantFetchFn;
    } else {
      app.locals.assistantFetchFn = originalAssistantFetchFn;
    }
  });

  it("returns 503 when the API key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await postAssistant({ mode: "faq", message: "How do I verify?" });

    assert.equal(result.status, 503);
    assert.match(result.body.error, /ANTHROPIC_API_KEY/);
  });

  it("returns 400 when the message exceeds 1000 characters", async () => {
    process.env.ANTHROPIC_API_KEY = API_KEY;
    const result = await postAssistant({
      mode: "faq",
      message: "x".repeat(1001),
    });

    assert.equal(result.status, 400);
  });

  it("returns 400 for an invalid mode", async () => {
    const result = await postAssistant({ mode: "decide", message: "Is this valid?" });

    assert.equal(result.status, 400);
  });

  it("returns the mocked reply for a valid explain request", async () => {
    app.locals.assistantFetchFn = async (url, options) => {
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      assert.equal(options.headers["x-api-key"], API_KEY);
      return new Response(JSON.stringify({
        content: [{ type: "text", text: "The blockchain shows this certificate is valid." }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await postAssistant({
      mode: "explain",
      message: "What does this mean?",
      context: { status: "VALID", issuer: "0xissuer", issuedAt: "123" },
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      reply: "The blockchain shows this certificate is valid.",
    });
  });

  it("does not return an upstream reply that contains the API key", async () => {
    app.locals.assistantFetchFn = async () => new Response(
      JSON.stringify({
        content: [{ type: "text", text: `Unexpected echo: ${API_KEY}` }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

    const result = await postAssistant({ mode: "faq", message: "How do hashes work?" });

    assert.equal(result.status, 502);
    assert.equal(result.body.error, "The AI assistant is temporarily unavailable.");
  });
});
