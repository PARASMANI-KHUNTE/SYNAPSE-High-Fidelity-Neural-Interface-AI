const requiredVars = [
  "MONGO_URI",
  "OLLAMA_BASE_URL"
];

const missingVars = requiredVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
}

const splitList = (value, fallback = []) =>
  value
    ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
    : fallback;

const config = {
  app: {
    port: Number.parseInt(process.env.PORT || "3001", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    baseUrl: process.env.BASE_URL || "http://localhost:3001",
    operatorName: process.env.OPERATOR_NAME || "Operator"
  },
  cors: {
    origins: splitList(process.env.CORS_ORIGINS, ["http://localhost:3001", "http://localhost:5173"])
  },
  mongo: {
    uri: process.env.MONGO_URI,
    dbName: process.env.DbName || "LLMmemory"
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL || "llama3",
    visionModel: process.env.OLLAMA_VISION_MODEL || "llava"
  }
};

export default config;
