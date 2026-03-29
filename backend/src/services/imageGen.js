import axios from "axios";
import fs from "fs";
import path from "path";

const ensureUploadsDir = () => {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

export const generateImage = async (prompt) => {
  try {
    ensureUploadsDir();
    
    const apiUrl = process.env.SD_API_URL || "http://localhost:7860/sdapi/v1/txt2img";
    console.log(`🎨 Generating image for prompt: "${prompt}"...`);
    
    const response = await axios.post(apiUrl, {
      prompt: prompt,
      negative_prompt: "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
      steps: 20,
      width: 512,
      height: 512,
      cfg_scale: 7
    }, {
      timeout: 60000
    });

    const base64Image = response.data.images[0];
    const fileName = `generated_${Date.now()}.png`;
    const relativePath = `uploads/${fileName}`;
    const filePath = path.join(process.cwd(), relativePath);

    fs.writeFileSync(filePath, Buffer.from(base64Image, 'base64'));
    
    return relativePath;
  } catch (err) {
    console.error("Stable Diffusion Error:", err.message);
    if (err.code === "ECONNREFUSED") {
      throw new Error("Failed to connect to Stable Diffusion API. Make sure it's running on port 7860.");
    }
    throw new Error(`Image generation failed: ${err.message}`);
  }
};
