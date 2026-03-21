import axios from "axios";
import fs from "fs";
import path from "path";

export const generateImage = async (prompt) => {
  try {
    const apiUrl = process.env.SD_API_URL || "http://localhost:7860/sdapi/v1/txt2img";
    console.log(`🎨 Generating image for prompt: "${prompt}"...`);
    
    const response = await axios.post(apiUrl, {
      prompt: prompt,
      negative_prompt: "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
      steps: 20,
      width: 512,
      height: 512,
      cfg_scale: 7
    });

    const base64Image = response.data.images[0];
    const fileName = `generated_${Date.now()}.png`;
    const relativePath = `uploads/${fileName}`;
    const filePath = path.join(process.cwd(), relativePath);

    fs.writeFileSync(filePath, Buffer.from(base64Image, 'base64'));
    
    return relativePath;
  } catch (err) {
    console.error("Stable Diffusion Error:", err.message);
    throw new Error("Failed to connect to local Stable Diffusion API. Make sure it's running with --api.");
  }
};
