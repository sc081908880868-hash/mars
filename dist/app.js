const SHEET_ID = "1N3DukPrLJBfqUW4jo0v72tuaPvD_4aVdao9k9sHVOxg";
const REFRESH_MS = 4 * 60 * 1000;
const CACHE_KEY = "ssj-dashboard-cache-v3";
const CACHE_MAX_AGE = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30000;
const REQUEST_CONCURRENCY = 4;
const REQUEST_ATTEMPTS = 2;
const COLORS = ["#ffb000", "#23a7ff", "#00d084", "#ff4d4d", "#30d5ff", "#e6e8ec"];

const RANGES = {
  freddySummary: ["PI-FREDDY PORTFOLIO", "A3:K3"],
  freddyPositions: ["PI-FREDDY PORTFOLIO", "A7:I25"],
  freddyBlockMeta: ["PI-FREDDY PORTFOLIO", "A29:R30"],
  freddyBlockTrades: ["PI-FREDDY PORTFOLIO", "A32:R80"],
  freddyDashboard: ["PI-FREDDY", "I2:M24"],
  freddyHistory: ["PI-FREDDY", "AA2:AF260"],
  freddyRealized: ["PI-FREDDY", "A4:H300"],
  combinedGrowth: ["COMBINED ACTIVE PORTFOLIO", "A80:B140"],
  jasonCash: ["PI JASON", "A5:B11"],
  jasonSummary: ["PI JASON", "K5:O11"],
  jasonInfo: ["PI JASON", "I11:K11"],
  jasonPositions: ["PI JASON", "C6:H12"],
  jasonTransactions: ["PI JASON", "A15:Q180"],
  shemCash: ["PI SHEM", "A5:B11"],
  shemSummary: ["PI SHEM", "K5:O11"],
  shemInfo: ["PI SHEM", "I11:K11"],
  shemPositions: ["PI SHEM", "C6:H12"],
  shemTransactions: ["PI SHEM", "A15:Q180"],
  robbyCash: ["IPO ROBBY - CLOSED", "A5:B11"],
  robbySummary: ["IPO ROBBY - CLOSED", "K5:O11"],
  robbyInfo: ["IPO ROBBY - CLOSED", "I11:K11"],
  robbyPositions: ["IPO ROBBY - CLOSED", "C6:H12"],
  robbyTransactions: ["IPO ROBBY - CLOSED", "A15:Q350"],
};

const DETAIL_KEYS = {
  freddy: ["freddyBlockMeta", "freddyBlockTrades", "freddyRealized"],
  jason: ["jasonTransactions"],
  shem: ["shemTransactions"],
  robby: ["robbyTransactions"],
};
const DETAIL_KEY_SET = new Set(Object.values(DETAIL_KEYS).flat());
const CORE_KEYS = Object.keys(RANGES).filter((key) => !DETAIL_KEY_SET.has(key));

const TRENDING_STOCKS = [
  { symbol: "BBCA", last: "6,100", changePct: 0.0517 },
  { symbol: "DSSA", last: "840", changePct: 0.0435 },
  { symbol: "BBRI", last: "2,720", changePct: 0.0112 },
  { symbol: "TPIA", last: "2,230", changePct: 0.0141 },
  { symbol: "BMRI", last: "4,020", changePct: 0.0308 },
  { symbol: "BRPT", last: "1,870", changePct: 0.0067 },
  { symbol: "ANTM", last: "2,910", changePct: 0.0543 },
  { symbol: "BNBR", last: "109", changePct: 0.0381 },
  { symbol: "AMMN", last: "4,270", changePct: 0.0071 },
  { symbol: "BRMS", last: "625", changePct: 0.0331 },
  { symbol: "EMAS", last: "7,775", changePct: 0.031 },
  { symbol: "DEWA", last: "454", changePct: 0.0167 },
];

const COMPANY_META = {
  EMAS: ["Merdeka Gold Resources", "merdekagoldresources.com"],
  MDRN: ["Modern Internasional", "moderninternasional.co.id"],
  DSSA: ["Dian Swastatika Sentosa", "dssa.co.id"],
  SSIA: ["Surya Semesta Internusa", "suryainternusa.com"],
  ARKO: ["Arkora Hydro", "arkora.co.id"],
  BUVA: ["Bukit Uluwatu Villa", "alilahotels.com"],
  BRMS: ["Bumi Resources Minerals", "brm.co.id"],
  EMMI: ["Esa Medika Mandiri", ""],
  PRDL: ["Prodia Diagnostic Line", "prodia.co.id"],
  JELI: ["Niramas Utama", ""],
  RANS: ["RANS", "ransentertainment.co.id"],
  TPIA: ["Chandra Asri Pacific", "chandra-asri.com"],
  BNBR: ["Bakrie & Brothers", "bakrie-brothers.com"],
  VKTR: ["VKTR Teknologi Mobilitas", "vktr.id"],
  DEWA: ["Darma Henwa", "ptdh.co.id"],
  BRPT: ["Barito Pacific", "barito-pacific.com"],
  AMMN: ["Amman Mineral Internasional", "amman.co.id"],
  PTRO: ["Petrosea", "petrosea.com"],
};

const VIEW_COPY = {
  overview: ["Executive fund dashboard", "PI Freddy Overview"],
  freddy: ["Primary active fund", "PI Freddy Book"],
  jason: ["Active satellite fund", "PI Jason Book"],
  shem: ["Active growth fund", "PI Shem Book"],
  robby: ["Completed fund review", "PI Robby Closed Book"],
  research: ["Research library", "Research & Market Outlooks"],
};

let currentModel = null;
let currentView = "overview";
let rawData = {};
let refreshPromise = null;
let chartRange = "1M";
const freshlyLoadedDetails = new Set();
const scenarioPrices = { freddy: new Map() };
const $ = (id) => document.getElementById(id);

const idrFmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const numberFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const priceFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percentFmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });

function gvizRange(sheet, range, forceFresh = false) {
  const callbackName = `ssjSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const params = new URLSearchParams({
    headers: "0",
    sheet,
    range,
    tqx: `out:json;responseHandler:${callbackName}`,
    cacheBust: String(forceFresh ? Date.now() : Math.floor(Date.now() / 30000)),
  });
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out loading ${sheet}`));
    }, REQUEST_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      cleanup();
      if (response.status !== "ok") {
        reject(new Error(response.errors?.[0]?.detailed_message || `Could not load ${sheet}`));
        return;
      }
      resolve(toMatrix(response.table));
    };
    script.onerror = () => {
      cleanup();
      reject(new Error(`Could not load ${sheet}`));
    };
    script.src = url;
    document.body.appendChild(script);
  });
}

