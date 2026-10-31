const resultCard = document.querySelector("#result-card");
const resultStatus = document.querySelector("#result-status");
const resultIssuer = document.querySelector("#result-issuer");
const resultDate = document.querySelector("#result-date");
const resultError = document.querySelector("#result-error");

function showResult(result) {
  resultCard.hidden = false;
  resultCard.className = "result-card";
  resultStatus.textContent = result.status;
  resultIssuer.textContent = `Issuer: ${result.issuer}`;

  const timestamp = Number(result.issuedAt);
  const date = new Date(timestamp * 1000);
  resultDate.textContent = Number.isFinite(timestamp) && !Number.isNaN(date.getTime())
    ? `Issue date: ${date.toLocaleString()}`
    : "Issue date: Unavailable";

  if (result.status === "VALID") {
    resultCard.classList.add("valid");
  } else if (result.status === "REVOKED") {
    resultCard.classList.add("revoked");
  } else {
    resultCard.classList.add("not-found");
  }

  resultError.hidden = true;
  resultError.textContent = "";
}

function showError(message) {
  resultCard.hidden = false;
  resultCard.className = "result-card error";
  resultStatus.textContent = "Verification error";
  resultIssuer.textContent = "";
  resultDate.textContent = "";
  resultError.textContent = message;
  resultError.hidden = false;
}

async function readResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}.`);
  }

  return body;
}

document.querySelector("#file-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const fileInput = document.querySelector("#pdf-file");
  const file = fileInput.files[0];
  if (!file) {
    showError("Choose a PDF file to verify.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    showResult(await readResponse(await fetch("/verify-file", {
      method: "POST",
      body: formData,
    })));
  } catch (error) {
    showError(error.message);
  }
});

document.querySelector("#hash-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const hash = document.querySelector("#certificate-hash").value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    showError("Enter a 0x-prefixed 32-byte hexadecimal hash.");
    return;
  }

  try {
    showResult(await readResponse(await fetch(`/verify/${encodeURIComponent(hash)}`)));
  } catch (error) {
    showError(error.message);
  }
});
