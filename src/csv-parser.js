export function parseCsv(text) {
  if (typeof text !== "string") {
    throw new TypeError("CSV content must be a string.");
  }

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false;

  function finishField() {
    row.push(field);
    field = "";
    closedQuote = false;
  }

  function finishRow() {
    finishField();
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
    row = [];
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          closedQuote = true;
        }
      } else if (character === "\r" && text[index + 1] === "\n") {
        field += "\n";
        index += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (character === ",") {
      finishField();
      continue;
    }

    if (character === "\r" || character === "\n") {
      finishRow();
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    if (closedQuote) {
      if (character === " " || character === "\t") {
        continue;
      }
      throw new Error("CSV contains unexpected text after a quoted field.");
    }

    if (character === '"') {
      if (field !== "") {
        throw new Error("CSV contains a quote inside an unquoted field.");
      }
      inQuotes = true;
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quoted field.");
  }

  if (field !== "" || row.length > 0 || closedQuote) {
    finishRow();
  }

  if (rows.length === 0) {
    throw new Error("CSV must include a header row.");
  }

  const headers = rows[0].map((header, index) => {
    const normalized = header.trim();
    return index === 0 ? normalized.replace(/^\uFEFF/, "") : normalized;
  });
  if (headers.some((header) => header === "") || new Set(headers).size !== headers.length) {
    throw new Error("CSV headers must be non-empty and unique.");
  }

  return rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""]),
  ));
}
