const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const URL_HASH_PATTERN = /(?:\/verify\/(0x[0-9a-fA-F]{64})(?=$|[/?#&])|[?&]hash=(0x[0-9a-fA-F]{64})(?=$|[&#]))/;

export function extractCertificateHash(text) {
  if (typeof text !== "string") return null;

  const value = text.trim();
  if (HASH_PATTERN.test(value)) return value;

  const match = value.match(URL_HASH_PATTERN);
  const hash = match?.[1] || match?.[2];
  return hash && HASH_PATTERN.test(hash) ? hash : null;
}
