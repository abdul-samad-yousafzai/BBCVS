import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { createWriteStream, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UNIVERSITY_NAME = "Sample University (Demo)";
const CERTIFICATE_TITLE = "Sample Certificate of Completion";
const SIGNATORY_LEFT = "Authorized Signatory";
const SIGNATORY_RIGHT = "Authorized Signatory";
const LOGO_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/bbcvs-logo.png");

export async function generateCertificatePdf(outputPath, details) {
  const { studentName, rollNumber, program, issueDate, verificationUrl } = details;
  const qrCode = await QRCode.toBuffer(verificationUrl, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 1,
    width: 300,
  });
  const document = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
  });
  const output = createWriteStream(outputPath);
  document.pipe(output);

  const pageWidth = document.page.width;
  const pageHeight = document.page.height;
  const centerX = pageWidth / 2;
  const navy = "#17324D";
  const gold = "#A8843D";
  const muted = "#657386";

  document
    .lineWidth(6)
    .strokeColor(navy)
    .rect(20, 20, pageWidth - 40, pageHeight - 40)
    .stroke();
  document
    .lineWidth(1.2)
    .strokeColor(gold)
    .rect(30, 30, pageWidth - 60, pageHeight - 60)
    .stroke();

  document.save();
  document
    .fillOpacity(0.25)
    .fillColor("#B0B7C3")
    .font("Helvetica-Bold")
    .fontSize(64)
    .rotate(-30, { origin: [centerX, pageHeight / 2] })
    .text("SAMPLE - NOT A VALID DEGREE", centerX - 440, pageHeight / 2 - 30, {
      width: 880,
      align: "center",
      lineBreak: false,
    });
  document.restore();

  document
    .fillOpacity(1)
    .fillColor(navy)
    .font("Times-Bold")
    .fontSize(19)
    .text(UNIVERSITY_NAME.toUpperCase(), 65, 53, {
      width: pageWidth - 130,
      align: "center",
    });

  document
    .lineWidth(1.5)
    .strokeColor(gold)
    .moveTo(centerX - 38, 82)
    .lineTo(centerX + 38, 82)
    .stroke();

  document
    .fillColor(gold)
    .font("Times-Italic")
    .fontSize(19)
    .text(CERTIFICATE_TITLE, 65, 91, {
      width: pageWidth - 130,
      align: "center",
    });

  document
    .fillColor(muted)
    .font("Times-Italic")
    .fontSize(15)
    .text("This is to certify that", 80, 139, {
      width: pageWidth - 160,
      align: "center",
    });

  document
    .fillColor(navy)
    .font("Times-Bold")
    .fontSize(34)
    .text(String(studentName), 70, 165, {
      width: pageWidth - 140,
      align: "center",
      height: 46,
      ellipsis: true,
    });

  document
    .fillColor(muted)
    .font("Times-Italic")
    .fontSize(15)
    .text("has successfully completed the requirements for", 80, 214, {
      width: pageWidth - 160,
      align: "center",
    });

  document
    .fillColor(navy)
    .font("Times-Bold")
    .fontSize(22)
    .text(String(program), 80, 238, {
      width: pageWidth - 160,
      align: "center",
      height: 30,
      ellipsis: true,
    });

  document
    .fillColor("#344457")
    .font("Helvetica")
    .fontSize(10)
    .text(`Roll Number: ${String(rollNumber)}`, 75, 279, {
      width: pageWidth / 2 - 85,
      align: "right",
      lineBreak: false,
      ellipsis: true,
    })
    .text(`Date of Issue: ${String(issueDate)}`, centerX + 10, 279, {
      width: pageWidth / 2 - 85,
      align: "left",
      lineBreak: false,
      ellipsis: true,
    });

  const stampCenterY = 408;
  const outerRadius = 57;
  const innerRadius = 51;
  const qrSize = 76;
  document
    .lineWidth(1.5)
    .strokeColor(gold)
    .circle(centerX, stampCenterY, outerRadius)
    .stroke()
    .lineWidth(0.8)
    .circle(centerX, stampCenterY, innerRadius)
    .stroke();

  document
    .fillColor(navy)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("VERIFIED", centerX - 44, stampCenterY - 54, {
      width: 88,
      align: "center",
      lineBreak: false,
    });
  document.image(qrCode, centerX - qrSize / 2, stampCenterY - qrSize / 2, {
    width: qrSize,
    height: qrSize,
  });
  // Keep the QR usable without a logo asset by omitting the optional overlay.
  if (existsSync(LOGO_PATH)) {
    const logoSize = qrSize * 0.22;
    const backingSize = logoSize + 4;
    const logoX = centerX - logoSize / 2;
    const logoY = stampCenterY - logoSize / 2;
    document
      .save()
      .roundedRect(
        centerX - backingSize / 2,
        stampCenterY - backingSize / 2,
        backingSize,
        backingSize,
        3,
      )
      .fill("#FFFFFF");
    document.image(LOGO_PATH, logoX, logoY, {
      width: logoSize,
      height: logoSize,
    });
    document.restore();
  }
  document
    .fillColor(navy)
    .font("Helvetica-Bold")
    .fontSize(7)
    .text("SCAN TO VERIFY", centerX - 44, stampCenterY + 43, {
      width: 88,
      align: "center",
      lineBreak: false,
    });

  const signatureY = 492;
  const signatureWidth = 176;
  const leftSignatureX = 105;
  const rightSignatureX = pageWidth - 105 - signatureWidth;
  document
    .lineWidth(0.8)
    .strokeColor("#637083")
    .moveTo(leftSignatureX, signatureY)
    .lineTo(leftSignatureX + signatureWidth, signatureY)
    .stroke()
    .moveTo(rightSignatureX, signatureY)
    .lineTo(rightSignatureX + signatureWidth, signatureY)
    .stroke();
  document
    .fillColor("#344457")
    .font("Helvetica")
    .fontSize(9)
    .text(SIGNATORY_LEFT, leftSignatureX, signatureY + 7, {
      width: signatureWidth,
      align: "center",
    })
    .text(SIGNATORY_RIGHT, rightSignatureX, signatureY + 7, {
      width: signatureWidth,
      align: "center",
    });

  document
    .fillColor(muted)
    .font("Helvetica")
    .fontSize(7)
    .text(
      "This is a sample certificate for demonstration. Authenticity can be checked with the QR code or the verification portal.",
      60,
      548,
      { width: pageWidth - 120, align: "center" },
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
