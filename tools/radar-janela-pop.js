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
    required: ["from", "mgm"],
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
    required: ["from", "mgm"],
  },
  {
    label: "Google News - Trailer",
    kind: "news",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent('"Silo season 3" trailer OR "Silo season 3" teaser OR "Silo Apple TV" teaser when:1d') +
      "&hl=en-US&gl=US&ceid=US:en",
    series: "Silo temporada 3",
    required: ["silo", "apple tv"],
  },
  {
    label: "Google News",
    kind: "news",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent('"Silo season 3" OR "Silo Apple TV" when:1d') +
      "&hl=en-US&gl=US&ceid=US:en",
    series: "Silo temporada 3",
    required: ["silo", "apple tv"],
  },
  {
    label: "Google News - Trailer",
    kind: "news",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent('"House of the Dragon season 3" trailer OR "House of the Dragon season 3" teaser OR "HBO" "House of the Dragon" "trailer" when:1d') +
      "&hl=en-US&gl=US&ceid=US:en",
    series: "A Casa do Dragao temporada 3",
    required: ["house of the dragon", "targaryen", "hbo"],
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
    required: ["house of the dragon", "knight of the seven kingdoms", "hbo"],
  },
  {
    label: "Reddit FromSeries",
    kind: "rss",
    url: "https://www.reddit.com/r/FromSeries/new/.rss",
    series: "FROM",
    required: ["from", "tabitha", "victor", "jade", "boyd", "ethan", "julie", "town"],
  },
  {
    label: "Reddit SiloSeries",
    kind: "rss",
    url: "https://www.reddit.com/r/SiloSeries/new/.rss",
    series: "Silo temporada 3",
    required: ["silo", "apple", "juliette"],
  },
  {
    label: "Reddit HOTD",
    kind: "rss",
    url: "https://www.reddit.com/r/HouseOfTheDragon/new/.rss",
    series: "A Casa do Dragao temporada 3",
    required: ["dragon", "targaryen", "rhaenyra", "daemon", "alicent", "westeros"],
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
const IMAGE_BASE = "https://raw.githubusercontent.com/jefq3011-janelapop/portal-janela-pop/main/assets";
const SERIES_IMAGES = {
  "FROM": `${IMAGE_BASE}/from-serie.jpg`,
  "Silo temporada 3": `${IMAGE_BASE}/banner-janela-pop.png`,
  "A Casa do Dragao temporada 3": `${IMAGE_BASE}/house-of-the-dragon-s3.jpg`,
};

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

function cleanSummaryText(value) {
  return String(value || "")
    .replace(/\[image not found\]/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+-\s+(MSN|IGN|Collider|ScreenRant|Variety|Deadline|The Hollywood Reporter|The Movie Blog|AOL\.com|Decider).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]).trim() : "";
}

function getImageFromXml(item) {
  const media =
    item.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
    item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
    item.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\//i);
  if (media) return decodeHtml(media[1]);

  const html = decodeHtml(getTag(item, "description") || getTag(item, "summary") || getTag(item, "content") || "");
  const image = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return image ? decodeHtml(image[1]) : "";
}

