/**
 * script.js
 * ---------------------------------------------------------------------------
 * Vanilla JS only. No frameworks, no build step.
 * Reads all business/API config from window.CONFIG (see config.js).
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  // CONFIG / ASSETS start as the bundled defaults, and are replaced (once,
  // during init) by whatever the admin panel has saved — see loadConfig().
  let CONFIG = window.CONFIG_DEFAULTS;
  let ASSETS = CONFIG.SUPPORTED_ASSETS;

  /** In-memory price cache: { [assetSymbol]: { inr: number } } */
  let priceCache = {};
  let lastFetchedAt = null;
  let fetchFailed = false;

  /* ---------------------------------------------------------------------
   * RUNTIME CONFIG (live admin panel overrides, Cloudflare Pages only)
   * On any host without the /api/config backend (e.g. GitHub Pages, or a
   * fresh Cloudflare deploy before KV is set up), this quietly fails and
   * the bundled defaults from config.js are used as-is.
   * ------------------------------------------------------------------- */
  function mergeConfig(defaults, overrides) {
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return defaults;
    const merged = { ...defaults };
    if (overrides.businessName) merged.BUSINESS_NAME = overrides.businessName;
    if (overrides.contactEmail) merged.CONTACT_EMAIL = overrides.contactEmail;
    if (overrides.telegramUsername) merged.TELEGRAM_USERNAME = overrides.telegramUsername;
    if (typeof overrides.formEndpoint === "string") merged.FORM_ENDPOINT = overrides.formEndpoint;
    if (overrides.formFieldMap && typeof overrides.formFieldMap === "object") {
      merged.FORM_FIELD_MAP = { ...defaults.FORM_FIELD_MAP, ...overrides.formFieldMap };
    }
    if (Array.isArray(overrides.supportedAssets) && overrides.supportedAssets.length) {
      merged.SUPPORTED_ASSETS = overrides.supportedAssets.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        id: a.id,
        icon: a.icon || "●",
        networks: Array.isArray(a.networks) ? a.networks : []
      }));
    }
    merged.SITE_CONTENT = {
      heroHeadline: overrides.heroHeadline || defaults.SITE_CONTENT.heroHeadline,
      heroSubheadline: overrides.heroSubheadline || defaults.SITE_CONTENT.heroSubheadline
    };
    return merged;
  }

  async function loadRuntimeConfig() {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      return null; // no backend on this host, or offline — use defaults
    }
  }

  function applySiteContentOverrides() {
    const content = CONFIG.SITE_CONTENT || {};
    const headlineEl = document.getElementById("heroHeadline");
    const subEl = document.getElementById("heroSubheadline");
    if (headlineEl && content.heroHeadline) headlineEl.textContent = content.heroHeadline;
    if (subEl && content.heroSubheadline) subEl.textContent = content.heroSubheadline;
  }

  /* ---------------------------------------------------------------------
   * BRANDING — reflect config into the DOM so there is one source of truth
   * ------------------------------------------------------------------- */
  function applyBranding() {
    document.querySelectorAll("#brandName, #brandNameFooter, #brandNameCopy")
      .forEach((el) => {
        // Don't wipe out a logo <img> that's already inside this element —
        // only set text on elements that are plain text (e.g. the
        // copyright line, or the brand name before a logo is added).
        if (!el.querySelector("img")) el.textContent = CONFIG.BUSINESS_NAME;
      });

    // Keep the <img alt> text in sync with the business name too
    document.querySelectorAll(".brand-logo").forEach((img) => {
      img.alt = CONFIG.BUSINESS_NAME;
    });

    const emailEl = document.getElementById("footerEmail");
    if (emailEl) {
      emailEl.textContent = CONFIG.CONTACT_EMAIL;
      emailEl.href = "mailto:" + CONFIG.CONTACT_EMAIL;
    }
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  /* ---------------------------------------------------------------------
   * MARKET DATA
   * This is the ONLY function that knows about the provider's URL shape.
   * To switch providers later, change CONFIG.API and rewrite the body of
   * this function to return the same shape: { [symbol]: inrPrice|null }.
   * ------------------------------------------------------------------- */
  async function fetchPricesFromProvider() {
    const ids = ASSETS.map((a) => a.id).join(",");
    const url = `${CONFIG.API.BASE_URL}?ids=${encodeURIComponent(ids)}&vs_currencies=${CONFIG.API.VS_CURRENCY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.API.REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("Market data request failed: " + res.status);
      const data = await res.json();

      const result = {};
      ASSETS.forEach((asset) => {
        const entry = data[asset.id];
        result[asset.symbol] = entry && typeof entry[CONFIG.API.VS_CURRENCY] === "number"
          ? entry[CONFIG.API.VS_CURRENCY]
          : null;
      });
      return result;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async function refreshPrices() {
    try {
      const prices = await fetchPricesFromProvider();
      priceCache = prices;
      lastFetchedAt = Date.now();
      fetchFailed = false;
    } catch (err) {
      fetchFailed = true;
    }
    renderCalculatorStatus();
    renderAssetGrid();
    updateCalculatorOutput();
  }

  function getPrice(symbol) {
    const v = priceCache[symbol];
    return typeof v === "number" ? v : null;
  }

  /* ---------------------------------------------------------------------
   * CALCULATOR
   * ------------------------------------------------------------------- */
  const assetSelect = document.getElementById("assetSelect");
  const networkField = document.getElementById("networkField");
  const networkSelect = document.getElementById("networkSelect");
  const amountInput = document.getElementById("amountInput");
  const rateOut = document.getElementById("rateOut");
  const totalOut = document.getElementById("totalOut");
  const lastUpdatedEl = document.getElementById("lastUpdated");
  const calcDot = document.getElementById("calcDot");
  const calcStatusText = document.getElementById("calcStatusText");

  function populateAssetSelects() {
    [assetSelect, document.getElementById("formAsset")].forEach((select) => {
      if (!select) return;
      select.innerHTML = "";
      ASSETS.forEach((asset) => {
        const opt = document.createElement("option");
        opt.value = asset.symbol;
        opt.textContent = `${asset.symbol} — ${asset.name}`;
        select.appendChild(opt);
      });
    });
  }

  function populateNetworksFor(symbol, selectEl, fieldEl) {
    const asset = ASSETS.find((a) => a.symbol === symbol);
    if (!asset || !asset.networks.length) {
      fieldEl.hidden = true;
      selectEl.innerHTML = "";
      return;
    }
    fieldEl.hidden = false;
    selectEl.innerHTML = "";
    asset.networks.forEach((net) => {
      const opt = document.createElement("option");
      opt.value = net;
      opt.textContent = net;
      selectEl.appendChild(opt);
    });
  }

  function formatInr(value) {
    if (value === null || value === undefined || isNaN(value)) return "₹ —";
    return "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  function updateCalculatorOutput() {
    const symbol = assetSelect.value;
    const price = getPrice(symbol);
    const amount = parseFloat(amountInput.value);

    if (price === null) {
      rateOut.textContent = fetchFailed ? "Unavailable" : "—";
      totalOut.textContent = "₹ 0";
      return;
    }

    rateOut.textContent = formatInr(price);
    if (!isNaN(amount) && amount > 0) {
      totalOut.textContent = formatInr(amount * price);
    } else {
      totalOut.textContent = "₹ 0";
    }
  }

  function renderCalculatorStatus() {
    if (fetchFailed && lastFetchedAt === null) {
      calcDot.className = "dot error";
      calcStatusText.textContent = "Market price temporarily unavailable";
      lastUpdatedEl.textContent = "Last updated: —";
      return;
    }
    if (fetchFailed) {
      calcDot.className = "dot error";
      calcStatusText.textContent = "Market price temporarily unavailable";
    } else {
      calcDot.className = "dot live";
      calcStatusText.textContent = "Live indicative market rate";
    }
  }

  function tickLastUpdated() {
    if (!lastFetchedAt) return;
    const seconds = Math.max(0, Math.round((Date.now() - lastFetchedAt) / 1000));
    lastUpdatedEl.textContent = `Last updated: ${seconds}s ago`;
  }

  assetSelect.addEventListener("change", () => {
    populateNetworksFor(assetSelect.value, networkSelect, networkField);
    updateCalculatorOutput();
  });
  amountInput.addEventListener("input", updateCalculatorOutput);

  /* ---------------------------------------------------------------------
   * SUPPORTED ASSETS GRID
   * ------------------------------------------------------------------- */
  const assetGrid = document.getElementById("assetGrid");

  function renderAssetGrid() {
    assetGrid.innerHTML = "";
    ASSETS.forEach((asset) => {
      const price = getPrice(asset.symbol);
      const card = document.createElement("div");
      card.className = "asset-card";
      card.innerHTML = `
        <span class="asset-icon" aria-hidden="true">${asset.icon}</span>
        <span class="asset-symbol">${asset.symbol}</span>
        <span class="asset-name">${asset.name}</span>
        <span class="${price === null ? "asset-price unavailable" : "asset-price"}">
          ${price === null ? "Price temporarily unavailable" : formatInr(price)}
        </span>
        <button class="btn btn-ghost btn-sm" data-sell="${asset.symbol}">Sell ${asset.symbol}</button>
      `;
      assetGrid.appendChild(card);
    });

    assetGrid.querySelectorAll("[data-sell]").forEach((btn) => {
      btn.addEventListener("click", () => prefillAndScrollToForm(btn.getAttribute("data-sell"), null, null));
    });
  }

  /* ---------------------------------------------------------------------
   * SELL THIS AMOUNT -> prefill contact form
   * ------------------------------------------------------------------- */
  const formAsset = document.getElementById("formAsset");
  const formAmount = document.getElementById("formAmount");
  const formNetwork = document.getElementById("formNetwork");
  const formNetworkField = document.getElementById("formNetworkField");

  function prefillAndScrollToForm(symbol, amount, network) {
    formAsset.value = symbol;
    populateNetworksFor(symbol, formNetwork, formNetworkField);
    if (network) formNetwork.value = network;
    if (amount) formAmount.value = amount;
    document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
    document.getElementById("fullName").focus({ preventScroll: true });
  }

  formAsset.addEventListener("change", () => populateNetworksFor(formAsset.value, formNetwork, formNetworkField));

  document.getElementById("sellThisAmountBtn").addEventListener("click", () => {
    prefillAndScrollToForm(
      assetSelect.value,
      amountInput.value || null,
      networkField.hidden ? null : networkSelect.value
    );
  });

  /* ---------------------------------------------------------------------
   * CONTACT FORM SUBMISSION
   * ------------------------------------------------------------------- */
  const quoteForm = document.getElementById("quoteForm");
  const formStatus = document.getElementById("formStatus");

  function setFormStatus(message, type) {
    formStatus.textContent = message;
    formStatus.className = "form-status " + (type || "");
  }

  quoteForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!CONFIG.FORM_ENDPOINT) {
      setFormStatus("Thank you. Please contact our desk directly on Telegram.", "info");
      return;
    }

    const submitBtn = document.getElementById("submitQuoteBtn");
    submitBtn.disabled = true;
    setFormStatus("Sending your request…", "info");

    try {
      const map = CONFIG.FORM_FIELD_MAP;
      const body = new URLSearchParams();
      body.append(map.fullName, document.getElementById("fullName").value);
      body.append(map.email, document.getElementById("email").value);
      body.append(map.phone, document.getElementById("phone").value);
      body.append(map.asset, formAsset.value);
      body.append(map.amount, formAmount.value);
      body.append(map.network, formNetworkField.hidden ? "" : formNetwork.value);
      body.append(map.contactMethod, document.getElementById("contactMethod").value);
      body.append(map.message, document.getElementById("message").value);

      // Google Forms' formResponse endpoint does not return readable CORS
      // response, so we submit in no-cors mode and treat completion as success.
      await fetch(CONFIG.FORM_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });

      setFormStatus("Thank you. Your request has been received — our desk will contact you shortly.", "success");
      quoteForm.reset();
    } catch (err) {
      setFormStatus("Something went wrong sending this form. Please reach us on Telegram instead.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ---------------------------------------------------------------------
   * TELEGRAM FLOATING BUTTON
   * Unlike WhatsApp's wa.me links, Telegram's t.me links cannot pre-fill
   * a message into the chat box. So we copy the message to the
   * clipboard (best-effort) and open the chat — the user just pastes it.
   * ------------------------------------------------------------------- */
  function buildTelegramMessage(asset, amount) {
    const assetText = asset || "crypto";
    const amountText = amount ? amount : "TBD";
    return `I would like to sell ${assetText} — Amount: ${amountText}`;
  }

  function buildTelegramLink() {
    const username = (CONFIG.TELEGRAM_USERNAME || "").replace(/^@/, "");
    return `https://t.me/${username}`;
  }

  async function openTelegramWithMessage(asset, amount) {
    const message = buildTelegramMessage(asset, amount);
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message);
        copied = true;
      }
    } catch (err) {
      /* clipboard permission denied — chat still opens, user can type manually */
    }
    if (copied) showToast("Message copied — paste it into the Telegram chat");
    window.open(buildTelegramLink(), "_blank", "noopener");
  }

  let toastTimer = null;
  function showToast(message) {
    let toast = document.getElementById("appToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appToast";
      toast.className = "app-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
  }

  function refreshTelegramLink() {
    const link = document.getElementById("telegramFloat");
    link.href = buildTelegramLink();
    link.dataset.asset = assetSelect.value;
    link.dataset.amount = amountInput.value;
  }
  assetSelect.addEventListener("change", refreshTelegramLink);
  amountInput.addEventListener("input", refreshTelegramLink);

  document.getElementById("telegramFloat").addEventListener("click", (e) => {
    e.preventDefault();
    const link = e.currentTarget;
    openTelegramWithMessage(link.dataset.asset, link.dataset.amount);
  });

  document.getElementById("talkToDeskHero").addEventListener("click", (e) => {
    e.preventDefault();
    openTelegramWithMessage(null, null);
  });

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */
  async function init() {
    const overrides = await loadRuntimeConfig();
    CONFIG = mergeConfig(window.CONFIG_DEFAULTS, overrides);
    ASSETS = CONFIG.SUPPORTED_ASSETS;

    applyBranding();
    applySiteContentOverrides();
    populateAssetSelects();
    populateNetworksFor(assetSelect.value, networkSelect, networkField);
    populateNetworksFor(formAsset.value, formNetwork, formNetworkField);
    refreshTelegramLink();

    refreshPrices();
    setInterval(refreshPrices, CONFIG.API.REFRESH_INTERVAL_MS);
    setInterval(tickLastUpdated, 1000);

    // Re-check for admin-panel edits periodically too, so a save made in
    // another tab reaches this tab without a manual refresh.
    setInterval(async () => {
      const latest = await loadRuntimeConfig();
      if (latest) {
        CONFIG = mergeConfig(window.CONFIG_DEFAULTS, latest);
        ASSETS = CONFIG.SUPPORTED_ASSETS;
        applyBranding();
        applySiteContentOverrides();
        renderAssetGrid();
        updateCalculatorOutput();
      }
    }, 5 * 60 * 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
