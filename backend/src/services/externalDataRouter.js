import axios from "axios";
import { searchInternetCached } from "./search.js";

const NEWS_INTENT_PATTERNS = [
  /\b(news|headlines?|breaking|happening|current events?)\b/i
];

const NEWS_FRESHNESS_PATTERNS = [
  /\b(top\s*\d+|top\s+five|latest|today|right now|this week|recent|current)\b/i
];

const MOVIE_INTENT_PATTERNS = [
  /\b(movie|movies|film|films|cinema|box office|tmdb)\b/i,
  /\b(release|released|releases|opening|in theaters|now showing|latest|new)\b/i
];

const WEATHER_INTENT_PATTERNS = [
  /\b(weather|temperature|forecast|rain|storm|humidity|wind)\b/i
];

const WEB_SEARCH_INTENT_PATTERNS = [
  /\b(search (the )?(web|internet)|look up|find online|web search)\b/i
];

const CRYPTO_INTENT_PATTERNS = [
  /\b(bitcoin|btc|ethereum|eth|crypto price|crypto market)\b/i
];

const parseLocation = (message) => {
  const text = String(message || "");
  const direct = text.match(/\b(?:in|at|for)\s+([a-zA-Z][a-zA-Z\s,.-]{1,60})/i);
  if (direct?.[1]) return direct[1].trim();
  return "";
};

const searchNewsViaNewsApi = async (query) => {
  const key = process.env.NEWS_API_KEY || "";
  if (!key) return [];

  const baseUrl = process.env.NEWS_API_BASE_URL || "https://newsapi.org/v2";
  const response = await axios.get(`${baseUrl}/top-headlines`, {
    params: {
      apiKey: key,
      language: "en",
      pageSize: 8,
      q: query || undefined
    },
    timeout: 12000
  });

  const articles = Array.isArray(response.data?.articles) ? response.data.articles : [];
  return articles.map((item) => ({
    title: String(item?.title || "").trim(),
    snippet: String(item?.description || item?.content || "").trim(),
    url: String(item?.url || "").trim(),
    source: String(item?.source?.name || "NewsAPI").trim(),
    fetchedAt: new Date().toISOString()
  })).filter((item) => item.title && item.url);
};

const searchNewsViaGNews = async (query) => {
  const key = process.env.GNEWS_API_KEY || "";
  if (!key) return [];

  const baseUrl = process.env.GNEWS_API_BASE_URL || "https://gnews.io/api/v4";
  const response = await axios.get(`${baseUrl}/search`, {
    params: {
      q: query || "world news",
      lang: "en",
      max: 8,
      token: key
    },
    timeout: 12000
  });

  const articles = Array.isArray(response.data?.articles) ? response.data.articles : [];
  return articles.map((item) => ({
    title: String(item?.title || "").trim(),
    snippet: String(item?.description || "").trim(),
    url: String(item?.url || "").trim(),
    source: String(item?.source?.name || "GNews").trim(),
    fetchedAt: new Date().toISOString()
  })).filter((item) => item.title && item.url);
};

const searchNewsViaWeb = async (query) => {
  const newsQuery = query || "latest world headlines Reuters AP BBC";
  return await searchInternetCached(newsQuery);
};

const fetchNewsItems = async (message) => {
  const query = `${message} latest headlines`;
  let items = await searchNewsViaNewsApi(query);
  if (items.length === 0) items = await searchNewsViaGNews(query);
  if (items.length === 0) items = await searchNewsViaWeb(query);
  return items;
};

const fetchMoviesFromTmdb = async () => {
  const apiKey = process.env.TMDB_API_KEY || "";
  if (!apiKey) return [];

  const baseUrl = process.env.TMDB_API_BASE_URL || "https://api.themoviedb.org/3";
  const region = process.env.TMDB_REGION || "US";

  const response = await axios.get(`${baseUrl}/movie/now_playing`, {
    params: {
      api_key: apiKey,
      language: "en-US",
      page: 1,
      region
    },
    timeout: 12000
  });

  const list = Array.isArray(response.data?.results) ? response.data.results.slice(0, 8) : [];
  return list.map((movie) => ({
    title: String(movie?.title || "").trim(),
    snippet: String(movie?.overview || "").trim(),
    releaseDate: String(movie?.release_date || "").trim(),
    rating: Number(movie?.vote_average || 0),
    url: `https://www.themoviedb.org/movie/${movie?.id}`,
    source: "TMDB",
    fetchedAt: new Date().toISOString()
  })).filter((m) => m.title);
};