function fallbackImage(series) {
  return SERIES_IMAGES[series] || `${IMAGE_BASE}/banner-janela-pop.png`;
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
    const description = cleanSummaryText(stripTags(getTag(item, "description")) || stripTags(getTag(item, "content")) || stripTags(getTag(item, "summary")));
    const id = stripTags(getTag(item, "guid")) || stripTags(getTag(item, "id")) || link || `${source.series}:${title}`;
    return { id, title, link, pubDate, description, source: source.label, series: source.series, image: getImageFromXml(item) || fallbackImage(source.series), required: source.required || [] };
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
      description: cleanSummaryText(data.selftext || ""),
      source: source.label,
      series: source.series,
      image: data.thumbnail && /^https?:\/\//i.test(data.thumbnail) ? data.thumbnail : fallbackImage(source.series),
      required: source.required || [],
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

function isRelevant(item) {
  const text = `${item.title} ${item.description} ${item.series}`.toLowerCase();
  const required = item.required || [];
  if (required.length && !required.some((term) => text.includes(term))) return false;
  if (/among us|hell mode|anime|cricket|sports|stock market|horoscope|weather/i.test(text)) return false;
  if (item.series === "Silo temporada 3" && !/\bsilo\b|apple tv|juliette/i.test(text)) return false;
  if (item.series === "A Casa do Dragao temporada 3" && !/house of the dragon|targaryen|rhaenyra|daemon|alicent|westeros|hbo/i.test(text)) return false;
  if (item.series === "FROM" && !/\bfrom\b|mgm|tabitha|victor|jade|boyd|ethan|julie/i.test(text)) return false;
  return true;
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
  const translatedTitle = buildPtTitle(item, title);
  const summary = summarizeItem(item);
  const videoIdea = buildVideoIdea(item, translatedTitle);
  const hook = buildHook(item, translatedTitle);

  return [
    `NOVIDADE PARA VIDEO - ${urgency}`,
    `Tema: ${translatedTitle}`,
    "",
    `Serie/assunto: ${item.series}`,
    `Fonte: ${item.source}`,
    "",
    `Resumo: ${summary}`,
    "",
    `Por que pode virar video: ${videoIdea}`,
    "",
    `Gancho sugerido: ${hook}`,
    "",
    item.link,
  ].filter(Boolean).join("\n");
}

function buildPtTitle(item, title) {
  const text = `${title} ${item.description}`.toLowerCase();
  if (item.series === "FROM") {
    if (/memory|memoria|children|sacrifice|fracture/.test(text)) return "FROM: teoria da memoria liga as criancas sacrificadas aos misterios da cidade";
    if (/experiment|scientific|simulation|coma|hospital|reality/.test(text)) return "FROM: fas levantam teoria de que a cidade pode ser um experimento cientifico";
    if (/miy|man in yellow|yellow|fear|boy in white|hope|victor/.test(text)) return "FROM: teoria diz que o Homem de Amarelo pode se alimentar do medo dos moradores";
    if (/tabitha|julie|victor|ethan/.test(text)) return "FROM: debate sobre Tabitha, Julie, Victor e Ethan cresce entre os fas";
    if (/jade/.test(text)) return "FROM: nova teoria coloca Jade no centro do misterio";
    if (/boyd/.test(text)) return "FROM: nova discussao coloca Boyd no centro dos proximos acontecimentos";
    return translateTitleToPt(title);
  }
  return translateTitleToPt(title);
}

function translateTitleToPt(title) {
  let translated = cleanSummaryText(title);
  const replacements = [
    [/\bam i the only one that thinks\b/gi, "sou o unico que acha que"],
    [/\bthe only one\b/gi, "o unico"],
    [/\bbecoming irritating\b/gi, "ficando irritantes"],
    [/\birritating\b/gi, "irritante"],
    [/\bdrops on\b/gi, "estreia em"],
    [/\bfull trailer\b/gi, "trailer completo"],
    [/\breveals\b/gi, "revela"],
    [/\bpremiere date\b/gi, "data de estreia"],
    [/\bpremiere\b/gi, "estreia"],
    [/\bin episode\b/gi, "no episodio"],
    [/\btells\b/gi, "diz para"],
    [/\byells at him saying\b/gi, "grita com ele dizendo"],
    [/\bwhat is wrong with you\b/gi, "o que tem de errado com voce"],
    [/\bthis frustrates me\b/gi, "isso incomoda muitos fas"],
    [/\bwhy can't you just listen to him\b/gi, "por que nao simplesmente ouvir ele"],
    [/\bto teach me\b/gi, "me ensinar"],
    [/\bto survive\b/gi, "a sobreviver"],
    [/\bwhen im alone\b/gi, "quando eu estiver sozinho"],
    [/\byou'?re not gonna be here alone\b/gi, "voce nao vai ficar aqui sozinho"],
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
    [/\bfans\b/gi, "fas"],
    [/\bnew\b/gi, "novo"],
    [/\bwhy\b/gi, "por que"],
    [/\bhow\b/gi, "como"],
    [/\bwill\b/gi, "vai"],
    [/\bmay\b/gi, "pode"],
    [/\bsecret\b/gi, "segredo"],
    [/\bspoilers?\b/gi, "spoilers"],
    [/\brecap\b/gi, "resumo"],
    [/\bpreview\b/gi, "previa"],
    [/\bposter\b/gi, "poster"],
    [/\bimages?\b/gi, "imagem"],
    [/\bphotos?\b/gi, "foto"],
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

function summarizeItem(item) {
  const text = `${item.title} ${cleanSummaryText(stripTags(item.description || ""))}`.toLowerCase();

  if (item.series === "FROM") {
    if (/memory|memoria|children|sacrifice|fracture/.test(text)) {
      return "Uma teoria recente defende que FROM pode girar em torno de uma memoria fragmentada criada pelo sacrificio das criancas. A ideia tenta conectar medo, lembrancas, ciclos e a propria origem de Fromville.";
    }
    if (/experiment|scientific|simulation|coma|hospital|reality/.test(text)) {
      return "Fas voltaram a discutir se Fromville pode ser algum tipo de experimento, simulacao ou realidade ligada a coma/hospital. A teoria ganhou forca por causa de cenas recentes que misturam cidade e mundo real.";
    }
    if (/miy|man in yellow|yellow|fear|boy in white|hope|victor/.test(text)) {
      return "A discussao sugere que o Homem de Amarelo talvez nao queira apenas matar, mas se alimentar do medo. O Menino de Branco poderia representar uma falsa esperanca que mantem os moradores presos no ciclo.";
    }
    if (/tabitha|julie|victor|ethan/.test(text)) {
      return "A comunidade esta debatendo as atitudes de Tabitha e Julie diante dos avisos de Victor, principalmente sobre Ethan e a necessidade de preparar a crianca para sobreviver em Fromville.";
    }
    return "Teoria recente da comunidade internacional de FROM trouxe uma leitura nova sobre os misterios da cidade e pode render um video de debate para testar a opiniao do publico brasileiro.";
  }

  if (item.series === "FROM") {
    return "A conversa envolve FROM e pode indicar teoria, novidade de episodio, trailer, imagem promocional ou debate recente da comunidade internacional.";
  }
  if (item.series === "Silo temporada 3") {
    return "A novidade envolve Silo e pode render pauta sobre futuro da serie, producao, elenco, trailer ou expectativas para a terceira temporada.";
  }
  if (item.series === "A Casa do Dragao temporada 3") {
    return "A novidade envolve A Casa do Dragao e pode render pauta sobre a guerra Targaryen, bastidores, trailer ou expectativas para a terceira temporada.";
  }
  return "Assunto recente de cultura pop com potencial para virar pauta, corte ou video rapido no Janela Pop.";
}

function buildVideoIdea(item, title) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (/trailer|teaser|promo/.test(text)) return "trailer sempre tem imediatismo; da para explicar cena por cena, levantar pistas e comparar com teorias que o publico ja acompanha.";
  if (/theory|teoria|explained|ending|finale/.test(text)) return "teoria gera debate nos comentarios e pode virar video com pergunta forte, especialmente se conectar pistas antigas com novidade recente.";
  if (/release date|confirmed|official|cast|filming|production/.test(text)) return "noticia confirmada ajuda a pegar busca do Google/YouTube e posicionar o canal rapido antes dos concorrentes brasileiros.";
  if (item.series === "FROM") return "FROM e prioridade do canal; qualquer detalhe recente pode virar video curto com misterio, gancho e chamada para debate.";
  return "o assunto esta fresco e pode ser adaptado para o publico brasileiro com contexto rapido e opiniao do Janela Pop.";
}

function buildHook(item, title) {
  if (item.series === "FROM") return `FROM acabou de ganhar uma pista que pode mudar a leitura da serie: ${title}`;
  if (item.series === "Silo temporada 3") return `Silo voltou ao radar e essa novidade pode revelar o caminho da temporada 3: ${title}`;
  if (item.series === "A Casa do Dragao temporada 3") return `A guerra em Westeros pode estar ficando mais clara depois dessa novidade: ${title}`;
  return `Essa novidade esta ganhando forca la fora e pode chegar forte no Brasil: ${title}`;
}

async function sendTelegram(text, image) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log("Telegram nao configurado; alerta nao enviado.");
    return;
  }

  const method = image ? "sendPhoto" : "sendMessage";
  const body = image
    ? { chat_id: chatId, photo: image, caption: text.slice(0, 1024) }
    : { chat_id: chatId, text, disable_web_page_preview: false };

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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
    .filter(isRelevant)
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
    await sendTelegram(alert, item.image || fallbackImage(item.series));
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
