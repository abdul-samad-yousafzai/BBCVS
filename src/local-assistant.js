// Provides a cached, offline TF-IDF assistant backed by the project FAQ.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-parser.js";
import { classifyIntent } from "./ml-client.js";

const DEFAULT_KNOWLEDGE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "knowledge/qa.csv",
);
const STOP_WORDS = new Set([
  "is", "the", "a", "an", "of", "to", "in", "what", "does", "do", "how",
  "why", "and", "or", "for", "on", "with", "it", "this", "that", "be",
  "can", "i", "my",
]);
const FALLBACK_TEXT = "I do not have an answer for that in the project FAQ. Try rephrasing, or see the Verify and Issuer pages.";
const knowledgeBasesByPath = new Map();
const indexesByEntries = new WeakMap();

export function tokenize(text) {
  if (typeof text !== "string") {
    return [];
  }

  return text.toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token !== "" && !STOP_WORDS.has(token));
}

export async function loadKnowledgeBase(filePath = DEFAULT_KNOWLEDGE_PATH) {
  const resolvedPath = resolve(filePath);
  if (!knowledgeBasesByPath.has(resolvedPath)) {
    const loading = readFile(resolvedPath, "utf8")
      .then((text) => parseCsv(text).map(({ question, answer }) => ({
        question: typeof question === "string" ? question : "",
        answer: typeof answer === "string" ? answer : "",
      })))
      .catch((error) => {
        if (error.code === "ENOENT") {
          return [];
        }
        throw error;
      });
    knowledgeBasesByPath.set(resolvedPath, loading);
  }

  return knowledgeBasesByPath.get(resolvedPath);
}

export function buildIndex(entries) {
  if (!Array.isArray(entries)) {
    throw new TypeError("Knowledge base entries must be an array.");
  }

  const cachedIndex = indexesByEntries.get(entries);
  if (cachedIndex) {
    return cachedIndex;
  }

  const documentFrequency = new Map();
  const tokenizedQuestions = entries.map((entry) => {
    const tokens = tokenize(entry.question);
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
    return tokens;
  });
  const inverseDocumentFrequency = new Map(
    [...documentFrequency].map(([token, frequency]) => [
      token,
      Math.log((entries.length + 1) / (frequency + 1)) + 1,
    ]),
  );
  const index = new Map();

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const tokens = tokenizedQuestions[entryIndex];
    const termFrequency = new Map();
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }

    const vector = new Map();
    for (const [token, count] of termFrequency) {
      vector.set(token, (count / tokens.length) * inverseDocumentFrequency.get(token));
    }
    index.set(entries[entryIndex], vector);
  }

  index.entries = entries;
  index.inverseDocumentFrequency = inverseDocumentFrequency;
  indexesByEntries.set(entries, index);
  return index;
}

function cosineSimilarity(left, right) {
  let dotProduct = 0;
  let leftMagnitudeSquared = 0;
  let rightMagnitudeSquared = 0;

  for (const [token, weight] of left) {
    dotProduct += weight * (right.get(token) ?? 0);
    leftMagnitudeSquared += weight * weight;
  }
  for (const weight of right.values()) {
    rightMagnitudeSquared += weight * weight;
  }

  if (leftMagnitudeSquared === 0 || rightMagnitudeSquared === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(leftMagnitudeSquared) * Math.sqrt(rightMagnitudeSquared));
}

export function findBestAnswer(message, index, { minScore = 0.2 } = {}) {
  const tokens = tokenize(message);
  const termFrequency = new Map();
  for (const token of tokens) {
    termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
  }

  const queryVector = new Map();
  for (const [token, count] of termFrequency) {
    const idf = index.inverseDocumentFrequency.get(token);
    if (idf !== undefined) {
      queryVector.set(token, (count / tokens.length) * idf);
    }
  }

  let bestEntry;
  let bestScore = 0;
  for (const [entry, vector] of index) {
    const score = cosineSimilarity(queryVector, vector);
    if (score > bestScore) {
      bestEntry = entry;
      bestScore = score;
    }
  }

  if (!bestEntry || bestScore < minScore) {
    return {
      answer: null,
      question: null,
      score: bestScore,
      fallback: FALLBACK_TEXT,
    };
  }

  return {
    answer: bestEntry.answer,
    question: bestEntry.question,
    score: bestScore,
  };
}

async function findLocalAnswer(message) {
  const entries = await loadKnowledgeBase();
  const result = findBestAnswer(message, buildIndex(entries));
  return { entries, result };
}

export async function answerLocally(message) {
  const { result } = await findLocalAnswer(message);
  return {
    reply: result.answer ?? result.fallback,
    source: "local",
    score: result.score,
  };
}

export async function answerWithIntent(message, { fetchFn } = {}) {
  const classification = await classifyIntent(message, { fetchFn });
  const local = await findLocalAnswer(message);
  const { result, entries } = local;
  const matchedIndex = entries.findIndex((entry) => entry.question === result.question);
  const replyId = matchedIndex < 0 ? null : `qa-${matchedIndex + 1}`;

  if (!classification || classification.confidence < 0.2) {
    return {
      reply: result.answer ?? result.fallback,
      source: "tfidf",
      intent: null,
      score: result.score,
      replyId: result.answer === null ? null : replyId,
    };
  }

  if (classification.intent === "other") {
    return {
      reply: FALLBACK_TEXT,
      source: "ml",
      intent: classification.intent,
      score: 0,
      replyId: null,
    };
  }

  return {
    reply: result.answer ?? result.fallback,
    source: "ml",
    intent: classification.intent,
    score: result.score,
    replyId: result.answer === null ? null : replyId,
  };
}
