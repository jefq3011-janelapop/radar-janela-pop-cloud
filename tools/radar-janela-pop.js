const fs = require("fs");
const path = require("path");

const SOURCES = [
  {
    label: "Google News - Trailer",
    kind: "news",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(
        '("FROM" "trailer" "MGM+" OR "FROM season" "trailer" OR "FROM episode" "promo") when:1d'
      ) +
      "&hl=en-US&gl=US&ceid=US:en",
    series: "FROM",
  },
  {
    label: "Google News",
    kind: "news",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(
        '(FROM MGM OR "FROM season" OR "FROM TV series") when:1d'
      ) +
      "&hl=en-US&gl=US&ceid=US:en",
    series: "FROM",
  },
  {
    label: "Google News - Trailer",
    kind: "news",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent('"Silo season 3" trailer OR "Silo season 3" teaser OR "Silo Apple TV" teaser when:1d') +
      "&hl=en-US&gl=US&ceid=US:en",
    series: "Silo temporada 3",
  },
  {
    label: "Google News",
    kind: "news",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent('"Silo season 3" OR "Silo Apple TV" when:1d') +
      "&hl=en-US&gl=US&ceid=US:en",
    series: "Silo temporada 3",
  },
  {
    label: "Google News - Trailer",
    kind: "news",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent('"House of the Dragon season 3" trailer OR "House of the Dragon season 3" teaser OR "HBO" "House of the Dragon" "trailer" when:1d') +
      "&hl=en-US&gl=US&ceid=US:en",
    series: "A Casa do Dragao temporada 3",
  },
  {
    label: "Google News",
    kind: "news",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(
        '"House of the Dragon season 3" OR "A Knight of the Seven Kingdoms" when:1d'
      ) +
      "&hl=en-US&gl=US&ceid=US:en",
    series: "A Casa do Dragao temporada 3",
  },
  {
    label: "Reddit FromSeries",
    kind: "rss",
    url: "https://www.reddit.com/r/FromSeries/new/.rss",
    series: "FROM",
  },
  {
    label: "Reddit SiloSeries",
    kind: "rss",
    url: "https://www.reddit.com/r/SiloSeries/new/.rss",
    series: "Silo temporada 3",
  },
  {
    label: "Reddit HOTD",
    kind: "rss",
    url: "https://www.reddit.com/r/HouseOfTheDragon/new/.rss",
    series: "A Casa do Dragao temporada 3",
  },
];

const IMPORTANT_TERMS = [
  "trailer",
  "teaser",
  "release date",
  "confirmed",
  "official",
  "episode",
  "theory",
  "explained",
  "cast",
  "filming",
  "production",
  "leak",
  "rumor",
  "season 3",
  "season 4",
  "finale",
];

const STATE_FILE = path.join(__dirname, "..", "data", "radar-state.json");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]).trim() : "";
}

function parseRss(xml, source) {
  const itemMatches = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match) => match[0]);
  const entryMatches = Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)).map((match) => match[0]);
  const items = itemMatches.length ? itemMatches : entryMatches;

  return items.map((item) => {
    const title = stripTags(getTag(item, "title"));
    let link = stripTags(getTag(item, "link"));
    if (!link) {
      const href = item.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = href ? decodeHtml(href[1]) : "";
    }
    const pubDate = stripTags(getTag(item, "pubDate")) || stripTags(getTag(item, "updated")) || stripTags(getTag(item, "published"));
    const description = stripTags(getTag(item, "description")) || stripTags(getTag(item, "content")) || stripTags(getTag(item, "summary"));
    const id = stripTags(getTag(item, "guid")) || stripTags(getTag(item, "id")) || link || `${source.series}:${title}`;
    return { id, title, link, pubDate, description, source: source.label, series: source.series };
  });
}

function parseReddit(json, source) {
  return (json.data?.children || []).map((child) => {
    const data = child.data || {};
    return {
      id: data.id ? `reddit:${data.id}` : data.url,
      title: data.title || "",
      link: data.permalink ? `https://www.reddit.com${data.permalink}` : data.url,
      pubDate: data.created_utc ? new Date(data.created_utc * 1000).toUTCString() : "",
      description: data.selftext || "",
      source: source.label,
      series: source.series,
      score: data.score || 0,
      comments: data.num_comments || 0,
    };
  });
}

function scoreItem(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let score = 0;
  for (const term of IMPORTANT_TERMS) {
    if (text.includes(term)) score += 1;
  }
  if (/trailer|teaser|official|confirmed|release date/i.test(text)) score += 3;
  if (/theory|explained|ending|finale/i.test(text)) score += 2;
  if ((item.comments || 0) >= 10) score += 2;
  if ((item.score || 0) >= 20) score += 1;
  return score;
}

