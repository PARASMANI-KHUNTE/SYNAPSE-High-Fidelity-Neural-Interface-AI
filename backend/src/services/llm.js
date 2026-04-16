const getOllamaModel = (hasImages) =>
  hasImages ? (process.env.OLLAMA_VISION_MODEL || "llava") : (process.env.OLLAMA_MODEL || "llama3");

const getOllamaBaseUrl = () => process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT) || 120000;
const MAX_RETRIES = parseInt(process.env.OLLAMA_MAX_RETRIES) || 3;
const RETRY_DELAY = parseInt(process.env.OLLAMA_RETRY_DELAY) || 2000;

const getCasualModelName = () =>
  process.env.OLLAMA_CASUAL_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b";

const readInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getKeepAliveForModel = (model = "") => {
  const fast = process.env.OLLAMA_KEEP_ALIVE_FAST || "30m";
  const heavy = process.env.OLLAMA_KEEP_ALIVE_HEAVY || "15m";
  const casual = getCasualModelName();
  return String(model || "").trim() === String(casual || "").trim() ? fast : heavy;
};

const getNumCtxForModel = (model = "") => {
  const fast = readInt(process.env.OLLAMA_NUM_CTX_FAST, 2048);
  const heavy = readInt(process.env.OLLAMA_NUM_CTX_HEAVY, 4096);
  const casual = getCasualModelName();
  return String(model || "").trim() === String(casual || "").trim() ? fast : heavy;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatOllamaError = (err, baseUrl = getOllamaBaseUrl()) => {
  const cause = err?.cause;
  if (!cause) {
    return `${err.message} (baseUrl: ${baseUrl})`;
  }

  const details = [
    cause.code || cause.errno,
    cause.address ? `address=${cause.address}` : null,
    cause.port ? `port=${cause.port}` : null
  ].filter(Boolean).join(", ");

  return details
    ? `${err.message} (${details}, baseUrl: ${baseUrl})`
    : `${err.message} (baseUrl: ${baseUrl})`;
};

const fetchWithTimeout = async (url, options, timeout = OLLAMA_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function generateResponseStream(messages, onChunk, abortSignal, modelOverride = null) {
  const lastMessage = [...messages].reverse().find(m => m.role === "user");
  const hasImages = Boolean(lastMessage && lastMessage.images && lastMessage.images.length > 0);

  const primaryModel = modelOverride || getOllamaModel(hasImages);
  const fallbackModel = process.env.OLLAMA_MODEL || "llama3.2:1b";
  const modelsToTry = hasImages
    ? [primaryModel]
    : primaryModel !== fallbackModel
      ? [primaryModel, fallbackModel]
      : [primaryModel];

  for (const model of modelsToTry) {
    console.log(`\nCalling Ollama Stream [${model}]`);
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await callOllamaStreamWithModel(messages, onChunk, model, abortSignal);
      } catch (err) {
        lastError = err;

        if (err.name === "AbortError" || err.type === "aborted") {
          throw err;
        }

        if (err.message.includes("404") || err.message.includes("not found")) {
          if (hasImages) {
            throw new Error(`Vision model [${model}] is not available in Ollama. Pull it first or set OLLAMA_VISION_MODEL correctly.`);
          }
          console.warn(`Model [${model}] not available. Falling back...`);
          break;
        }

        console.warn(`Ollama attempt ${attempt}/${MAX_RETRIES} failed:`, formatOllamaError(err));
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    if (model === modelsToTry[modelsToTry.length - 1]) {
      throw lastError || new Error("Ollama connection failed");
    }
  }
}

export const generateResponse = async (messages, modelOverride = null) => {
  const lastMessage = [...messages].reverse().find(m => m.role === "user");
  const hasImages = Boolean(lastMessage && lastMessage.images && lastMessage.images.length > 0);

  const model = modelOverride || getOllamaModel(hasImages);
  const baseUrl = getOllamaBaseUrl();

  console.log(`\nCalling Ollama [${model}]`);

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: messages.map(m => ({ role: m.role, content: m.content, ...(m.images ? { images: m.images } : {}) })),
            stream: false,
             keep_alive: getKeepAliveForModel(model),
             options: { num_ctx: getNumCtxForModel(model), temperature: 0.1 }
           })
         },
         OLLAMA_TIMEOUT
       );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Ollama HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.message?.content) {
        throw new Error("Invalid response from Ollama");
      }

      return data.message.content;
    } catch (err) {
      lastError = err;
      console.warn(`Ollama attempt ${attempt}/${MAX_RETRIES} failed:`, formatOllamaError(err));

      if (err.name === "AbortError") throw err;

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error("Ollama connection failed after all retries");
};

