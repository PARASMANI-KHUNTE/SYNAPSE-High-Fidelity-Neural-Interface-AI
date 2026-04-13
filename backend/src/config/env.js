import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_MODE: z.enum(["userid", "jwt", "none"]).default("jwt"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  BASE_URL: z.string().url().default("http://localhost:3001"),
  OPERATOR_NAME: z.string().min(1).default("Operator"),
  CORS_ORIGINS: z.string().default("http://localhost:3001,http://localhost:5173"),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  DB_NAME: z.string().optional(),

  OLLAMA_BASE_URL: z.string().url("OLLAMA_BASE_URL must be a valid URL"),
  OLLAMA_MODEL: z.string().default("llama3.2:1b"),
  OLLAMA_VISION_MODEL: z.string().default("llava"),
  OLLAMA_TIMEOUT: z.coerce.number().int().positive().default(120000),
  OLLAMA_MAX_RETRIES: z.coerce.number().int().min(1).max(10).default(3),
  OLLAMA_RETRY_DELAY: z.coerce.number().int().min(100).default(2000),

  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
  RAG_MIN_SCORE: z.coerce.number().min(0).max(1).default(0),
  RAG_MAX_SCORE: z.coerce.number().min(0).max(1).default(1),
  RAG_MIN_LEXICAL_SCORE: z.coerce.number().min(0).max(1).default(0.1),
  RAG_CHUNK_SIZE: z.coerce.number().int().min(100).max(4000).default(800),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(1000).default(120),
  VECTORSTORE_PATH: z.string().default("./vectorstore"),
  EMBEDDING_MODEL: z.string().default("nomic-embed-text"),

  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  ENABLE_TTS: z.string().default("true"),
  TTS_ENGINE: z.string().optional(),
  TTS_ACCENT: z.enum(["auto", "en-us", "en-in", "hi-in"]).default("auto"),
  TTS_FILE_TTL_MS: z.coerce.number().int().min(60000).max(1800000).default(300000),

  SANDBOX_ENABLED: z.string().default("true"),
  SANDBOX_DOCKER_IMAGE: z.string().default("node:20-alpine"),
  SANDBOX_TIMEOUT_MS: z.coerce.number().int().min(1000).max(15000).default(5000),
  SANDBOX_MEMORY_LIMIT: z.string().default("128m"),
  SANDBOX_CPU_LIMIT: z.string().default("0.50"),
  SANDBOX_PIDS_LIMIT: z.coerce.number().int().min(16).max(512).default(64),
  SANDBOX_SECCOMP_PROFILE: z.string().default("default")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsed.data;
env.DB_NAME = env.DB_NAME || process.env.DbName || "LLMmemory";

if (env.AUTH_MODE === "jwt") {
  const isProd = env.NODE_ENV === "production";
  const accessOk = Boolean(env.JWT_SECRET && String(env.JWT_SECRET).length >= 32);
  const refreshOk = Boolean(env.JWT_REFRESH_SECRET && String(env.JWT_REFRESH_SECRET).length >= 32);

  if (isProd && (!accessOk || !refreshOk)) {
    const missing = [];
    if (!accessOk) missing.push("JWT_SECRET (min 32 chars)");
    if (!refreshOk) missing.push("JWT_REFRESH_SECRET (min 32 chars)");
    throw new Error(`Invalid environment configuration: ${missing.join(", ")} required when AUTH_MODE=jwt`);
  }

  if (!accessOk) env.JWT_SECRET = "dev_jwt_secret_change_me_32_chars_minimum_123";
  if (!refreshOk) env.JWT_REFRESH_SECRET = "dev_jwt_refresh_secret_change_me_32_chars_minimum_456";
}

const splitList = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const config = {
  app: {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    baseUrl: env.BASE_URL,
    operatorName: env.OPERATOR_NAME
  },
  auth: {
    mode: env.AUTH_MODE,
    jwtSecret: env.JWT_SECRET || "",
    jwtRefreshSecret: env.JWT_REFRESH_SECRET || "",
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
  },
  cors: {
    origins: splitList(env.CORS_ORIGINS)
  },
  mongo: {
    uri: env.MONGO_URI,
    dbName: env.DB_NAME
  },
  ollama: {
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_MODEL,
    visionModel: env.OLLAMA_VISION_MODEL,
    timeout: env.OLLAMA_TIMEOUT,
    retries: env.OLLAMA_MAX_RETRIES,
    retryDelay: env.OLLAMA_RETRY_DELAY
  },
  sandbox: {
    enabled: String(env.SANDBOX_ENABLED).toLowerCase() !== "false",
    dockerImage: env.SANDBOX_DOCKER_IMAGE,
    timeoutMs: env.SANDBOX_TIMEOUT_MS,
    memoryLimit: env.SANDBOX_MEMORY_LIMIT,
    cpuLimit: env.SANDBOX_CPU_LIMIT,
    pidsLimit: env.SANDBOX_PIDS_LIMIT,
    seccompProfile: env.SANDBOX_SECCOMP_PROFILE
  },
  tts: {
    enabled: ["1", "true", "yes", "on"].includes(String(env.ENABLE_TTS || "").toLowerCase()),
    engine: env.TTS_ENGINE || "",
    accent: env.TTS_ACCENT,
    fileTtlMs: env.TTS_FILE_TTL_MS
  }
};

export default config;