const fetchWeather = async (message) => {
  const location = parseLocation(message);
  if (!location) {
    return { requiresLocation: true, location: "" };
  }

  const geo = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
    params: { name: location, count: 1, language: "en", format: "json" },
    timeout: 12000
  });

  const place = Array.isArray(geo.data?.results) ? geo.data.results[0] : null;
  if (!place?.latitude || !place?.longitude) {
    return { requiresLocation: false, unavailable: true, location };
  }

  const weather = await axios.get("https://api.open-meteo.com/v1/forecast", {
    params: {
      latitude: place.latitude,
      longitude: place.longitude,
      current_weather: true,
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "auto"
    },
    timeout: 12000
  });

  return {
    requiresLocation: false,
    unavailable: false,
    placeName: `${place.name}${place.country ? `, ${place.country}` : ""}`,
    current: weather.data?.current_weather || null,
    daily: weather.data?.daily || null,
    source: "Open-Meteo",
    fetchedAt: new Date().toISOString()
  };
};

const fetchCrypto = async (message) => {
  const text = String(message || "").toLowerCase();
  const ids = [];
  if (/(bitcoin|\bbtc\b)/i.test(text)) ids.push("bitcoin");
  if (/(ethereum|\beth\b)/i.test(text)) ids.push("ethereum");
  if (ids.length === 0) ids.push("bitcoin", "ethereum");

  const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
    params: { ids: ids.join(","), vs_currencies: "usd", include_24hr_change: true },
    timeout: 12000
  });

  return {
    prices: response.data || {},
    fetchedAt: new Date().toISOString(),
    source: "CoinGecko"
  };
};

const formatNewsReply = (items) => {
  const list = (Array.isArray(items) ? items : []).slice(0, 5);
  if (list.length === 0) return "";
  const asOf = new Date().toISOString().replace("T", " ").slice(0, 19);
  const lines = [`As of ${asOf} UTC, here are the latest headlines:`];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    lines.push(
      "",
      `${i + 1}. ${item.title}`,
      `Where: Global`,
      `When: ${item.fetchedAt || asOf}`,
      `Source: ${item.source || "unknown"} (${item.url || "N/A"})`,
      `Summary: ${String(item.snippet || "No summary available.").slice(0, 220)}`
    );
  }
  return lines.join("\n");
};

const formatMoviesReply = (items) => {
  const list = (Array.isArray(items) ? items : []).slice(0, 5);
  if (list.length === 0) return "";
  const asOf = new Date().toISOString().replace("T", " ").slice(0, 19);
  const lines = [`As of ${asOf} UTC, latest movie releases:`];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    lines.push(
      "",
      `${i + 1}. ${item.title}`,
      `Where: ${process.env.TMDB_REGION || "US"}`,
      `When: ${item.releaseDate || item.fetchedAt || asOf}`,
      `Source: ${item.source || "TMDB"} (${item.url || "https://www.themoviedb.org"})`,
      `Summary: ${String(item.snippet || "No summary available.").slice(0, 220)}`
    );
  }
  return lines.join("\n");
};

const formatWeatherReply = (data, locationHint) => {
  if (data?.requiresLocation) {
    return "Please provide a city for weather, for example: weather in London.";
  }
  if (data?.unavailable) {
    return `I could not fetch live weather for ${locationHint || "that location"} right now.`;
  }
  const current = data?.current || {};
  const max = data?.daily?.temperature_2m_max?.[0];
  const min = data?.daily?.temperature_2m_min?.[0];
  const rain = data?.daily?.precipitation_probability_max?.[0];
  return [
    `Live weather for ${data.placeName}:`,
    `When: ${data.fetchedAt}`,
    `Source: ${data.source} (https://open-meteo.com/)`,
    `Current: ${current.temperature ?? "N/A"} C, wind ${current.windspeed ?? "N/A"} km/h`,
    `Today: high ${max ?? "N/A"} C, low ${min ?? "N/A"} C, rain chance ${rain ?? "N/A"}%`
  ].join("\n");
};

