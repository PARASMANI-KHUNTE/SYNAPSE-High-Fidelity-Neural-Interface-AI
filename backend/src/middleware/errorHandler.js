import logger from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      status: "error",
      message: "File too large. Maximum size is 10MB."
    });
  }

  if (err.message?.includes("File type not allowed") || err.message?.includes("MIME type not allowed")) {
    return res.status(400).json({
      status: "error",
      message: err.message
    });
  }

  logger.error({
    err,
    path: req.originalUrl,
    method: req.method
  }, "Request failed");

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: process.env.NODE_ENV === "production" && statusCode === 500
      ? "Internal Server Error"
      : err.message || "Internal Server Error"
  });
};
