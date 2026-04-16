import rateLimit from "express-rate-limit";

// Rate limit for standard API calls
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes"
  }
});

// Rate limit for intensive LLM API calls (if exposed over HTTP)
export const llmLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // max 20 requests per minute
  message: {
    success: false,
    message: "Too many LLM requests, please slow down"
  }
});