const callOllamaStreamWithModel = async (messages, onChunk, model, abortSignal) => {
  const baseUrl = getOllamaBaseUrl();
  const hasImages = messages.some(m => m.images && m.images.length > 0);

  console.log(`Streaming Ollama [${model}]`);

  const safeMessages = messages.map(m => {
    if (!hasImages || !m.images) {
      return { role: m.role, content: m.content?.substring(0, 8000) || "" };
    }
    return {
      role: m.role,
      content: m.content?.substring(0, 8000) || "",
      images: m.images.slice(0, 5)
    };
  });

  let fullContent = "";

  const response = await fetchWithTimeout(
    `${baseUrl}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: safeMessages,
        stream: true,
         keep_alive: getKeepAliveForModel(model),
         options: { num_ctx: getNumCtxForModel(model), temperature: 0.1 }
       })
     },
     OLLAMA_TIMEOUT
   );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Ollama HTTP ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error("No response body from Ollama");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      if (abortSignal?.aborted) {
        console.log("[Abort] Stream manually stopped");
        return fullContent;
      }

      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        if (abortSignal?.aborted) {
          return fullContent;
        }

        try {
          const data = JSON.parse(line);
          if (data.error) {
            throw new Error(`Ollama error: ${data.error}`);
          }
          if (data.message?.content) {
            onChunk(data.message.content);
            fullContent += data.message.content;
          }
          if (data.done) {
            return fullContent;
          }
        } catch (e) {
          if (e.message.includes("JSON")) {
            continue;
          }
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
};

const callOllamaStream = (messages, onChunk, hasImages, abortSignal) => {
  const model = getOllamaModel(hasImages);
  return callOllamaStreamWithModel(messages, onChunk, model, abortSignal);
};

export const generateCompletion = async (text) => {
  if (!text || text.length < 3) return null;

  const model = process.env.OLLAMA_MODEL || "llama3";
  const baseUrl = getOllamaBaseUrl();

  const prompt = `Continue or correct the following text (max 5 words). ONLY return the completion. No chat, no intro.\nInput: "${text.substring(0, 200)}"\nCompletion:`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { stop: ["\n", ".", "Input:", '"'], num_predict: 15, temperature: 0.3 }
      })
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.response) return null;

    return data.response.trim().replace(/^["']|["']$/g, "").substring(0, 100);
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("Completion request timed out");
    } else {
      console.error("Completion error:", err.message);
    }
    return null;
  }
};

export const checkOllamaHealth = async () => {
  const baseUrl = getOllamaBaseUrl();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { healthy: true, models: data.models?.map(m => m.name) || [] };
    }

    return { healthy: false, error: `HTTP ${response.status}` };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
};

export const prewarmModel = (modelName) => {
  const baseUrl = getOllamaBaseUrl();
  console.log(`Pre-warming model asynchronously: ${modelName}`);
  fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: "initialize" }],
      stream: false,
      keep_alive: "4h",
      options: { num_predict: 2 }
    })
  }).catch((err) => console.log(`Prewarming failed: ${err.message}`));
};

export default {
  generateResponseStream,
  generateResponse,
  generateCompletion,
  checkOllamaHealth,
  prewarmModel
};