const formatCryptoReply = (data) => {
  const prices = data?.prices || {};
  const lines = [
    "Live crypto snapshot:",
    `When: ${data?.fetchedAt || new Date().toISOString()}`,
    `Source: ${data?.source || "CoinGecko"} (https://www.coingecko.com/)`
  ];
  for (const [id, value] of Object.entries(prices)) {
    const usd = value?.usd;
    const change = value?.usd_24h_change;
    lines.push(`${id}: USD ${usd ?? "N/A"}${Number.isFinite(change) ? ` (${change.toFixed(2)}% 24h)` : ""}`);
  }
  return lines.join("\n");
};

export const detectExternalIntent = (message = "") => {
  const text = String(message || "");

  if (MOVIE_INTENT_PATTERNS.every((p) => p.test(text))) {
    return { type: "movies", requiresLiveData: true };
  }

  if (NEWS_INTENT_PATTERNS.some((p) => p.test(text))) {
    return { type: "news", requiresLiveData: true };
  }

  if (WEATHER_INTENT_PATTERNS.some((p) => p.test(text))) {
    return { type: "weather", requiresLiveData: true };
  }

  if (CRYPTO_INTENT_PATTERNS.some((p) => p.test(text))) {
    return { type: "crypto", requiresLiveData: true };
  }

  if (WEB_SEARCH_INTENT_PATTERNS.some((p) => p.test(text))) {
    return { type: "web_search", requiresLiveData: true };
  }

  return { type: "none", requiresLiveData: false };
};

export const resolveExternalData = async (message = "") => {
  const intent = detectExternalIntent(message);
  if (intent.type === "none") {
    return { handled: false, requiresLiveData: false, liveDataAvailable: false, reply: "", searchContext: "" };
  }

  try {
    if (intent.type === "movies") {
      const movies = await fetchMoviesFromTmdb();
      const reply = formatMoviesReply(movies);
      return {
        handled: Boolean(reply),
        requiresLiveData: true,
        liveDataAvailable: movies.length > 0,
        reply,
        searchContext: movies.map((m) => `${m.title} | ${m.releaseDate} | ${m.url}`).join("\n")
      };
    }

    if (intent.type === "news") {
      const news = await fetchNewsItems(message);
      const reply = formatNewsReply(news);
      return {
        handled: Boolean(reply),
        requiresLiveData: true,
        liveDataAvailable: news.length > 0,
        reply,
        searchContext: news.map((n) => `${n.title} | ${n.source} | ${n.url}`).join("\n")
      };
    }

    if (intent.type === "weather") {
      const data = await fetchWeather(message);
      const reply = formatWeatherReply(data, parseLocation(message));
      return {
        handled: true,
        requiresLiveData: true,
        liveDataAvailable: Boolean(!data?.requiresLocation && !data?.unavailable),
        reply,
        searchContext: reply
      };
    }

    if (intent.type === "crypto") {
      const data = await fetchCrypto(message);
      const reply = formatCryptoReply(data);
      return {
        handled: true,
        requiresLiveData: true,
        liveDataAvailable: true,
        reply,
        searchContext: reply
      };
    }

    if (intent.type === "web_search") {
      const results = await searchInternetCached(message);
      const reply = formatNewsReply(results);
      return {
        handled: Boolean(reply),
        requiresLiveData: true,
        liveDataAvailable: Array.isArray(results) && results.length > 0,
        reply,
        searchContext: reply
      };
    }
  } catch {
    return { handled: false, requiresLiveData: true, liveDataAvailable: false, reply: "", searchContext: "" };
  }

  return { handled: false, requiresLiveData: true, liveDataAvailable: false, reply: "", searchContext: "" };
};

export default {
  detectExternalIntent,
  resolveExternalData
};
