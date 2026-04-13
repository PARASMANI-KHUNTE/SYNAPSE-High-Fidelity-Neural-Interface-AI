import { verifyAccessToken } from "../services/tokenService.js";

const getBearerToken = (header = "") => {
  if (!header || typeof header !== "string") return "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
};

export const requireAuth = (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const payload = verifyAccessToken(token);
    req.auth = {
      userId: String(payload.sub),
      email: payload.email || "",
      role: payload.role || "user"
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const requireSocketAuth = (socket, next) => {
  try {
    const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (!token) {
      return next(new Error("Unauthorized"));
    }
    const payload = verifyAccessToken(token);
    socket.auth = {
      userId: String(payload.sub),
      email: payload.email || "",
      role: payload.role || "user"
    };
    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
};
