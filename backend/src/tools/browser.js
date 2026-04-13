import axios from "axios";
import * as cheerio from "cheerio";
import { isInternalHostname } from "../utils/networkSecurity.js";

const MAX_TEXT_LENGTH = 4000;

const normalizeUrl = (value = "") => {
  const input = String(value || "").trim();
  if (!input) {
    throw new Error("URL is required");
  }

  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const parsed = new URL(withProtocol);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }

  if (isInternalHostname(parsed.hostname)) {
    throw new Error("Internal and local network targets are not allowed");
  }

  return parsed.toString();
};

const extractPageText = (html) => {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim();
  const text = $("main, article, body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);

  return { title, text };
};

const browserTool = {
  name: "browser",
  description: "Fetch a public web page and extract readable text",
  risk: "low",
  requiresConfirmation: false,
  readOnly: true,
  schema: {
    url: { type: "string", required: true }
  },
  validate(params = {}) {
    return {
      url: normalizeUrl(params.url)
    };
  },
  async execute(params = {}) {
    const { url } = browserTool.validate(params);
    const response = await axios.get(url, {
      timeout: 10000,
      maxContentLength: 2 * 1024 * 1024,
      responseType: "text",
      headers: {
        "User-Agent": "SynapseBrowserTool/1.0"
      }
    });

    const { title, text } = extractPageText(response.data || "");
    const summary = [
      `URL: ${url}`,
      `Title: ${title || "Untitled page"}`,
      "",
      text || "No readable text content found."
    ].join("\n");

    return {
      success: true,
      output: summary,
      metadata: {
        url,
        title,
        contentLength: text.length
      }
    };
  }
};

export default browserTool;
