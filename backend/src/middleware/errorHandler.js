import logger from "../utils/logger.js";

const isProduction = process.env.NODE_ENV === "production";

const sanitizeError = (err, statusCode) => {
  if (statusCode >= 500 && isProduction) {
    return "An unexpected error occurred. Please try again later.";
  }
  if (err.message?.includes("ENOENT") || err.code === "ENOENT") {
    return "The requested resource was not found.";
  }
  if (err.message?.includes("EACCES") || err.code === "EACCES") {
    return "Access denied.";
  }
  if (err.message?.includes("ETIMEDOUT") || err.code === "ETIMEDOUT") {
    return "The request timed out. Please try again.";
  }
  return err.message || "An error occurred.";
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: "File too large. Maximum size is 10MB."
      }
    });
  }

  if (err.message?.includes("File type not allowed") || err.message?.includes("MIME type not allowed")) {
    return res.status(415).json({
      success: false,
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: err.message
      }
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err.message
      }
    });
  }

  if (err.name === "UnauthorizedError" || err.message?.includes("Unauthorized")) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required."
      }
    });
  }

  if (err.name === "ForbiddenError" || err.message?.includes("Forbidden")) {
    return res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action."
      }
    });
  }

  logger.error({
    err,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  }, "Request failed");

  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message: sanitizeError(err, statusCode)
    }
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found.`
    }
  });
};
