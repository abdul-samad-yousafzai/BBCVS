import { describe, expect, it } from "vitest";
import { extractCertificateHash } from "./qr.js";

const HASH = `0x${"a".repeat(64)}`;

describe("extractCertificateHash", () => {
  it("accepts a plain valid hash", () => {
    expect(extractCertificateHash(HASH)).toBe(HASH);
  });

  it("extracts a hash from a verification path", () => {
    expect(extractCertificateHash(`https://example.test/verify/${HASH}`)).toBe(HASH);
  });

  it("extracts a hash from a hash query parameter", () => {
    expect(extractCertificateHash(`https://example.test/check?hash=${HASH}`)).toBe(HASH);
  });

  it("rejects a hash with an invalid length", () => {
    expect(extractCertificateHash(`0x${"a".repeat(63)}`)).toBeNull();
  });

  it("rejects random text", () => {
    expect(extractCertificateHash("not a certificate QR code")).toBeNull();
  });
});
