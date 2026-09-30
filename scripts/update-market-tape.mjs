import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "market-tape.json");
const distOutputPath = resolve(root, "dist", "market-tape.json");
const apiKey = process.env.TWELVE_DATA_API_KEY;
const symbols = ["BBCA", "DSSA", "BBRI", "TPIA", "BMRI", "BRPT", "ANTM", "BNBR", "AMMN", "BRMS", "EMAS", "DEWA"];

if (!apiKey) throw new Error("TWELVE_DATA_API_KEY is required");

const previous = JSON.parse(await readFile(outputPath, "utf8"));
const previousBySymbol = new Map((previous.stocks || []).map((item) => [item.symbol, item]));

function parseDailyBars(symbol, payload) {
  if (payload?.status === "error") throw new Error(`${symbol}: ${payload.message}`);
  const bars = Array.isArray(payload.values) ? payload.values : [];
  if (bars.length < 2) throw new Error(`${symbol}: fewer than two daily bars`);
  const last = Number(bars[0].close);
  const prior = Number(bars[1].close);
  if (!(last > 0) || !(prior > 0)) throw new Error(`${symbol}: invalid closing prices`);
  return {
    symbol,
    last,
    changePct: (last - prior) / prior,
    session: bars[0].datetime,
  };
}

async function getDailyBars(symbol, index) {
  // Twelve Data's basic quota is eight requests per minute. Spacing calls also
  // prevents a single scheduled refresh from producing HTTP 429 responses.
  if (index) await new Promise((resolveDelay) => setTimeout(resolveDelay, 8_000));
  const params = new URLSearchParams({
    symbol: `${symbol}:IDX`,
    interval: "1day",
    outputsize: "2",
    timezone: "Asia/Jakarta",
    apikey: apiKey,
  });
  const response = await fetch(`https://api.twelvedata.com/time_series?${params}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${symbol}: HTTP ${response.status}${payload?.message ? ` — ${payload.message}` : ""}`);
  }
  return parseDailyBars(symbol, payload);
}

const settled = [];
for (const [index, symbol] of symbols.entries()) {
  try {
    settled.push({ status: "fulfilled", value: await getDailyBars(symbol, index) });
  } catch (reason) {
    settled.push({ status: "rejected", reason });
  }
}
const fresh = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
const failed = settled.filter((item) => item.status === "rejected");

failed.forEach((item) => console.error(item.reason instanceof Error ? item.reason.message : item.reason));

if (fresh.length < Math.ceil(symbols.length / 2)) {
  throw new Error(`Only ${fresh.length}/${symbols.length} symbols refreshed; preserving the prior tape`);
}

const latestSession = fresh.map((item) => item.session).sort().at(-1);
const previousSession = String(previous.session || "");
if (previousSession && latestSession < previousSession) {
  throw new Error(`Provider session ${latestSession} is older than saved session ${previousSession}`);
}

const freshBySymbol = new Map(fresh.map((item) => [item.symbol, item]));
const stocks = symbols.map((symbol) => {
  const item = freshBySymbol.get(symbol);
  if (item && item.session === latestSession) {
    return { symbol, last: item.last, changePct: item.changePct };
  }
  const fallback = previousBySymbol.get(symbol);
  if (!fallback) throw new Error(`${symbol}: no fresh or previous value available`);
  return fallback;
});

const payload = {
  session: latestSession,
  updatedAt: new Date().toISOString(),
  source: "Twelve Data XIDX end-of-day",
  stocks,
};
const serialized = `${JSON.stringify(payload, null, 2)}\n`;
await writeFile(outputPath, serialized);
await mkdir(dirname(distOutputPath), { recursive: true });
await writeFile(distOutputPath, serialized);

if (failed.length) {
  console.warn(`${failed.length} symbol(s) used their previous valid value`);
}
console.log(`Updated ${fresh.length}/${symbols.length} symbols for ${latestSession}`);
