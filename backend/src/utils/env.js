const requiredVars = {
  backend: [
    { name: "PORT", type: "number", default: 3000 },
    { name: "MONGO_URI", type: "string", default: "mongodb://localhost:27017/" },
    { name: "OLLAMA_BASE_URL", type: "string", default: "http://localhost:11434" },
    { name: "OLLAMA_MODEL", type: "string", default: "llama3" },
    { name: "OLLAMA_VISION_MODEL", type: "string", default: "llava" },
    { name: "OLLAMA_TIMEOUT", type: "number", default: 120000 },
    { name: "OLLAMA_MAX_RETRIES", type: "number", default: 3 },
    { name: "EMBEDDING_MODEL", type: "string", default: "nomic-embed-text" },
    { name: "VECTORSTORE_PATH", type: "string", default: "./vectorstore" },
    { name: "RAG_CHUNK_SIZE", type: "number", default: 500 },
    { name: "RAG_MIN_SCORE", type: "number", default: 0.8 },
    { name: "RAG_TOP_K", type: "number", default: 6 },
    { name: "CONTEXT_WINDOW_SIZE", type: "number", default: 6 },
    { name: "CORS_ORIGINS", type: "string", default: "http://localhost:3000,http://localhost:5173" },
    { name: "BASE_URL", type: "string", default: null },
    { name: "OPERATOR_NAME", type: "string", default: "Operator" },
    { name: "NODE_ENV", type: "string", default: "development" }
  ],
  frontend: [
    { name: "VITE_API_URL", type: "string", default: "http://localhost:3000" }
  ]
};

const validateValue = (value, type) => {
  if (value === undefined || value === null || value === "") return null;
  
  switch (type) {
    case "number":
      const num = parseInt(value, 10);
      return isNaN(num) ? null : num;
    case "boolean":
      return value === "true" || value === "1";
    case "string":
    default:
      return String(value);
  }
};

export const validateEnvironment = (scope = "backend") => {
  const vars = requiredVars[scope] || [];
  const results = {
    valid: true,
    missing: [],
    warnings: [],
    values: {}
  };

  for (const v of vars) {
    const value = process.env[v.name];
    const validated = validateValue(value, v.type);
    
    if (validated === null && v.default === null) {
      results.valid = false;
      results.missing.push(v.name);
    } else {
      results.values[v.name] = validated !== null ? validated : v.default;
      
      if (value === undefined || value === "") {
        results.warnings.push(`${v.name} using default: ${v.default}`);
      }
    }
  }

  return results;
};

export const getEnv = (name, defaultValue = null) => {
  return process.env[name] || defaultValue;
};

export const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};

if (process.env.NODE_ENV !== "production" && process.argv[1]?.includes("validate-env")) {
  console.log("\n🔍 Environment Validation\n" + "=".repeat(40));
  
  for (const scope of Object.keys(requiredVars)) {
    console.log(`\n${scope.toUpperCase()}:`);
    const result = validateEnvironment(scope);
    
    if (result.missing.length > 0) {
      console.log("  ❌ Missing:", result.missing.join(", "));
    }
    
    if (result.warnings.length > 0) {
      console.log("  ⚠️  Using defaults:");
      result.warnings.forEach(w => console.log(`     - ${w}`));
    }
    
    if (result.valid && result.missing.length === 0) {
      console.log("  ✅ All required variables set");
    }
  }
  
  console.log("\n" + "=".repeat(40) + "\n");
}

export default { validateEnvironment, getEnv, getRequiredEnv };
