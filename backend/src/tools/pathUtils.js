import path from "path";

const PROJECT_ROOT = path.resolve(process.cwd());

export const resolveProjectPath = (targetPath = ".") => {
  const resolved = path.resolve(PROJECT_ROOT, targetPath);
  const relative = path.relative(PROJECT_ROOT, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path outside project scope");
  }

  return resolved;
};

export const getProjectRoot = () => PROJECT_ROOT;

export default {
  resolveProjectPath,
  getProjectRoot
};
