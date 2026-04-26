import { execSync } from "child_process";

const targetPort = Number.parseInt(process.argv[2] || process.env.PORT || "3001", 10);

if (!Number.isFinite(targetPort) || targetPort <= 0) {
  console.error("[dev] Invalid port passed to ensure-port-free.js");
  process.exit(1);
}

const ownPid = process.pid;

const run = (command) => execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getListeningPids = (port) => {
  try {
    if (process.platform === "win32") {
      const output = run(`netstat -ano -p tcp | findstr :${port}`);
      const pids = new Set();

      for (const rawLine of output.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || !line.includes("LISTENING")) continue;

        const parts = line.split(/\s+/);
        const pid = Number.parseInt(parts[parts.length - 1], 10);
        if (Number.isFinite(pid) && pid > 0) pids.add(pid);
      }

      return Array.from(pids);
    }

    const output = run(`lsof -iTCP:${port} -sTCP:LISTEN -t`);
    return output
      .split(/\r?\n/)
      .map((v) => Number.parseInt(v.trim(), 10))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
};

const getProcessName = (pid) => {
  try {
    if (process.platform === "win32") {
      const output = run(`powershell -NoProfile -Command "(Get-Process -Id ${pid}).ProcessName"`);
      return output.trim().toLowerCase();
    }

    const output = run(`ps -p ${pid} -o comm=`);
    return output.trim().toLowerCase();
  } catch {
    return "";
  }
};

const getProcessDetails = (pid) => {
  try {
    if (process.platform === "win32") {
      const output = run(
        `powershell -NoProfile -Command "$p=Get-CimInstance Win32_Process -Filter \"ProcessId=${pid}\"; if($p){\"$($p.Name) $($p.CommandLine)\"}"`
      );
      return output.trim().toLowerCase();
    }

    const output = run(`ps -p ${pid} -o command=`);
    return output.trim().toLowerCase();
  } catch {
    return "";
  }
};

const killPid = (pid) => {
  if (pid === ownPid) return;

  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {
    // Best-effort cleanup only.
  }
};

const waitUntilPortFree = async (port, attempts = 12, delayMs = 250) => {
  for (let i = 0; i < attempts; i += 1) {
    const listeners = getListeningPids(port);
    if (listeners.length === 0) {
      return true;
    }
    await sleep(delayMs);
  }
  return false;
};

const main = async () => {
  const pids = getListeningPids(targetPort);
  if (pids.length === 0) {
    console.log(`[dev] Port ${targetPort} is free.`);
    process.exit(0);
  }

  let killedAny = false;
  for (const pid of pids) {
    if (pid === ownPid) continue;

    const name = getProcessName(pid);
    const details = getProcessDetails(pid);
    const looksLikeNode = name.includes("node") || details.includes("node") || details.includes("nodemon");

    if (looksLikeNode) {
      console.log(`[dev] Releasing port ${targetPort} by stopping stale Node process PID ${pid}.`);
      killPid(pid);
      killedAny = true;
    }
  }

  if (!killedAny) {
    console.warn(`[dev] Port ${targetPort} is busy, but no Node listener was auto-killed.`);
    process.exit(0);
  }

  const released = await waitUntilPortFree(targetPort);
  if (released) {
    console.log(`[dev] Port ${targetPort} is free.`);
  } else {
    console.warn(`[dev] Port ${targetPort} still appears busy after cleanup.`);
  }

  process.exit(0);
};

main().catch(() => process.exit(0));
