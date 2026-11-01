
import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { createCertificateRepository } from "../src/certificate-repository.js";
import { createSupabaseClient } from "../src/supabase.js";

const hasSupabaseConfiguration = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

describe("Supabase certificate repository integration", () => {
  it(
    "inserts and looks up a certificate record",
    { skip: !hasSupabaseConfiguration },
    async () => {
      const supabase = createSupabaseClient();
      const repository = createCertificateRepository(supabase);
      const uniqueId = randomUUID();
      const record = {
        rollNumber: `SUPABASE-TEST-${uniqueId}`,
        studentName: "Supabase Integration Test",
        program: "Integration Testing",
        issueDate: "2026-11-01",
        hash: `0x${randomBytes(32).toString("hex")}`,
        transactionHash: `0x${randomBytes(32).toString("hex")}`,
        pdfPath: `integration-test/${uniqueId}.pdf`,
      };
      let insertedRecord;

      try {
        insertedRecord = await repository.insertCertificate(record);
        const foundRecord = await repository.findByRollNumber(record.rollNumber);

        assert.equal(foundRecord.id, insertedRecord.id);
        assert.equal(foundRecord.roll_number, record.rollNumber);
        assert.equal(foundRecord.hash, record.hash);
      } finally {
        if (insertedRecord?.id) {
          const { error } = await supabase
            .from("certificates")
            .delete()
            .eq("id", insertedRecord.id);
          if (error) {
            throw new Error(`Failed to clean up integration record: ${error.message}`);
          }
        }
      }
    },
  );
});
