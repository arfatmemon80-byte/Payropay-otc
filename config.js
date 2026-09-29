/**
 * config.js
 * ---------------------------------------------------------------------------
 * BUNDLED DEFAULTS / FALLBACK. This file ships with the static site and is
 * always available, even if the live admin panel or its backend is offline
 * or not yet set up.
 *
 * On Cloudflare Pages with the admin panel configured (see README), the
 * live site fetches saved overrides from /api/config at runtime and layers
 * them on top of these defaults — so business details can be edited from
 * /admin.html without ever touching this file or redeploying.
 *
 * On GitHub Pages (or any host without the admin backend), /api/config
 * simply isn't reachable, script.js quietly falls back to exactly what's
 * written here, and everything still works.
 *
 * SECURITY NOTE
 * This file is shipped to the browser, so NEVER put a secret/private API
 * key in here (or anywhere in this repo). Every API wired up below is a
 * key-less public endpoint. The admin panel's own password/session secret
 * live only as encrypted Cloudflare Pages environment variables — never in
 * this file.
 * ---------------------------------------------------------------------------
 */

window.CONFIG_DEFAULTS = {

  /* ---------------------------------------------------------------------
   * BUSINESS IDENTITY
   * ------------------------------------------------------------------- */
  BUSINESS_NAME: "PayroPay",
  CONTACT_EMAIL: "desk@example.com", // TODO: replace with real business email

  /* ---------------------------------------------------------------------
   * TELEGRAM
   * Use the desk's public Telegram username (without the @).
   * Example: mydeskusername  →  opens https://t.me/mydeskusername
   * Note: unlike WhatsApp, Telegram's link format cannot pre-fill a
   * message into the chat box — script.js copies the message to the
   * clipboard instead and opens the chat, so the user just pastes it.
   * ------------------------------------------------------------------- */
  TELEGRAM_USERNAME: "yourtelegramusername", // TODO: replace with real desk Telegram username

  /* ---------------------------------------------------------------------
   * FORM SUBMISSION (₹0-cost)
   * Point this at a free-tier form endpoint. Two common free options:
   *
   * OPTION A — Google Forms (100% free, no signup beyond a Google account)
   *   1. Create a Google Form with fields matching this site's contact form.
   *   2. Get each field's "entry.XXXXXXXXX" id (view form source, or use the
   *      pre-fill link feature in the form's "..." menu).
   *   3. Set FORM_ENDPOINT to the form's formResponse URL, e.g.:
   *      "https://docs.google.com/forms/d/e/FORM_ID/formResponse"
   *   4. Map each entry id below in FORM_FIELD_MAP.
   *
   * OPTION B — Any free form backend (Formspree free tier, etc.)
   *   Set FORM_ENDPOINT to the endpoint they give you and adjust
   *   script.js's submit handler field names to match their expected body.
   *
   * Leave FORM_ENDPOINT as "" to keep the form in "no backend configured"
   * mode — it will show a polite message directing the user to Telegram
   * instead of failing silently.
   * ------------------------------------------------------------------- */
  FORM_ENDPOINT: "", // e.g. "https://docs.google.com/forms/d/e/XXXXXXXX/formResponse"

  // Only used when FORM_ENDPOINT is a Google Forms formResponse URL.
  // Replace each value with the entry.XXXXXXXXX id from your real form.
  FORM_FIELD_MAP: {
    fullName: "entry.111111111",
    email: "entry.222222222",
    phone: "entry.333333333",
    asset: "entry.444444444",
    amount: "entry.555555555",
    network: "entry.666666666",
    contactMethod: "entry.777777777",
    message: "entry.888888888"
  },

  /* ---------------------------------------------------------------------
   * MARKET DATA PROVIDER
   * Default: CoinGecko public "simple price" endpoint — free, no API key,
   * CORS-enabled, generous free rate limit. Swap PROVIDER + build a new
   * fetcher in script.js (see fetchPricesFromProvider) if you want to
   * change providers later; nothing else in the codebase needs to change
   * as long as the fetcher returns { [assetId]: priceInInr }.
   * ------------------------------------------------------------------- */
  API: {
    PROVIDER: "coingecko",
    BASE_URL: "https://api.coingecko.com/api/v3/simple/price",
    VS_CURRENCY: "inr",
    REFRESH_INTERVAL_MS: 60000, // re-fetch prices every 60s
    REQUEST_TIMEOUT_MS: 8000
  },

  /* ---------------------------------------------------------------------
   * SITE CONTENT (optional overrides via admin panel)
   * These are the values the live admin panel can override without a
   * redeploy. Left here as the fallback text baked into index.html.
   * ------------------------------------------------------------------- */
  SITE_CONTENT: {
    heroHeadline: "Sell Your Crypto. Get INR Through A Professional Process.",
    heroSubheadline: "8+ years of experience in crypto markets, with a transparent and compliance-focused process for customers looking to sell digital assets."
  },

  /* ---------------------------------------------------------------------
   * SUPPORTED ASSETS
   * "id" must be the provider's price-lookup id (CoinGecko coin id).
   * "networks" lists ONLY the networks this desk actually supports for
   * that asset. Leave the array empty ([]) for single-network assets —
   * the UI will simply hide the network dropdown for those.
   * ------------------------------------------------------------------- */
  SUPPORTED_ASSETS: [
    {
      symbol: "BTC",
      name: "Bitcoin",
      id: "bitcoin",
      icon: "₿",
      networks: []
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      id: "ethereum",
      icon: "Ξ",
      networks: ["ERC20"]
    },
    {
      symbol: "USDT",
      name: "Tether",
      id: "tether",
      icon: "₮",
      networks: ["TRC20", "ERC20", "BEP20"]
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      id: "usd-coin",
      icon: "◈",
      networks: ["ERC20", "TRC20"]
    },
    {
      symbol: "TRX",
      name: "TRON",
      id: "tron",
      icon: "⬙",
      networks: []
    },
    {
      symbol: "SOL",
      name: "Solana",
      id: "solana",
      icon: "◎",
      networks: []
    },
    {
      symbol: "BNB",
      name: "BNB",
      id: "binancecoin",
      icon: "◆",
      networks: ["BEP20"]
    }
  ]
};
