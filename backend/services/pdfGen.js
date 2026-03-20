import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const generatePDF = async (text, fileName) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const relativePath = `uploads/generated_${fileName}.pdf`;
      const filePath = path.join(process.cwd(), relativePath);
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Add content
      doc.fontSize(20).text("OS Assistant Generated Report", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(text);
      
      doc.end();

      stream.on("finish", () => {
        resolve(relativePath);
      });
    } catch (err) {
      reject(err);
    }
  });
};
