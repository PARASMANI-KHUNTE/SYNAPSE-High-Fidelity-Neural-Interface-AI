import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/env.js";

export const signAccessToken = ({ userId, email, role = "user" }) =>
  jwt.sign(
    { sub: String(userId), email, role, typ: "access" },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );

export const signRefreshToken = ({ userId, email, role = "user" }) =>
  jwt.sign(
    { sub: String(userId), email, role, typ: "refresh" },
    config.auth.jwtRefreshSecret,
    { expiresIn: config.auth.jwtRefreshExpiresIn }
  );

export const verifyAccessToken = (token) => jwt.verify(token, config.auth.jwtSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, config.auth.jwtRefreshSecret);

export const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");
