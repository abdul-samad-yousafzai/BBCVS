export function createCertificateRepository(supabase) {
  return {
    async findByRollNumber(rollNumber) {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("roll_number", rollNumber)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to find certificate by roll number: ${error.message}`);
      }

      return data;
    },

    async findByHash(hash) {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("hash", hash)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to find certificate by hash: ${error.message}`);
      }

      return data;
    },

    async insertCertificate(record) {
      const { data, error } = await supabase
        .from("certificates")
        .insert({
          roll_number: record.rollNumber,
          student_name: record.studentName,
          program: record.program,
          issue_date: record.issueDate,
          hash: record.hash,
          transaction_hash: record.transactionHash,
          pdf_path: record.pdfPath,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(`Failed to save certificate record: ${error.message}`);
      }

      return data;
    },

    async markRevoked(hash) {
      const { data, error } = await supabase
        .from("certificates")
        .update({ revoked: true })
        .eq("hash", hash)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to mark certificate as revoked: ${error.message}`);
      }
      if (!data) {
        throw new Error("No certificate record found for the hash.");
      }

      return data;
    },
  };
}
