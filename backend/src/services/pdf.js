import fs from "fs";
import pdf from "pdf-parse";

export const parsePDF = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (err) {
    console.error("PDF Parsing Error:", err.message);
    throw new Error("Failed to parse PDF document.");
  }
};
