import logger from "../utils/logger.js";
import { ZodError } from "zod";

export const errorHandler = (err, req, res, next) => {
  logger.error({ err, url: req.originalUrl, method: req.method }, err.message || "Internal Server Error");

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: err.errors
    });
  }

  // Handle expected operational errors
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message
    });
  }

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message
  });
};

export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API Route Not Found: ${req.originalUrl}`
  });
};
