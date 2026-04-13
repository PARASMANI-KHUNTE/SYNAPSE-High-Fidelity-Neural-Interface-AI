import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../services/tokenService.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeEmail = (value) => String(value || "").trim().toLowerCase();
const sanitizeName = (value) => String(value || "").trim().slice(0, 80);

router.post("/register", async (req, res) => {
  try {
    const email = sanitizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const displayName = sanitizeName(req.body?.displayName || "");

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, displayName });
    const accessToken = signAccessToken({ userId: user._id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ userId: user._id, email: user.email, role: user.role });
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    return res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: String(user._id), email: user.email, displayName: user.displayName, role: user.role }
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = sanitizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = signAccessToken({ userId: user._id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ userId: user._id, email: user.email, role: user.role });
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    return res.json({
      accessToken,
      refreshToken,
      user: { id: String(user._id), email: user.email, displayName: user.displayName, role: user.role }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = String(req.body?.refreshToken || "");
    if (!refreshToken) {
      return res.status(400).json({ error: "Missing refreshToken" });
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(String(payload.sub));
    if (!user || !user.refreshTokenHash) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const incomingHash = hashToken(refreshToken);
    if (incomingHash !== user.refreshTokenHash) {
      return res.status(401).json({ error: "Refresh token revoked" });
    }

    const nextAccess = signAccessToken({ userId: user._id, email: user.email, role: user.role });
    const nextRefresh = signRefreshToken({ userId: user._id, email: user.email, role: user.role });
    user.refreshTokenHash = hashToken(nextRefresh);
    await user.save();

    return res.json({ accessToken: nextAccess, refreshToken: nextRefresh });
  } catch (err) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  await User.findByIdAndUpdate(req.auth.userId, { $set: { refreshTokenHash: "" } });
  return res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.auth.userId).select("_id email displayName role");
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({ user: { id: String(user._id), email: user.email, displayName: user.displayName, role: user.role } });
});

export default router;
