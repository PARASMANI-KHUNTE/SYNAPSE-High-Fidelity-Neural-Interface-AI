const SAFE_USERID_PATTERN = /^user-[a-zA-Z0-9_-]+$/;

export const userIdValidator = (req, res, next) => {
  const userId = req.body?.userId || req.query?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: "Missing userId" });
  }

  if (typeof userId !== "string" || userId.length < 5 || userId.length > 100) {
    return res.status(400).json({ error: "Invalid userId format" });
  }

  if (!SAFE_USERID_PATTERN.test(userId)) {
    return res.status(400).json({ error: "Invalid userId format" });
  }

  next();
};

export const validateUserId = (userId) => {
  if (!userId || typeof userId !== "string") return false;
  if (userId.length < 5 || userId.length > 100) return false;
  if (!SAFE_USERID_PATTERN.test(userId)) return false;
  return true;
};