function toMatrix(table) {
  return table.rows.map((row) =>
    table.cols.map((_, index) => {
      const cell = row.c?.[index];
      if (!cell) return { value: null, formatted: "" };
      return { value: normalizeValue(cell.v), formatted: cell.f || String(cell.v ?? "") };
    }),
  );
}

function normalizeValue(input) {
  if (typeof input === "string" && input.startsWith("Date(")) {
    const parts = input.slice(5, -1).split(",").map((part) => Number(part.trim()));
    return new Date(parts[0], parts[1], parts[2], parts[3] || 0, parts[4] || 0, parts[5] || 0);
  }
  return input;
}

function value(row, index) {
  return row?.[index]?.value ?? null;
}

function asNumber(input) {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return 0;
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const percent = trimmed.endsWith("%");
  const negative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const parsed = Number(trimmed.replace(/[(),\s]/g, "").replace(/Rp/gi, "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  const signed = negative ? -parsed : parsed;
  return percent ? signed / 100 : signed;
}

function parseDate(input) {
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
  if (typeof input === "number" && input > 30000) return new Date(Date.UTC(1899, 11, 30 + Math.floor(input)));
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const parsed = new Date(trimmed.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function escapeHtml(input) {
  return String(input ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function idr(input, compact = false) {
  const amount = asNumber(input);
  if (compact) return `${amount < 0 ? "-" : ""}Rp${compactFmt.format(Math.abs(amount))}`;
  return idrFmt.format(amount).replace(/\s/g, "");
}

function pct(input) {
  return percentFmt.format(asNumber(input));
}

function signedClass(input) {
  const amount = asNumber(input);
  return amount > 0 ? "positive" : amount < 0 ? "negative" : "";
}

function companyFor(ticker) {
  const clean = String(ticker || "").trim().toUpperCase();
  const [name = "Listed company", domain = ""] = COMPANY_META[clean] || [];
  return { name, domain };
}

function logoMarkup(ticker) {
  const clean = String(ticker || "").trim().toUpperCase();
  const { domain } = companyFor(clean);
  const source = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";
  return `<span class="company-logo" aria-hidden="true">${source ? `<img src="${source}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" />` : ""}<span class="company-logo-fallback" ${source ? "hidden" : ""}>${escapeHtml(clean.slice(0, 2) || "ID")}</span></span>`;
}

function positionCostBasis(position) {
  return asNumber(position.costBasis) || (asNumber(position.lots) * 100 * asNumber(position.avgCost));
}

function numberInputValue(input) {
  const amount = asNumber(input);
  return amount > 0 ? String(Math.round(amount * 100) / 100) : "";
}

function recalcPositionsWithScenario(book, positions) {
  const overrides = scenarioPrices[book];
  const repriced = positions.map((position) => {
    const scenario = overrides?.get(position.ticker);
    const current = Number.isFinite(scenario) && scenario > 0 ? scenario : asNumber(position.current);
    const lots = asNumber(position.lots);
    const costBasis = positionCostBasis(position);
    const marketValue = lots * 100 * current;
    const unrealized = marketValue - costBasis;
    return {
      ...position,
      current,
      costBasis,
      marketValue,
      unrealized,
      returnPct: costBasis ? unrealized / costBasis : 0,
    };
  });
  const totalMarketValue = repriced.reduce((sum, position) => sum + asNumber(position.marketValue), 0);
  return repriced.map((position) => ({
    ...position,
    weight: totalMarketValue ? asNumber(position.marketValue) / totalMarketValue : 0,
  }));
}

function recalcFreddySummary(fund, positions) {
  const marketValue = positions.reduce((sum, position) => sum + asNumber(position.marketValue), 0);
  const costBasis = positions.reduce((sum, position) => sum + asNumber(position.costBasis), 0);
  const unrealized = marketValue - costBasis;
  const realized = asNumber(fund.summary.realized);
  return {
    ...fund.summary,
    marketValue,
    costBasis,
    unrealized,
    realized,
    totalPnl: realized + unrealized,
    openCount: positions.length,
  };
}

function restoreScenarioFocus(book, ticker) {
  const input = [...document.querySelectorAll("[data-scenario-price]")]
    .find((candidate) => candidate.dataset.book === book && candidate.dataset.ticker === ticker);
  if (!(input instanceof HTMLInputElement)) return;
  input.focus({ preventScroll: true });
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

function rerenderScenario(book, activeTicker) {
  if (!currentModel || book !== "freddy") return;
  renderOverview(currentModel);
  renderFreddy(currentModel.freddy);
  window.requestAnimationFrame(() => {
    renderVisibleCharts();
    if (activeTicker) restoreScenarioFocus(book, activeTicker);
  });
}

function readDashboardCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (!cached?.savedAt || !cached?.data || Date.now() - cached.savedAt > CACHE_MAX_AGE) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeDashboardCache() {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: rawData }));
  } catch {
    // The dashboard still works when private browsing blocks session storage.
  }
}

async function fetchRangeKeys(keys, forceFresh = false) {
  const queue = [...keys];
  const loadedKeys = [];
  const failed = [];

  async function loadKey(key) {
    const [sheet, range] = RANGES[key];
    let lastError;
    for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt += 1) {
      try {
        rawData[key] = await gvizRange(sheet, range, forceFresh || attempt > 1);
        loadedKeys.push(key);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    failed.push({ key, error: lastError });
  }

  async function worker() {
    while (queue.length) {
      const key = queue.shift();
      if (key) await loadKey(key);
    }
  }

  const workerCount = Math.min(REQUEST_CONCURRENCY, queue.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { loadedKeys, failed };
}

async function loadDashboard(options = {}) {
  if (refreshPromise) return refreshPromise;
  const forceFresh = Boolean(options.forceFresh);
  const activeDetails = DETAIL_KEYS[currentView] || [];
  const keys = [...new Set([...CORE_KEYS, ...activeDetails])];
  const refreshButton = $("refreshButton");
  setSync("loading", "Refreshing", "Updating visible data");
  $("refreshNote").textContent = "Updating";
  refreshButton.disabled = true;
  refreshButton.setAttribute("aria-busy", "true");
  refreshPromise = (async () => {
    try {
      const { loadedKeys, failed } = await fetchRangeKeys(keys, forceFresh);
      if (!loadedKeys.length && !currentModel) {
        throw failed[0]?.error || new Error("No Google Sheets ranges could be loaded");
      }
      activeDetails.filter((key) => loadedKeys.includes(key)).forEach((key) => freshlyLoadedDetails.add(key));
      currentModel = buildModel(rawData);
      render(currentModel);
      writeDashboardCache();
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (failed.length) {
        console.warn("Some sheet ranges could not be refreshed", failed);
        setSync("ready", "Live", `Updated ${time} · ${failed.length} range${failed.length === 1 ? "" : "s"} delayed`);
        $("refreshNote").textContent = `${loadedKeys.length} ranges updated`;
      } else {
        setSync("ready", "Live", `Updated ${time}`);
        $("refreshNote").textContent = `${loadedKeys.length} ranges updated`;
      }
    } catch (error) {
      console.error(error);
      setSync("error", "Offline", currentModel ? "Showing saved data" : "Sheet refresh failed");
      $("refreshNote").textContent = currentModel ? "Saved view" : "Refresh failed";
      document.querySelectorAll("tbody").forEach((body) => {
        if (!body.children.length) body.innerHTML = `<tr><td colspan="8">Could not load Google Sheets data.</td></tr>`;
      });
    } finally {
      refreshButton.disabled = false;
      refreshButton.removeAttribute("aria-busy");
      refreshPromise = null;
      window.queueMicrotask(() => ensureViewData(currentView));
    }
  })();
  return refreshPromise;
}

async function ensureViewData(view) {
  const missing = (DETAIL_KEYS[view] || []).filter((key) => !freshlyLoadedDetails.has(key));
  if (!missing.length || refreshPromise) return;
  setSync("loading", "Loading", `${VIEW_COPY[view]?.[1] || "Book"} details`);
  try {
    const { loadedKeys, failed } = await fetchRangeKeys(missing);
    if (!loadedKeys.length) throw failed[0]?.error || new Error("Detail data could not be loaded");
    loadedKeys.forEach((key) => freshlyLoadedDetails.add(key));
    currentModel = buildModel(rawData);
    render(currentModel);
    writeDashboardCache();
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setSync("ready", "Live", failed.length ? `Updated ${time} · some details delayed` : `Updated ${time}`);
  } catch (error) {
    console.error(error);
    setSync("error", "Offline", "Detail refresh failed");
  }
}

function setSync(status, title, detail) {
  $("syncDot").className = `sync-dot ${status === "ready" ? "ready" : status === "error" ? "error" : ""}`;
  $("syncState").textContent = title;
  $("lastUpdated").textContent = detail;
}

function buildModel(data) {
  const freddy = parseFreddy(data);
  const jason = parseLedgerBook({
    cash: data.jasonCash,
    summary: data.jasonSummary,
    info: data.jasonInfo,
    positions: data.jasonPositions,
    transactions: data.jasonTransactions,
  }, "PI Jason", false);
  const shem = parseLedgerBook({
    cash: data.shemCash,
    summary: data.shemSummary,
    info: data.shemInfo,
    positions: data.shemPositions,
    transactions: data.shemTransactions,
  }, "PI Shem", false);
  const robby = parseLedgerBook({
    cash: data.robbyCash,
    summary: data.robbySummary,
    info: data.robbyInfo,
    positions: data.robbyPositions,
    transactions: data.robbyTransactions,
  }, "PI Robby", true);
  return {
    freddy,
    jason,
    shem,
    robby,
    combinedGrowth: parseCombinedGrowth(data.combinedGrowth || []),
  };
}

function parseCombinedGrowth(rows) {
  return rows
    .map((row) => ({ date: parseDate(value(row, 0)), value: asNumber(value(row, 1)) }))
    .filter((row) => row.date)
    .sort((a, b) => a.date - b.date);
}

function parseFreddy(data) {
  const summaryRow = data.freddySummary?.[0] || [];
  const positions = parseFreddyPositions(data.freddyPositions || []);
  const summary = {
    marketValue: asNumber(value(summaryRow, 0)),
    costBasis: asNumber(value(summaryRow, 2)),
    unrealized: asNumber(value(summaryRow, 4)),
    realized: asNumber(value(summaryRow, 6)),
    totalPnl: asNumber(value(summaryRow, 8)),
    openCount: positions.length,
  };
  const dashboard = parseFreddyDashboard(data.freddyDashboard || []);
  return {
    name: "PI Freddy",
    status: "ACTIVE",
    summary,
    positions,
    blocks: parseFreddyBlocks(data.freddyBlockMeta || [], data.freddyBlockTrades || []),
    dashboard,
    history: parseFreddyHistory(data.freddyHistory || []),
    realizedTrades: parseFreddyRealized(data.freddyRealized || []),
  };
}

function parseFreddyPositions(rows) {
  return rows
    .map((row) => {
      const ticker = value(row, 0);
      const lots = asNumber(value(row, 1));
      if (!ticker || lots <= 0) return null;
      const avgCost = asNumber(value(row, 2));
      const current = asNumber(value(row, 3));
      const marketValue = asNumber(value(row, 4));
      const unrealized = asNumber(value(row, 5));
      return {
        ticker: String(ticker).trim().toUpperCase(),
        lots,
        avgCost,
        current,
        marketValue,
        costBasis: lots * 100 * avgCost,
        unrealized,
        returnPct: asNumber(value(row, 6)),
        weight: asNumber(value(row, 7)),
        risk: value(row, 8) || "OK",
      };
    })
    .filter(Boolean);
}

function parseFreddyDashboard(rows) {
  const output = {};
  rows.forEach((row) => {
    if (value(row, 0)) output[String(value(row, 0)).trim()] = value(row, 2);
    if (value(row, 3)) output[String(value(row, 3)).trim()] = value(row, 4);
  });
  return output;
}

function parseFreddyHistory(rows) {
  return rows
    .map((row) => ({
      date: parseDate(value(row, 0)),
      dailyPnl: asNumber(value(row, 1)),
      cumulativePnl: asNumber(value(row, 2)),
      portfolioReturn: asNumber(value(row, 4)),
      ihsgChange: asNumber(value(row, 5)),
    }))
    .filter((row) => row.date)
    .sort((a, b) => a.date - b.date);
}

function parseFreddyRealized(rows) {
  return rows
    .map((row) => {
      const ticker = value(row, 0);
      if (!ticker) return null;
      return {
        ticker,
        buy: asNumber(value(row, 1)),
        sell: asNumber(value(row, 2)),
        pnl: asNumber(value(row, 3)),
        date: parseDate(value(row, 4)),
        returnPct: asNumber(value(row, 5)),
        lots: asNumber(value(row, 6)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
}

function parseFreddyBlocks(metaRows, tradeRows) {
  const tickerRow = metaRows[0] || [];
  const summaryRow = metaRows[1] || [];
  return [0, 6, 12]
    .map((start) => {
      const ticker = value(tickerRow, start);
      if (!ticker) return null;
      const trades = tradeRows
        .map((row) => {
          const date = parseDate(value(row, start));
          const side = value(row, start + 1);
          if (!date || !side) return null;
          return {
            date,
            side,
            lots: asNumber(value(row, start + 2)),
            price: asNumber(value(row, start + 3)),
            runningLots: asNumber(value(row, start + 4)),
          };
        })
        .filter(Boolean);
      return {
        ticker,
        lots: asNumber(value(summaryRow, start + 1)),
        avgCost: asNumber(value(summaryRow, start + 3)),
        trades,
      };
    })
    .filter(Boolean);
}

function parseLedgerBook(data, name, closed) {
  const cash = Object.fromEntries((data.cash || []).map((row) => [String(value(row, 0) || "").trim(), value(row, 1)]));
  const summaryRows = data.summary || [];
  const startCapital = asNumber(value(summaryRows[1], 0)) || asNumber(cash["Start Cash"]);
  const cashAfterFees = asNumber(value(summaryRows[1], 4)) || asNumber(cash["Cash After Fees"]);
  const fees = asNumber(cash["Fee Burden"]);
  const totalPnl = asNumber(value(summaryRows[1], 2)) || asNumber(cash["P/L After Fees"]);
  const realized = asNumber(value(summaryRows[4], 2)) || (closed ? totalPnl : 0);
  const unrealized = asNumber(value(summaryRows[5], 2)) || asNumber(cash["Open P/L After Fees"]);
  const positions = parseLedgerPositions(data.positions || []);
  const transactions = parseLedgerTransactions(data.transactions || []);
  const marketValue = positions.reduce((sum, item) => sum + item.marketValue, 0);
  const costBasis = positions.reduce((sum, item) => sum + item.costValue, 0);
  const actualTransactions = transactions.filter((trade) => {
    const action = trade.action.toUpperCase();
    const allocation = trade.notes.toLowerCase().includes("not an additional broker execution");
    return !allocation && ["BUY", "SELL", "ALLOTMENT/BUY"].includes(action);
  });
  return {
    name,
    status: closed ? "CLOSED" : "ACTIVE",
    startCapital,
    cashAfterFees,
    fees,
    totalPnl,
    realized,
    unrealized,
    returnPct: totalPnl / Math.max(startCapital, 1),
    marketValue,
    costBasis,
    positions,
    transactions,
    actualTransactions,
    closedDate: closed ? String(value(data.info?.[0], 1) || "Closed") : "",
    sheetWinner: closed ? value(summaryRows[3], 2) : "",
    sheetLoser: closed ? value(summaryRows[4], 2) : "",
    sheetMostTraded: closed ? value(summaryRows[5], 2) : "",
    narrative: value(data.info?.[0], 2) || value(summaryRows[6], 0) || "",
  };
}

function parseLedgerPositions(rows) {
  const output = [];
  rows.forEach((row) => {
    const ticker = value(row, 0);
    const lots = asNumber(value(row, 1));
    if (!ticker || lots <= 0) return;
    const costValue = asNumber(value(row, 2));
    const current = asNumber(value(row, 3));
    const openPnl = asNumber(value(row, 4));
    output.push({
      ticker: String(ticker).trim().toUpperCase(),
      lots,
      costValue,
      avgCost: costValue / Math.max(lots * 100, 1),
      current,
      marketValue: lots * 100 * current,
      unrealized: openPnl,
      returnPct: asNumber(value(row, 5)),
      risk: "OPEN",
    });
  });
  const total = output.reduce((sum, item) => sum + item.marketValue, 0);
  output.forEach((item) => { item.weight = item.marketValue / Math.max(total, 1); });
  return output;
}

function parseLedgerTransactions(rows) {
  return rows
    .map((row) => {
      const ticker = value(row, 1);
      if (!ticker) return null;
      return {
        date: parseDate(value(row, 0)),
        ticker: String(ticker).trim().toUpperCase(),
        company: value(row, 2),
        method: String(value(row, 3) || ""),
        action: String(value(row, 4) || ""),
        status: String(value(row, 5) || ""),
        price: asNumber(value(row, 6)),
        lots: asNumber(value(row, 8) || value(row, 7)),
        current: asNumber(value(row, 9)),
        avgCost: asNumber(value(row, 10)),
        tradeValue: asNumber(value(row, 12)),
        cashFlow: asNumber(value(row, 13)),
        realized: asNumber(value(row, 14)),
        unrealized: asNumber(value(row, 15)),
        notes: String(value(row, 16) || ""),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
}

function render(model) {
  renderMarketTape();
  renderOverview(model);
  renderFreddy(model.freddy);
  renderJason(model.jason);
  renderShem(model.shem);
  renderRobby(model.robby);
  renderVisibleCharts();
}

function renderMarketTape() {
  const markup = TRENDING_STOCKS.map((item) => {
    const direction = item.changePct > 0 ? "up" : item.changePct < 0 ? "down" : "neutral";
    const arrow = item.changePct > 0 ? "&#8599;" : item.changePct < 0 ? "&#8600;" : "&#8226;";
    return `<span class="tape-item ${direction}"><strong>${item.symbol}</strong><b>${item.last}</b><em>${arrow} ${pct(item.changePct)}</em></span>`;
  }).join("");
  $("marketTapeTrack").innerHTML = `<div class="market-tape-group">${markup}</div><div class="market-tape-group" aria-hidden="true">${markup}</div>`;
}

function renderOverview(model) {
  const { freddy, jason, shem, combinedGrowth } = model;
  const freddyPositions = recalcPositionsWithScenario("freddy", freddy.positions);
  const freddySummary = recalcFreddySummary(freddy, freddyPositions);
  const latestDaily = freddy.history.at(-1)?.dailyPnl || 0;
  const activePnl = freddySummary.totalPnl + jason.totalPnl + shem.totalPnl;
  const combinedRealized = freddySummary.realized + jason.realized + shem.realized;
  const combinedUnrealized = freddySummary.unrealized + jason.unrealized + shem.unrealized;
  const activeExposure = freddySummary.marketValue + jason.marketValue + shem.marketValue;
  const activeOpenCount = freddyPositions.length + jason.positions.length + shem.positions.length;
  const mtdGrowth = combinedGrowth.at(-1)?.value || 0;
  setMoney("overviewTotalPnl", activePnl, true);
  setMoney("overviewRealized", combinedRealized, true);
  setMoney("overviewUnrealized", combinedUnrealized, true);
  $("overviewMarketValue").textContent = idr(activeExposure, true);
  setMoney("overviewActivePnl", activePnl, true);
  setMoney("overviewDailyPnl", mtdGrowth, true);
  $("overviewCash").textContent = idr(jason.cashAfterFees + shem.cashAfterFees, true);
  $("overviewExposure").textContent = idr(activeExposure, true);
  $("overviewOpenPositions").textContent = numberFmt.format(activeOpenCount);

  const snapshot = [
    { view: "freddy", label: "Primary fund", name: "PI Freddy", status: "Active", pnl: freddySummary.totalPnl, daily: latestDaily, detail: `${freddyPositions.length} open positions`, value: freddySummary.marketValue },
    { view: "jason", label: "Satellite fund", name: "PI Jason", status: "Active", pnl: jason.totalPnl, daily: latestRealizedDaily(jason), detail: `${jason.positions.length} open positions`, value: jason.cashAfterFees + jason.marketValue },
    { view: "shem", label: "Growth fund", name: "PI Shem", status: "Active", pnl: shem.totalPnl, daily: latestRealizedDaily(shem), detail: `${shem.positions.length} open positions`, value: shem.cashAfterFees + shem.marketValue },
  ];
  $("fundSnapshotGrid").innerHTML = snapshot.map((fund) => `
    <button class="fund-snapshot" type="button" data-open-view="${fund.view}">
      <span class="snapshot-label">${fund.label}<i class="status-dot ${fund.status.toLowerCase()}"></i></span>
      <strong>${fund.name}</strong>
      <b class="${signedClass(fund.pnl)}">${idr(fund.pnl, true)}</b>
      <span class="snapshot-change ${signedClass(fund.daily)}">${fund.status === "Closed" ? "Final result" : fund.daily === null ? "Today -" : `Today ${idr(fund.daily, true)}`}</span>
      <span>${idr(fund.value, true)} total value</span>
      <small>${fund.detail}</small>
    </button>
  `).join("");
  const allocations = [
    { ticker: "PI Freddy", marketValue: freddySummary.marketValue },
    { ticker: "PI Jason", marketValue: jason.marketValue },
    { ticker: "PI Shem", marketValue: shem.marketValue },
  ];
  const allocationTotal = allocations.reduce((sum, item) => sum + item.marketValue, 0);
  allocations.forEach((item) => { item.weight = allocationTotal ? item.marketValue / allocationTotal : 0; });
  renderDonut("overviewFundDonut", "overviewFundLegend", allocations);
  renderFundContributions([
    { name: "PI Freddy", pnl: freddySummary.totalPnl, color: COLORS[0] },
    { name: "PI Jason", pnl: jason.totalPnl, color: COLORS[1] },
    { name: "PI Shem", pnl: shem.totalPnl, color: COLORS[2] },
  ]);
}

function renderFundContributions(funds) {
  const maxMagnitude = Math.max(...funds.map((fund) => Math.abs(fund.pnl)), 1);
  $("overviewContributionList").innerHTML = funds.map((fund) => `
    <article class="contribution-row">
      <div><span><i style="background:${fund.color}"></i>${fund.name}</span><strong class="${signedClass(fund.pnl)}">${idr(fund.pnl, true)}</strong></div>
      <div class="contribution-track"><span class="${signedClass(fund.pnl)}" style="width:${Math.max(5, Math.abs(fund.pnl) / maxMagnitude * 100)}%;background:${fund.color}"></span></div>
    </article>
  `).join("");
}

function latestRealizedDaily(fund) {
  const dated = fund.actualTransactions.filter((trade) => trade.date);
  if (!dated.length) return null;
  const latestDate = dated.at(-1).date;
  return dated
    .filter((trade) => trade.date?.toDateString() === latestDate.toDateString())
    .reduce((sum, trade) => sum + trade.realized, 0);
}

function renderFreddy(fund) {
  const positions = recalcPositionsWithScenario("freddy", fund.positions);
  const summary = recalcFreddySummary(fund, positions);
  setMoney("freddyTotalPnl", summary.totalPnl, true);
  setMoney("freddyRealized", summary.realized, true);
  setMoney("freddyUnrealized", summary.unrealized, true);
  $("freddyOpenCount").textContent = numberFmt.format(positions.length);
  $("freddyMarketValue").textContent = idr(summary.marketValue, true);
  $("freddyCostBasis").textContent = idr(summary.costBasis, true);
  $("freddyFees").textContent = idr(fund.dashboard["EST. TOTAL FEES"], true);
  $("freddyWinRate").textContent = pct(fund.dashboard["WIN RATE"]);
  $("freddyProfitFactor").textContent = `Profit factor ${priceFmt.format(asNumber(fund.dashboard["PROFIT FACTOR"]))}`;
  $("freddyPositionStatus").textContent = `${positions.length} open`;
  $("freddyPositionCards").innerHTML = positionCards(positions);
  $("freddyPositionsTable").innerHTML = positionTableRows(positions, true, { editableCurrent: true, book: "freddy" });
  renderDonut("freddyDonut", "freddyLegend", positions);
  $("freddyTradesTable").innerHTML = fund.realizedTrades.slice(0, 10).map((trade) => `
    <tr><td><strong>${escapeHtml(trade.ticker)}</strong></td><td>${trade.date ? dateFmt.format(trade.date) : "-"}</td><td>${numberFmt.format(trade.lots)}</td><td>${priceFmt.format(trade.buy)}</td><td>${priceFmt.format(trade.sell)}</td><td class="${signedClass(trade.pnl)}">${idr(trade.pnl, true)}</td><td class="${signedClass(trade.returnPct)}">${pct(trade.returnPct)}</td></tr>
  `).join("") || `<tr><td colspan="7">No realized transactions found.</td></tr>`;
  renderFreddyBlocks(fund.blocks);
}

function renderJason(fund) {
  setMoney("jasonTotalPnl", fund.totalPnl, true);
  setMoney("jasonRealized", fund.realized, true);
  setMoney("jasonUnrealized", fund.unrealized, true);
  $("jasonReturn").textContent = pct(fund.returnPct);
  $("jasonStartCapital").textContent = idr(fund.startCapital, true);
  $("jasonCash").textContent = idr(fund.cashAfterFees, true);
  $("jasonMarketValue").textContent = idr(fund.marketValue, true);
  $("jasonFees").textContent = idr(fund.fees, true);
  $("jasonPositionStatus").textContent = `${fund.positions.length} open`;
  $("jasonPositionCards").innerHTML = positionCards(fund.positions);
  $("jasonPositionsTable").innerHTML = positionTableRows(fund.positions, false);
  renderDonut("jasonDonut", "jasonLegend", fund.positions);
  const recent = [...fund.actualTransactions].reverse().slice(0, 12);
  $("jasonTradeCount").textContent = `${fund.actualTransactions.length} trades`;
  $("jasonTradesTable").innerHTML = recent.map((trade) => `
    <tr><td>${trade.date ? dateFmt.format(trade.date) : "-"}</td><td><strong>${trade.ticker}</strong></td><td><span class="side-chip ${trade.action.toLowerCase().includes("sell") ? "sell" : "buy"}">${escapeHtml(trade.action)}</span></td><td>${priceFmt.format(trade.price)}</td><td>${numberFmt.format(trade.lots)}</td><td class="${signedClass(trade.cashFlow)}">${idr(trade.cashFlow, true)}</td><td class="${signedClass(trade.realized)}">${idr(trade.realized, true)}</td></tr>
  `).join("") || `<tr><td colspan="7">No transactions found.</td></tr>`;
}

function renderShem(fund) {
  setMoney("shemTotalPnl", fund.totalPnl, true);
  setMoney("shemRealized", fund.realized, true);
  setMoney("shemUnrealized", fund.unrealized, true);
  $("shemReturn").textContent = pct(fund.returnPct);
  $("shemStartCapital").textContent = idr(fund.startCapital, true);
  $("shemCash").textContent = idr(fund.cashAfterFees, true);
  $("shemMarketValue").textContent = idr(fund.marketValue, true);
  $("shemFees").textContent = idr(fund.fees, true);
  $("shemPositionStatus").textContent = `${fund.positions.length} open`;
  $("shemPositionCards").innerHTML = positionCards(fund.positions);
  $("shemPositionsTable").innerHTML = positionTableRows(fund.positions, false);
  renderDonut("shemDonut", "shemLegend", fund.positions);
  const recent = [...fund.actualTransactions].reverse().slice(0, 12);
  $("shemTradeCount").textContent = `${fund.actualTransactions.length} trades`;
  $("shemTradesTable").innerHTML = recent.map((trade) => `
    <tr><td>${trade.date ? dateFmt.format(trade.date) : "-"}</td><td><strong>${trade.ticker}</strong></td><td><span class="side-chip ${trade.action.toLowerCase().includes("sell") ? "sell" : "buy"}">${escapeHtml(trade.action)}</span></td><td>${priceFmt.format(trade.price)}</td><td>${numberFmt.format(trade.lots)}</td><td class="${signedClass(trade.cashFlow)}">${idr(trade.cashFlow, true)}</td><td class="${signedClass(trade.realized)}">${idr(trade.realized, true)}</td></tr>
  `).join("") || `<tr><td colspan="7">No transactions found.</td></tr>`;
}

function renderRobby(fund) {
  setMoney("robbyTotalPnl", fund.totalPnl, true);
  $("robbyStartCapitalHero").textContent = idr(fund.startCapital, true);
  $("robbyEndCashHero").textContent = idr(fund.cashAfterFees, true);
  $("robbyReturn").textContent = pct(fund.returnPct);
  $("robbyStartCapital").textContent = idr(fund.startCapital, true);
  $("robbyEndingCash").textContent = idr(fund.cashAfterFees, true);
  $("robbyFees").textContent = idr(fund.fees, true);
  $("robbyTradeCount").textContent = numberFmt.format(fund.actualTransactions.length);
  $("robbyClosedDate").textContent = fund.closedDate || "Closed";

  const sellTrades = fund.transactions.filter((trade) => trade.action.toUpperCase() === "SELL");
  const attribution = aggregateTickerPerformance(sellTrades);
  const best = [...sellTrades].sort((a, b) => b.realized - a.realized)[0];
  const worst = [...sellTrades].sort((a, b) => a.realized - b.realized)[0];
  const most = [...attribution].sort((a, b) => b.lots - a.lots)[0];
  const winner = [...attribution].sort((a, b) => b.pnl - a.pnl)[0];
  const loser = [...attribution].sort((a, b) => a.pnl - b.pnl)[0];

  const insights = [
    { label: "Biggest Winner", ticker: winner?.ticker || "-", value: winner?.pnl || 0, tone: "positive" },
    { label: "Biggest Loser", ticker: loser?.ticker || "-", value: loser?.pnl || 0, tone: "negative" },
    { label: "Most Traded", ticker: most?.ticker || "-", value: most ? `${numberFmt.format(most.lots)} lots sold` : "-", tone: "neutral" },
    { label: "Best Exit", ticker: best?.ticker || "-", value: best ? idr(best.realized, true) : "-", tone: "positive" },
    { label: "Worst Exit", ticker: worst?.ticker || "-", value: worst ? idr(worst.realized, true) : "-", tone: "negative" },
  ];
  $("robbyInsightGrid").innerHTML = insights.map((item) => `
    <article class="insight-item"><span>${item.label}</span><strong>${item.ticker}</strong><b class="${item.tone}">${typeof item.value === "number" ? idr(item.value, true) : item.value}</b></article>
  `).join("");

  $("robbyTickerTable").innerHTML = [...attribution].sort((a, b) => b.pnl - a.pnl).slice(0, 12).map((item) => `
    <tr><td><strong>${item.ticker}</strong></td><td class="${signedClass(item.pnl)}">${idr(item.pnl, true)}</td><td>${numberFmt.format(item.fills)}</td><td>${numberFmt.format(item.lots)}</td></tr>
  `).join("") || `<tr><td colspan="4">No closed trades found.</td></tr>`;

  const timelineTrades = [...sellTrades].reverse().slice(0, 8);
  $("robbyTimeline").innerHTML = timelineTrades.map((trade) => `
    <div class="timeline-item"><span class="timeline-dot"></span><div><strong>${trade.ticker} sold</strong><small>${trade.date ? dateFmt.format(trade.date) : "-"} &middot; ${numberFmt.format(trade.lots)} lots @ ${priceFmt.format(trade.price)}</small></div><b class="${signedClass(trade.realized)}">${idr(trade.realized, true)}</b></div>
  `).join("") || `<p class="empty-note">No closing activity found.</p>`;
}

function aggregateTickerPerformance(trades) {
  const map = new Map();
  trades.forEach((trade) => {
    const current = map.get(trade.ticker) || { ticker: trade.ticker, pnl: 0, fills: 0, lots: 0 };
    current.pnl += trade.realized;
    current.fills += 1;
    current.lots += trade.lots;
    map.set(trade.ticker, current);
  });
  return [...map.values()];
}

function positionCards(positions, compact = false) {
  if (!positions.length) return `<p class="empty-note">No open positions.</p>`;
  const shown = compact ? positions.slice(0, 3) : positions;
  return shown.map((position) => {
    const meta = companyFor(position.ticker);
    return `<article class="position-card"><header><div class="ticker-cell">${logoMarkup(position.ticker)}<span><strong>${position.ticker}</strong><small>${escapeHtml(meta.name)}</small></span></div><span class="risk-pill ${riskClass(position.risk)}">${escapeHtml(position.risk || "OPEN")}</span></header><div class="position-card-grid"><div><span>Lots</span><strong>${numberFmt.format(position.lots)}</strong></div><div><span>Avg</span><strong>${priceFmt.format(position.avgCost)}</strong></div><div><span>Market Value</span><strong>${idr(position.marketValue, true)}</strong></div><div><span>Open P/L</span><strong class="${signedClass(position.unrealized)}">${idr(position.unrealized, true)}</strong></div></div></article>`;
  }).join("");
}

function positionTableRows(positions, showRisk, options = {}) {
  if (!positions.length) return `<tr><td colspan="8">No open positions.</td></tr>`;
  return positions.map((position) => {
    const currentCell = options.editableCurrent
      ? `<input class="scenario-price-input" type="number" min="0" step="1" inputmode="decimal" value="${numberInputValue(position.current)}" data-scenario-price data-book="${escapeHtml(options.book || "")}" data-ticker="${escapeHtml(position.ticker)}" aria-label="${escapeHtml(position.ticker)} scenario price" />`
      : priceFmt.format(position.current);
    return `
      <tr><td><div class="ticker-cell">${logoMarkup(position.ticker)}<span><strong>${position.ticker}</strong><small>${escapeHtml(companyFor(position.ticker).name)}</small></span></div></td><td>${numberFmt.format(position.lots)}</td><td>${priceFmt.format(position.avgCost)}</td><td>${currentCell}</td><td>${idr(position.marketValue, true)}</td><td class="${signedClass(position.unrealized)}">${idr(position.unrealized, true)}</td><td class="${signedClass(position.returnPct)}">${pct(position.returnPct)}</td><td>${showRisk ? `<span class="risk-pill ${riskClass(position.risk)}">${escapeHtml(position.risk)}</span>` : pct(position.weight)}</td></tr>
    `;
  }).join("");
}

function riskClass(label) {
  const text = String(label || "").toLowerCase();
  if (text.includes("high")) return "high";
  if (text.includes("drawdown")) return "drawdown";
  if (text.includes("watch")) return "watch";
  return "ok";
}

function renderDonut(donutId, legendId, positions) {
  let cursor = 0;
  const slices = positions.map((position, index) => {
    const weight = Math.max(position.weight || 0, 0);
    const start = cursor * 360;
    cursor += weight;
    return `${COLORS[index % COLORS.length]} ${start}deg ${cursor * 360}deg`;
  });
  $(donutId).style.background = `conic-gradient(${slices.join(", ") || "#263545 0deg 360deg"})`;
  $(legendId).innerHTML = positions.map((position, index) => `<div class="legend-row"><span><i class="swatch" style="background:${COLORS[index % COLORS.length]}"></i>${position.ticker}</span><strong>${pct(position.weight)}</strong></div>`).join("") || `<p class="empty-note">No allocation to display.</p>`;
}

function renderFreddyBlocks(blocks) {
  $("freddyPositionBlocks").innerHTML = blocks.map((block) => `
    <article class="position-block"><header><div class="ticker-cell">${logoMarkup(block.ticker)}<span><strong>${block.ticker}</strong><small>${escapeHtml(companyFor(block.ticker).name)}</small></span></div><span>${numberFmt.format(block.lots)} lots &middot; ${priceFmt.format(block.avgCost)}</span></header><div class="table-wrap"><table><thead><tr><th>Date</th><th>Side</th><th>Lots</th><th>Price</th><th>Running</th></tr></thead><tbody>${block.trades.map((trade) => `<tr><td>${dateFmt.format(trade.date)}</td><td><span class="side-chip ${String(trade.side).toLowerCase().includes("sell") ? "sell" : "buy"}">${escapeHtml(trade.side)}</span></td><td>${numberFmt.format(trade.lots)}</td><td>${priceFmt.format(trade.price)}</td><td>${numberFmt.format(trade.runningLots)}</td></tr>`).join("")}</tbody></table></div></article>
  `).join("");
}

function setMoney(id, amount, compact) {
  $(id).textContent = idr(amount, compact);
  $(id).classList.remove("positive", "negative");
  const tone = signedClass(amount);
  if (tone) $(id).classList.add(tone);
}

function renderVisibleCharts() {
  if (!currentModel) return;
  const history = currentModel.freddy.history;
  const rangeLengths = { "1D": 2, "1W": 5, "1M": 22 };
  const rows = chartRange === "ALL" ? history : history.slice(-(rangeLengths[chartRange] || 22));
  const rangeLabel = rows.length ? `${dateFmt.format(rows[0].date)} to ${dateFmt.format(rows.at(-1).date)}` : "No data";
  document.querySelectorAll("[data-chart-range]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chartRange === chartRange);
    button.setAttribute("aria-pressed", String(button.dataset.chartRange === chartRange));
  });
  if (currentView === "overview") {
    const combinedRows = currentModel.combinedGrowth;
    const combinedRange = combinedRows.length ? `${dateFmt.format(combinedRows[0].date)} to ${dateFmt.format(combinedRows.at(-1).date)}` : "Month to date";
    $("overviewPerformanceRange").textContent = combinedRange;
    drawCombinedGrowthChart($("overviewReturnChart"), combinedRows);
  }
  if (currentView === "freddy") {
    $("freddyPerformanceRange").textContent = rangeLabel;
    drawReturnChart($("freddyReturnChart"), rows);
  }
}

function drawCombinedGrowthChart(canvas, rows) {
  const { ctx, width, height } = setupCanvas(canvas);
  const pad = { top: 38, right: 24, bottom: 34, left: 62 };
  ctx.clearRect(0, 0, width, height);
  drawChartFrame(ctx, width, height, pad);
  if (!rows.length) {
    ctx.fillStyle = "#8fa1b4";
    ctx.font = "14px system-ui";
    ctx.fillText("Combined growth history is loading", pad.left, height / 2);
    return;
  }
  const values = rows.map((row) => row.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const point = (row, index) => ({
    x: pad.left + (index / Math.max(rows.length - 1, 1)) * (width - pad.left - pad.right),
    y: height - pad.bottom - ((row.value - min) / span) * (height - pad.top - pad.bottom),
  });
  const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
  gradient.addColorStop(0, "rgba(0, 208, 132, 0.28)");
  gradient.addColorStop(1, "rgba(0, 208, 132, 0.01)");
  ctx.beginPath();
  rows.forEach((row, index) => {
    const { x, y } = point(row, index);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  const lastPoint = point(rows.at(-1), rows.length - 1);
  const firstPoint = point(rows[0], 0);
  ctx.lineTo(lastPoint.x, height - pad.bottom);
  ctx.lineTo(firstPoint.x, height - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  rows.forEach((row, index) => {
    const { x, y } = point(row, index);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = rows.at(-1).value >= 0 ? "#00d084" : "#ff4d4d";
  ctx.lineWidth = 3;
  ctx.stroke();
  rows.forEach((row, index) => {
    const { x, y } = point(row, index);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = row.value >= 0 ? "#00d084" : "#ff4d4d";
    ctx.fill();
  });
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "800 15px system-ui";
  ctx.fillText(`MTD ${idr(rows.at(-1).value, true)}`, pad.left, 20);
  ctx.fillStyle = "#8fa1b4";
  ctx.font = "12px system-ui";
  ctx.fillText(idr(max, true), 8, pad.top + 4);
  ctx.fillText(idr(min, true), 8, height - pad.bottom);
  ctx.fillText(dateFmt.format(rows[0].date), pad.left, height - 9);
  const endLabel = dateFmt.format(rows.at(-1).date);
  ctx.fillText(endLabel, Math.max(pad.left, width - pad.right - ctx.measureText(endLabel).width), height - 9);
}

function drawReturnChart(canvas, rows) {
  const { ctx, width, height } = setupCanvas(canvas);
  const pad = { top: 30, right: 20, bottom: 32, left: 54 };
  ctx.clearRect(0, 0, width, height);
  drawChartFrame(ctx, width, height, pad);
  if (!rows.length) {
    ctx.fillStyle = "#8fa1b4";
    ctx.font = "14px system-ui";
    ctx.fillText("No performance history available", pad.left, height / 2);
    return;
  }
  const series = [
    { key: "portfolioReturn", label: "Portfolio", color: "#00d084" },
    { key: "ihsgChange", label: "IHSG", color: "#ffb000" },
  ];
  const all = rows.flatMap((row) => series.map((item) => row[item.key]));
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 0);
  const span = max - min || 1;
  series.forEach((item) => {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    rows.forEach((row, index) => {
      const x = pad.left + (index / Math.max(rows.length - 1, 1)) * (width - pad.left - pad.right);
      const y = height - pad.bottom - ((row[item.key] - min) / span) * (height - pad.top - pad.bottom);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "700 13px system-ui";
  ctx.fillText("Portfolio return vs IHSG", pad.left, 17);
  series.forEach((item, index) => {
    const x = width - 160;
    const y = 15 + index * 18;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - 8, 10, 10);
    ctx.fillStyle = "#8fa1b4";
    ctx.font = "12px system-ui";
    ctx.fillText(item.label, x + 16, y);
  });
  ctx.fillStyle = "#8fa1b4";
  ctx.font = "12px system-ui";
  ctx.fillText(pct(max), 8, pad.top + 4);
  ctx.fillText(pct(min), 8, height - pad.bottom);
}

function setupCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width || 640));
  const height = Number(canvas.dataset.chartHeight || 230);
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  canvas.style.width = "100%";
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { ctx, width, height };
}

function drawChartFrame(ctx, width, height, pad) {
  ctx.strokeStyle = "#263545";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = pad.top + (index / 4) * (height - pad.top - pad.bottom);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
}

function showView(name, updateHash = true) {
  if (!VIEW_COPY[name]) name = "overview";
  currentView = name;
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    const active = panel.dataset.viewPanel === name;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === name));
  document.querySelector(".topbar")?.classList.toggle("overview-mode", name === "overview");
  $("viewEyebrow").textContent = VIEW_COPY[name][0];
  $("viewTitle").textContent = VIEW_COPY[name][1];
  if (updateHash) history.replaceState(null, "", `#${name}`);
  $("mobileMenuButton").setAttribute("aria-expanded", "false");
  document.querySelector(".sidebar")?.classList.remove("menu-open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.requestAnimationFrame(renderVisibleCharts);
  ensureViewData(name);
}

function setCollapsed(button, open) {
  const body = $(button.dataset.collapseTarget);
  if (!body) return;
  button.setAttribute("aria-expanded", String(open));
  body.hidden = !open;
  const panel = button.closest(".collapsible");
  panel?.classList.toggle("is-open", open);
  panel?.classList.toggle("is-collapsed", !open);
}

function setupInteractions() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const rangeButton = target.closest("[data-chart-range]");
    if (rangeButton) {
      chartRange = rangeButton.dataset.chartRange || "1M";
      renderVisibleCharts();
      return;
    }
    const nav = target.closest("[data-view], [data-open-view]");
    if (nav) {
      event.preventDefault();
      showView(nav.dataset.view || nav.dataset.openView);
      return;
    }
    const toggle = target.closest("[data-collapse-target]");
    if (toggle) {
      event.preventDefault();
      setCollapsed(toggle, toggle.getAttribute("aria-expanded") !== "true");
    }
  });
  document.addEventListener("input", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const input = target?.closest("[data-scenario-price]");
    if (!(input instanceof HTMLInputElement)) return;
    const { book, ticker } = input.dataset;
    if (!book || !ticker || !scenarioPrices[book]) return;
    if (!input.value.trim()) {
      scenarioPrices[book].delete(ticker);
      rerenderScenario(book, ticker);
      return;
    }
    const price = asNumber(input.value);
    if (price > 0) scenarioPrices[book].set(ticker, price);
    else scenarioPrices[book].delete(ticker);
    rerenderScenario(book, ticker);
  });
  $("refreshButton").addEventListener("click", () => loadDashboard({ forceFresh: true }));
  $("tapeToggle").addEventListener("click", () => {
    const paused = !document.querySelector(".market-tape")?.classList.contains("is-paused");
    document.querySelector(".market-tape")?.classList.toggle("is-paused", paused);
    $("tapeToggle").textContent = paused ? "Play" : "Pause";
    $("tapeToggle").setAttribute("aria-pressed", String(paused));
    $("tapeToggle").setAttribute("aria-label", paused ? "Resume market tape" : "Pause market tape");
  });
  $("mobileMenuButton").addEventListener("click", () => {
    const open = $("mobileMenuButton").getAttribute("aria-expanded") !== "true";
    $("mobileMenuButton").setAttribute("aria-expanded", String(open));
    document.querySelector(".sidebar")?.classList.toggle("menu-open", open);
  });
  window.addEventListener("hashchange", () => showView(location.hash.slice(1) || "overview", false));
  window.addEventListener("resize", () => {
    window.clearTimeout(window.__fundResize);
    window.__fundResize = window.setTimeout(renderVisibleCharts, 180);
  });
}

setupInteractions();
const cachedDashboard = readDashboardCache();
if (cachedDashboard) {
  rawData = cachedDashboard.data;
  currentModel = buildModel(rawData);
  render(currentModel);
  const cachedTime = new Date(cachedDashboard.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  setSync("ready", "Saved", `Instant view from ${cachedTime}`);
  $("refreshNote").textContent = "Refreshing in background";
}
showView(location.hash.slice(1) || "overview", false);
loadDashboard();
window.setInterval(loadDashboard, REFRESH_MS);
