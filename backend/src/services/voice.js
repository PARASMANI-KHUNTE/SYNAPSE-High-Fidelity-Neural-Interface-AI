import { exec, execFile } from "child_process";
import path from "path";
import fs from "fs";

const runExec = (command, options = {}) =>
  new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const runExecFile = (file, args, options = {}) =>
  new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const ensureUploadsDir = () => {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

const scheduleCleanup = (outputPath, filename) => {
  setTimeout(() => {
    fs.unlink(outputPath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.warn(`[Cleanup] Failed to delete TTS file ${filename}:`, err.message);
      }
    });
  }, 60_000);
};

const getBaseUrl = () => process.env.BASE_URL || "http://localhost:3001";

const sanitizeForSpeech = (text, limit = 2000) =>
  String(text || "")
    .replace(/```[\s\S]*?```/g, " [code block] ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/[`_~>]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, limit);

const detectLanguageProfile = (text) => {
  const content = String(text || "");
  const devanagariChars = (content.match(/[\u0900-\u097F]/g) || []).length;
  const latinChars = (content.match(/[A-Za-z]/g) || []).length;

  if (devanagariChars >= 2 && devanagariChars >= latinChars / 2) {
    return "hi";
  }

  const lowered = content.toLowerCase();
  const hindiRomanMarkers = [
    "kya", "kaise", "kyun", "haan", "nahi", "acha", "accha", "yaar", "mera",
    "meri", "bhai", "aap", "tum", "samajh", "kar", "kr", "hai", "hain", "tha",
    "thi", "matlab", "jaldi", "thoda", "bahut", "namaste", "dhanyavaad", "mujhe"
  ];
  const markerHits = hindiRomanMarkers.filter((marker) => lowered.match(new RegExp(`\\b${marker}\\b`, "i"))).length;
  if (markerHits >= 2) {
    return "en_in";
  }

  return "default";
};

const scriptPath = () => path.join(process.cwd(), "src", "scripts", "tts.py");

const generateScriptTTS = async (text, outputPath, voicePref, engine) => {
  const script = scriptPath();
  if (!fs.existsSync(script)) {
    throw new Error(`TTS script not found: ${script}`);
  }

  const cleanText = sanitizeForSpeech(text, engine === "qwen" ? 2000 : 3000);
  const languageProfile = detectLanguageProfile(cleanText);
  console.log(`[TTS] ${engine} | voice=${voicePref} | chars=${cleanText.length}`);

  await runExecFile("python", [script, cleanText, outputPath, voicePref, engine, languageProfile], {
    timeout: 120_000,
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: "1" }
  });
};

const buildWindowsTtsCommand = (text, outputPath, voicePref) => {
  const escapedText = sanitizeForSpeech(text, 3000).replace(/'/g, "''");
  const escapedPath = outputPath.replace(/'/g, "''");
  const preferredPatterns = voicePref === "female"
    ? ["zira", "aria", "female"]
    : ["david", "guy", "male"];

  const voiceFilter = preferredPatterns
    .map((pattern) => `$_ .VoiceInfo.Name.ToLower().Contains('${pattern}')`.replace("$_ .", "$_."))
    .join(" -or ");

  return [
    "Add-Type -AssemblyName System.Speech;",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
    "$voices = $synth.GetInstalledVoices();",
    `$match = $voices | Where-Object { ${voiceFilter} } | Select-Object -First 1;`,
    "if ($match) { $synth.SelectVoice($match.VoiceInfo.Name) }",
    `$synth.Rate = ${voicePref === "female" ? "1" : "0"};`,
    `$synth.SetOutputToWaveFile('${escapedPath}');`,
    `$synth.Speak('${escapedText}');`,
    "$synth.Dispose();"
  ].join(" ");
};

const generateWindowsNativeTTS = async (text, outputPath, voicePref) => {
  if (process.platform !== "win32") {
    throw new Error("Windows native TTS is only available on win32");
  }

  console.log(`[TTS] native | voice=${voicePref}`);
  const command = buildWindowsTtsCommand(text, outputPath, voicePref);
  await runExec(`powershell -NoProfile -NonInteractive -Command "${command}"`, {
    timeout: 120_000,
    windowsHide: true
  });
};

export const transcribeAudio = async (filePath) => {
  return new Promise((resolve) => {
    console.log(`Transcribing audio locally: ${path.basename(filePath)}...`);

    if (!fs.existsSync(filePath)) {
      console.error("Audio file not found:", filePath);
      return resolve("[Transcription Failed: File not found]");
    }

    const transcribeScriptPath = path.join(process.cwd(), "src", "scripts", "transcribe.py");

    if (!fs.existsSync(transcribeScriptPath)) {
      console.error("Transcription script not found:", transcribeScriptPath);
      return resolve("[Transcription Failed: Script not found]");
    }

    const command = `python "${transcribeScriptPath}" "${filePath}"`;
    exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        console.error("Transcription error:", stderr || error.message);
        return resolve(`[Transcription Failed: ${error.message}]`);
      }

      const transcription = stdout.trim();
      if (!transcription) {
        return resolve("[Transcription Failed: Empty result]");
      }

      console.log("Transcription complete:", transcription.substring(0, 100));
      resolve(transcription);
    });
  });
};

/**
 * Default engine order:
 * - Windows: edge -> qwen -> native
 * - Other OS: qwen -> edge
 *
 * Override with `TTS_ENGINE=edge|qwen|native`.
 */
export const generateTTS = async (text, voicePref = "male") => {
  if (!text || text.length < 2) {
    return null;
  }

  ensureUploadsDir();

  const preferredEngine = process.env.TTS_ENGINE || (process.platform === "win32" ? "edge" : "qwen");
  const attempts = preferredEngine === "native"
    ? ["native", "edge", "qwen"]
    : preferredEngine === "qwen"
      ? ["qwen", "edge", "native"]
      : ["edge", "qwen", "native"];

  for (const engine of attempts) {
    const ext = engine === "edge" ? "mp3" : "wav";
    const filename = `tts_${Date.now()}_${engine}.${ext}`;
    const outputPath = path.join(process.cwd(), "uploads", filename);

    try {
      if (engine === "edge" || engine === "qwen") {
        await generateScriptTTS(text, outputPath, voicePref, engine);
      } else if (engine === "native") {
        await generateWindowsNativeTTS(text, outputPath, voicePref);
      } else {
        continue;
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error(`TTS output missing after ${engine} generation`);
      }

      scheduleCleanup(outputPath, filename);
      return `${getBaseUrl()}/uploads/${filename}`;
    } catch (error) {
      console.error(`[TTS] ${engine} failed:`, error.message);
    }
  }

  return null;
};
