import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { once } from "node:events";
import { answerWithIntent } from "../src/local-assistant.js";
import { classifyIntent } from "../src/ml-client.js";
import { app } from "../src/server.js";

const server = createServer(app);
let baseUrl;
let originalApiKey;
let originalAssistantMode;
let originalMlFetchFn;

async function postAssistant(body) {
  const response = await fetch(`${baseUrl}/assistant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

describe("ML intent client", () => {
  before(async () => {
    originalApiKey = process.env.ANTHROPIC_API_KEY;
    originalAssistantMode = process.env.ASSISTANT_MODE;
    originalMlFetchFn = app.locals.mlFetchFn;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ASSISTANT_MODE;
    app.locals.mlFetchFn = async () => {
      throw new Error("Intent service is unavailable.");
    };
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server.close();
    await once(server, "close");
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
    if (originalMlFetchFn === undefined) {
      delete app.locals.mlFetchFn;
    } else {
      app.locals.mlFetchFn = originalMlFetchFn;
    }
  });

  it("returns null when the injected fetch function throws", async () => {
    const result = await classifyIntent("What does NOT FOUND mean?", {
      fetchFn: async () => {
        throw new Error("offline");
      },
    });

    assert.equal(result, null);
  });

  it("returns null for a non-success response", async () => {
    const result = await classifyIntent("What does NOT FOUND mean?", {
      fetchFn: async () => new Response("", { status: 503 }),
    });

    assert.equal(result, null);
  });

  it("returns the intent and confidence from a successful response", async () => {
    const result = await classifyIntent("What does NOT FOUND mean?", {
      baseUrl: "http://ml.test/",
      fetchFn: async (url, options) => {
        assert.equal(url, "http://ml.test/classify");
        assert.equal(options.method, "POST");
        assert.deepEqual(JSON.parse(options.body), {
          text: "What does NOT FOUND mean?",
        });
        return Response.json({ intent: "faq", confidence: 0.6 });
      },
    });

    assert.deepEqual(result, { intent: "faq", confidence: 0.6 });
  });

  it("uses TF-IDF when the intent service is unreachable", async () => {
    const result = await answerWithIntent("What does NOT FOUND mean?", {
      fetchFn: async () => {
        throw new Error("offline");
      },
    });

    assert.equal(result.source, "tfidf");
    assert.equal(result.intent, null);
    assert.ok(result.reply.length > 0);
    assert.match(result.replyId, /^qa-\d+$/);
    assert.equal(typeof result.score, "number");
  });

  it("returns an ML-labeled FAQ answer for a confident intent", async () => {
    const result = await answerWithIntent("What does NOT FOUND mean?", {
      fetchFn: async () => Response.json({
        intent: "faq",
        confidence: 0.6,
      }),
    });

    assert.equal(result.source, "ml");
    assert.equal(result.intent, "faq");
    assert.ok(result.reply.length > 0);
    assert.match(result.replyId, /^qa-\d+$/);
    assert.equal(typeof result.score, "number");
  });

  it("returns the TF-IDF source from the FAQ route when the ML service is down", async () => {
    const result = await postAssistant({
      mode: "faq",
      message: "What does NOT FOUND mean?",
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.source, "tfidf");
    assert.equal(result.body.intent, null);
    assert.ok(result.body.reply.length > 0);
  });
});
