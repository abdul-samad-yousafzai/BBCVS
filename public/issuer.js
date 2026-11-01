const resultCard = document.querySelector("#issuer-result");
const resultTitle = document.querySelector("#issuer-result-title");
const resultMessage = document.querySelector("#issuer-result-message");

function showMessage(title, message, isError = false) {
  resultCard.hidden = false;
  resultCard.className = `result-card ${isError ? "error" : "success"}`;
  resultTitle.textContent = title;
  resultMessage.textContent = message;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(result.error || `Request failed with status ${response.status}.`);
  }

  return result;
}

document.querySelector("#issue-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const values = new FormData(form);
  const details = {
    studentName: values.get("studentName").trim(),
    rollNumber: values.get("rollNumber").trim(),
    program: values.get("program").trim(),
    issueDate: values.get("issueDate"),
    verificationUrl: values.get("verificationUrl").trim(),
  };

  submitButton.disabled = true;
  try {
    const result = await postJson("/issue", details);
    showMessage(
      "Certificate issued",
      `Hash: ${result.hash}\nTransaction: ${result.transactionHash}\nPDF: ${result.pdfPath}`,
    );
  } catch (error) {
    showMessage("Issue failed", error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#revoke-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const hash = new FormData(form).get("hash").trim();

  submitButton.disabled = true;
  try {
    const result = await postJson("/revoke", { hash });
    showMessage(
      "Certificate revoked",
      `Hash: ${result.hash}\nTransaction: ${result.transactionHash}`,
    );
  } catch (error) {
    showMessage("Revoke failed", error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});
