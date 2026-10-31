import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Certificate", () => {
  let certificate, owner, other;
  const certHash = ethers.keccak256(ethers.toUtf8Bytes("student-roll-123|BSCS|2026"));

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    certificate = await ethers.deployContract("Certificate");
  });

  it("should be valid after the hash is issued", async () => {
    await certificate.issueCertificate(certHash);
    const [valid, revoked, issuer] = await certificate.verifyCertificate(certHash);
    assert.equal(valid, true);
    assert.equal(revoked, false);
    assert.equal(issuer, owner.address);
  });

  it("should be invalid for an unknown hash", async () => {
    const [valid] = await certificate.verifyCertificate(certHash);
    assert.equal(valid, false);
  });

  it("should be invalid after revocation", async () => {
    await certificate.issueCertificate(certHash);
    await certificate.revokeCertificate(certHash);
    const [valid, revoked] = await certificate.verifyCertificate(certHash);
    assert.equal(valid, false);
    assert.equal(revoked, true);
  });

  it("should not allow issuing the same hash twice", async () => {
    await certificate.issueCertificate(certHash);
    await assert.rejects(certificate.issueCertificate(certHash));
  });

  it("should not allow anyone except the owner to issue", async () => {
    await assert.rejects(certificate.connect(other).issueCertificate(certHash));
  });
});