function isRecent(item) {
  const maxAgeMinutes = Number(process.env.RADAR_MAX_AGE_MINUTES || (process.env.CI ? 90 : 1440));
  const publishedAt = Date.parse(item.pubDate || "");
  if (!Number.isFinite(publishedAt)) return true;

  const ageMinutes = (Date.now() - publishedAt) / 60000;
  return ageMinutes >= 0 && ageMinutes <= maxAgeMinutes;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { seen: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "user-agent": "JanelaPopRadar/1.0 (+https://github.com/) Node.js",
      accept: source.kind === "reddit" ? "application/json" : "application/rss+xml,application/atom+xml,text/xml,*/*",
    },
  });
  if (!response.ok) throw new Error(`${source.label} ${source.series}: HTTP ${response.status}`);

  if (source.kind === "reddit") {
    return parseReddit(await response.json(), source);
  }
  return parseRss(await response.text(), source);
}

function buildAlert(item) {
  const title = item.title.slice(0, 240);
  const urgency = /trailer|teaser|official|confirmed|release date/i.test(title)
    ? "ALTA"
    : scoreItem(item) >= 3
      ? "MEDIA"
      : "BAIXA";
  const translatedTitle = translateTitleToPt(title);

  return [
    `ALERTA JANELA POP - ${urgency}`,
    `Serie: ${item.series}`,
    `Fonte: ${item.source}`,
    `Novidade: ${translatedTitle}`,
    translatedTitle === title ? "" : `Original: ${title}`,
    `Ideia de video: explicar a novidade em portugues e puxar o impacto para o publico BR.`,
    item.link,
  ].filter(Boolean).join("\n");
}

function translateTitleToPt(title) {
  let translated = title;
  const replacements = [
    [/\bfinal trailer\b/gi, "trailer final"],
    [/\btrailer\b/gi, "trailer"],
    [/\bteaser\b/gi, "teaser"],
    [/\bseason 3\b/gi, "temporada 3"],
    [/\bseason 4\b/gi, "temporada 4"],
    [/\brelease date\b/gi, "data de estreia"],
    [/\brevealed\b/gi, "revelada"],
    [/\bexplained\b/gi, "explicado"],
    [/\btheory\b/gi, "teoria"],
    [/\btheories\b/gi, "teorias"],
    [/\bepisode\b/gi, "episodio"],
    [/\bnew episode\b/gi, "novo episodio"],
    [/\bwhat to expect\b/gi, "o que esperar"],
    [/\bofficial\b/gi, "oficial"],
    [/\bconfirmed\b/gi, "confirmado"],
    [/\bfilming\b/gi, "gravacoes"],
    [/\bproduction\b/gi, "producao"],
    [/\bcast\b/gi, "elenco"],
    [/\brumor\b/gi, "rumor"],
    [/\bleak\b/gi, "vazamento"],
    [/\bending\b/gi, "final"],
    [/\bfinale\b/gi, "episodio final"],
    [/\bpromises\b/gi, "promete"],
    [/\bsuffering\b/gi, "sofrimento"],
    [/\bwar\b/gi, "guerra"],
    [/\bfire\b/gi, "fogo"],
    [/\bwatch\b/gi, "assistir"],
    [/\barrived\b/gi, "chegou"],
    [/\bfirst official look\b/gi, "primeira previa oficial"],
    [/\btakes\b/gi, "toma"],
    [/\bKing's Landing\b/gi, "Porto Real"],
    [/\bthings get interesting\b/gi, "as coisas ficam interessantes"],
    [/\bHouse of the Dragon\b/gi, "A Casa do Dragao"],
    [/\bFrom\b/g, "FROM"],
  ];

  for (const [pattern, value] of replacements) {
    translated = translated.replace(pattern, value);
  }

  return translated
    .replace(/\s+—\s+/g, " - ")
    .replace(/\s+-\s+([A-Z][A-Za-z .]+)$/g, " - fonte: $1")
    .replace(/\s+/g, " ")
    .trim();
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log("Telegram nao configurado; alerta nao enviado.");
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram falhou: ${JSON.stringify(result)}`);
  }
}

async function main() {
  loadEnvFile(path.join(__dirname, "..", ".env.telegram"));

  const state = loadState();
  const allItems = [];
  const errors = [];

  for (const source of SOURCES) {
    try {
      allItems.push(...(await fetchSource(source)));
    } catch (error) {
      errors.push(error.message);
    }
  }

  const candidates = allItems
    .map((item) => ({ ...item, priorityScore: scoreItem(item) }))
    .filter((item) => item.priorityScore >= 3)
    .filter(isRecent)
    .filter((item) => !state.seen[item.id])
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3);

  if (!candidates.length) {
    console.log("Radar Janela Pop: nenhuma novidade forte encontrada agora.");
    if (errors.length) console.log(`Avisos: ${errors.join(" | ")}`);
    saveState(state);
    return;
  }

  for (const item of candidates) {
    const alert = buildAlert(item);
    console.log(alert);
    await sendTelegram(alert);
    state.seen[item.id] = {
      title: item.title,
      link: item.link,
      series: item.series,
      sentAt: new Date().toISOString(),
    };
  }

  const entries = Object.entries(state.seen).slice(-500);
  state.seen = Object.fromEntries(entries);
  saveState(state);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
