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
    throw new Error(data?.error || `Request failed with status ${response.status}.`);
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
  });
}

export function revokeCertificate(hash) {
  return request("/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hash }),
  });
}

export function getCertificateByRoll(rollNumber) {
  return request(`/certificates/roll/${encodeURIComponent(rollNumber)}`);
}

export function checkHealth() {
  return request("/health");
}
