const REQUIRED_FIELDS = [
  "studentName",
  "rollNumber",
  "program",
  "issueDate",
  "verificationUrl",
];
const MAX_ROWS = 500;

function isRealCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12) {
    return false;
  }

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  return day >= 1 && day <= daysInMonth;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateStudentRows(rows) {
  const valid = [];
  const errors = [];
  const seenRollNumbers = new Set();

  if (rows.length > MAX_ROWS) {
    errors.push({
      line: MAX_ROWS + 2,
      field: "",
      message: `CSV must contain at most ${MAX_ROWS} data rows.`,
    });
  }
  if (rows.length === 0) {
    errors.push({ line: 2, field: "", message: "CSV must contain at least one data row." });
  }

  rows.forEach((row, index) => {
    const line = index + 2;
    const rowErrors = [];

    for (const field of REQUIRED_FIELDS) {
      if (typeof row[field] !== "string" || row[field].trim() === "") {
        rowErrors.push({ line, field, message: `${field} is required.` });
      }
    }

    if (typeof row.issueDate === "string" && row.issueDate.trim() !== ""
      && !isRealCalendarDate(row.issueDate.trim())) {
      rowErrors.push({
        line,
        field: "issueDate",
        message: "issueDate must be a real date in YYYY-MM-DD format.",
      });
    }

    if (typeof row.verificationUrl === "string" && row.verificationUrl.trim() !== ""
      && !isHttpUrl(row.verificationUrl.trim())) {
      rowErrors.push({
        line,
        field: "verificationUrl",
        message: "verificationUrl must be a valid HTTP or HTTPS URL.",
      });
    }

    const rollNumber = typeof row.rollNumber === "string" ? row.rollNumber.trim() : "";
    if (rollNumber !== "") {
      if (seenRollNumbers.has(rollNumber)) {
        rowErrors.push({
          line,
          field: "rollNumber",
          message: "rollNumber must be unique within the CSV file.",
        });
      } else {
        seenRollNumbers.add(rollNumber);
      }
    }

    errors.push(...rowErrors);
    if (rowErrors.length === 0) {
      valid.push(row);
    }
  });

  return { valid, errors };
}
