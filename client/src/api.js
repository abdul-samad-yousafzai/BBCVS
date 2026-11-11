const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error("Unable to reach the verification service. Please try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The verification service returned an invalid response.");
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.errors = data?.errors;
    error.suggestion = data?.suggestion;
    throw error;
  }

  return data;
}

export function verifyHash(hash) {
  return request(`/verify/${encodeURIComponent(hash)}`);
}

export function verifyFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/verify-file", { method: "POST", body: formData });
}

export function issueCertificate(details) {
  return request("/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
    credentials: "include",
  });
}

export async function downloadCertificatePdf(rollNumber) {
  let response;
  try {
    response = await fetch(
      `${API_BASE_URL}/admin/certificates/${encodeURIComponent(rollNumber)}/pdf`,
      { credentials: "include" },
    );
  } catch {
    throw new Error("Unable to reach the verification service. Please try again.");
  }

  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    throw new Error(data?.error || `Request failed with status ${response.status}.`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `certificate-${rollNumber}.pdf`;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function issueBatch(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/issue-batch", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
}

export function extractCertificateDetails(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/extract-details", { method: "POST", body: formData });
}

export function checkCertificateDesign(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/check-design", { method: "POST", body: formData });
}

export function revokeCertificate(hash) {
  return request("/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hash }),
    credentials: "include",
  });
}

export function adminLogin(password) {
  return request("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    credentials: "include",
  });
}

export function adminLogout() {
  return request("/admin/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function getAdminSession() {
  return request("/admin/session", { credentials: "include" });
}

export function getAdminAlerts() {
  return request("/admin/alerts", { credentials: "include" });
}

export function getCertificateByRoll(rollNumber) {
  return request(`/certificates/roll/${encodeURIComponent(rollNumber)}`);
}

export function checkHealth() {
  return request("/health");
}

export function askAssistant({ message, context, mode }) {
  return request("/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context, mode }),
  });
}

export function askFaq(message) {
  return request("/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, mode: "faq" }),
  });
}

export function sendAssistantFeedback(replyId, helpful) {
  return request("/assistant/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replyId, helpful }),
  });
}
