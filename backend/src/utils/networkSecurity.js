import net from "net";

const PRIVATE_V4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./
];

const PRIVATE_V6_PATTERNS = [
  /^::1$/i,
  /^fc/i,
  /^fd/i,
  /^fe80:/i
];

export const isInternalHostname = (hostname = "") => {
  const normalized = String(hostname || "").trim().toLowerCase();
  if (!normalized) return true;

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  const ipVersion = net.isIP(normalized);
  const mappedV4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedV4) {
    const ipv4 = mappedV4[1];
    if (!net.isIPv4(ipv4)) {
      return true;
    }
    return PRIVATE_V4_PATTERNS.some((pattern) => pattern.test(ipv4));
  }

  if (ipVersion === 4) {
    return PRIVATE_V4_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  if (ipVersion === 6) {
    return PRIVATE_V6_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  return false;
};

export default {
  isInternalHostname
};
