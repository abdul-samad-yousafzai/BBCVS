import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { createWriteStream } from "node:fs";

export async function generateCertificatePdf(outputPath, details) {
  const { studentName, rollNumber, program, issueDate, verificationUrl } = details;
  const qrCode = await QRCode.toBuffer(verificationUrl, { type: "png" });
  const document = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 48,
  });
  const output = createWriteStream(outputPath);
  document.pipe(output);

  const pageWidth = document.page.width;
  const pageHeight = document.page.height;
  const margin = 48;

  document
    .lineWidth(3)
    .strokeColor("#1f4e79")
    .rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2)
    .stroke();

  document
    .fillColor("#1f4e79")
    .fontSize(28)
    .font("Helvetica-Bold")
    .text("CERTIFICATE", margin + 32, margin + 35, {
      align: "center",
      width: pageWidth - margin * 2 - 64,
    });

  document
    .fillColor("#333333")
    .font("Helvetica")
    .fontSize(15)
    .text("This certificate is proudly presented to", margin + 32, 160, {
      align: "center",
      width: pageWidth - margin * 2 - 64,
    });

  document
    .fillColor("#111111")
    .font("Helvetica-Bold")
    .fontSize(25)
    .text(studentName, margin + 32, 195, {
      align: "center",
      width: pageWidth - margin * 2 - 64,
    });

  document
    .fillColor("#333333")
    .font("Helvetica")
    .fontSize(14)
    .text(
      `for successfully completing the ${program} program`,
      margin + 32,
      240,
      { align: "center", width: pageWidth - margin * 2 - 64 },
    );

  const detailsX = margin + 80;
  document.fontSize(12).font("Helvetica-Bold").fillColor("#1f4e79");
  document.text("Roll number", detailsX, 300);
  document.text("Issue date", detailsX, 328);
  document
    .font("Helvetica")
    .fillColor("#333333")
    .text(String(rollNumber), detailsX + 105, 300)
    .text(String(issueDate), detailsX + 105, 328);

  const qrSize = 120;
  document.image(qrCode, pageWidth - margin - qrSize - 72, 285, {
    width: qrSize,
    height: qrSize,
  });
  document
    .fontSize(9)
    .fillColor("#555555")
    .text(
      "Scan to verify",
      pageWidth - margin - qrSize - 72,
      412,
      { align: "center", width: qrSize },
    );

  const writeCompletion = new Promise((resolve, reject) => {
    output.once("finish", resolve);
    output.once("error", reject);
    document.once("error", reject);
  });

  document.end();
  await writeCompletion;

  return outputPath;
}
