import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import PDFDocument from "pdfkit";
import { app } from "../src/server.js";

const server = createServer(app);
const storedRecords = [];
const fakeRepository = {
  async findByRollNumber() {
    return null;
  },
  async insertCertificate(record) {
    storedRecords.push(record);
    return record;
  },
};

let baseUrl;
let originalApiKey;
let originalModel;
let originalRepository;
let originalAssistantFetchFn;
let aiReply;

async function createSamplePdf() {
  const document = new PDFDocument();
  const chunks = [];
  document.on("data", (chunk) => chunks.push(chunk));
  const completed = once(document, "end");
  document.text("Student: Sample Person");
  document.text("Roll number: SAMPLE-001");
  document.text("Program: Sample Program");
  document.text("Issue date: 2026-10-31");
  document.end();
  await completed;
  return Buffer.concat(chunks);
}

async function postPdf(route, data, contentType = "application/pdf") {
  const form = new FormData();
  form.append("file", new Blob([data], { type: contentType }), "sample.pdf");
  const response = await fetch(`${baseUrl}/${route}`, {
    method: "POST",
    body: form,
  });
  return { status: response.status, body: await response.json() };
}

describe("PDF assistant endpoints", () => {
  before(async () => {
    originalApiKey = process.env.ANTHROPIC_API_KEY;
    originalModel = process.env.ANTHROPIC_MODEL;
    originalRepository = app.locals.repository;
    originalAssistantFetchFn = app.locals.assistantFetchFn;
    process.env.ANTHROPIC_API_KEY = "test-key-not-for-network-use";
    process.env.ANTHROPIC_MODEL = "test-model";
    app.locals.repository = fakeRepository;
    app.locals.assistantFetchFn = async (url, options) => {
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      const requestBody = JSON.parse(options.body);
      assert.equal(requestBody.messages[0].content[0].type, "text");
      return new Response(JSON.stringify({
        content: [{ type: "text", text: aiReply }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
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
    if (originalModel === undefined) {
      delete process.env.ANTHROPIC_MODEL;
    } else {
      process.env.ANTHROPIC_MODEL = originalModel;
    }
    if (originalRepository === undefined) {
      delete app.locals.repository;
    } else {
      app.locals.repository = originalRepository;
    }
    if (originalAssistantFetchFn === undefined) {
      delete app.locals.assistantFetchFn;
    } else {
      app.locals.assistantFetchFn = originalAssistantFetchFn;
    }
  });

  it("rejects a non-PDF upload for detail extraction", async () => {
    const result = await postPdf("extract-details", "not a PDF", "text/plain");

    assert.equal(result.status, 400);
    assert.match(result.body.error, /Only PDF files/);
  });

  it("returns 422 when the AI reply is not valid JSON", async () => {
    aiReply = "These details look like a certificate.";
    const result = await postPdf("extract-details", await createSamplePdf());

    assert.equal(result.status, 422);
    assert.match(result.body.error, /invalid JSON/);
  });

  it("returns valid AI JSON as a suggestion without writing any records", async () => {
    aiReply = JSON.stringify({
      studentName: "Sample Person",
      rollNumber: "SAMPLE-001",
      program: "Sample Program",
      issueDate: "2026-10-31",
    });
    const result = await postPdf("extract-details", await createSamplePdf());

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      suggestion: {
        studentName: "Sample Person",
        rollNumber: "SAMPLE-001",
        program: "Sample Program",
        issueDate: "2026-10-31",
      },
      confidence: "suggested",
    });
    assert.deepEqual(storedRecords, []);
  });

  it("rejects a non-PDF upload for design checking", async () => {
    const result = await postPdf("check-design", "not a PDF", "text/plain");

    assert.equal(result.status, 400);
    assert.match(result.body.error, /Only PDF files/);
  });
});
