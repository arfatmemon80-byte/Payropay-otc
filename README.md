# Crypto OTC Desk — Landing Page

A production-quality, ₹0-cost landing page for a crypto OTC / crypto-selling
desk. Pure HTML5 + CSS3 + vanilla JavaScript — no build step, no framework,
no paid service required.

## File structure

```
/
├── index.html          — public landing page
├── admin.html          — live admin panel (Cloudflare Pages only)
├── style.css           — design system + responsive layout (shared)
├── admin.css           — admin panel's additional layout styles
├── script.js           — calculator, live prices, form, Telegram logic
├── admin.js            — admin panel auth + editor logic
├── config.js           — bundled defaults / fallback values (edit for GitHub Pages use)
├── functions/           — Cloudflare Pages Functions (serverless, free tier)
│   ├── api/config.js         — public GET: current live-saved settings
│   └── api/admin/
│       ├── login.js          — POST: password check → session cookie
│       ├── logout.js         — POST: clears session cookie
│       ├── session.js        — GET: checks if session cookie is valid
│       └── config.js         — GET/POST: protected read/write of settings
├── assets/icons/        — logo, favicon
└── README.md
```

## 1. Before you deploy — edit `config.js`

`config.js` holds the **bundled defaults** — what the site shows before
any admin-panel edits, and the only source of truth if you deploy to
GitHub Pages (which has no backend for live editing). On Cloudflare
Pages, anything saved from `/admin.html` (section 5 below) overrides
these at runtime without a redeploy — so think of this file as "day one"
values, not something you'll keep editing by hand long-term.

Open `config.js` and set:

| Key | What to put |
|---|---|
| `BUSINESS_NAME` | Your desk's public name |
| `CONTACT_EMAIL` | A real support email |
| `TELEGRAM_USERNAME` | Your desk's public Telegram username, without the `@`, e.g. `yourdeskusername` |
| `FORM_ENDPOINT` | Your free form backend URL (see below). Leave `""` to disable and fall back to a Telegram message |
| `FORM_FIELD_MAP` | Only needed if using Google Forms — the `entry.XXXXXXX` id for each field |
| `SUPPORTED_ASSETS` | Add/remove coins. `id` must match the price-data provider's coin id |

Nothing else in the codebase needs to change for basic rebranding.

## 2. Market data (free, no API key)

The calculator and asset grid use **CoinGecko's public `simple/price`
endpoint**, which is free and requires no API key or signup:

```
https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=inr
```

This is called directly from the browser in `script.js` inside
`fetchPricesFromProvider()`. If prices fail to load, the UI shows
**"Market price temporarily unavailable"** — it never fabricates a price.

### Swapping providers later

If you outgrow CoinGecko's free tier, or want a provider that requires a
secret key:

1. **Never put a secret key in `config.js` or any frontend file.**
2. Deploy a tiny serverless proxy — for example a **Cloudflare Pages
   Function** (free tier) at `/functions/prices.js` that holds the key as an
   encrypted environment variable and calls the paid API server-side.
3. Point `CONFIG.API.BASE_URL` in `config.js` at your own proxy's public URL
   (e.g. `https://yoursite.pages.dev/api/prices`) instead of the provider's.
4. Update the body of `fetchPricesFromProvider()` in `script.js` to match
   your proxy's response shape — the rest of the app only expects the
   function to return `{ SYMBOL: priceInInr | null }`.

## 3. Contact form (free, no backend)

The form is wired to submit to **one configurable endpoint**:
`CONFIG.FORM_ENDPOINT`. Two free options:

### Option A — Google Forms (recommended, simplest)

1. Create a Google Form with a short-answer field for each of: Full Name,
   Email, Phone, Cryptocurrency, Amount, Network, Preferred Contact Method,
   Message.
2. Open the live form, right-click → "View Page Source", and search for
   `entry.` to find each field's id (or use the form's pre-fill link
   generator from the "⋮" menu, which shows the same ids in the URL).
3. Copy the form's "Send" action URL — it looks like
   `https://docs.google.com/forms/d/e/FORM_ID/formResponse` — into
   `CONFIG.FORM_ENDPOINT`.
4. Fill in `CONFIG.FORM_FIELD_MAP` with the real `entry.XXXXXXX` ids.
5. Responses land in the Form's linked Google Sheet automatically — free.

### Option B — Any other free-tier form backend

Services such as Formspree's free plan work too — just set
`CONFIG.FORM_ENDPOINT` to the endpoint they issue and adjust the field names
built in `script.js`'s submit handler to match what that service expects.

### No endpoint configured

If `FORM_ENDPOINT` is left as `""`, submitting the form shows:
*"Thank you. Please contact our desk directly on Telegram."* — there is no
fake backend and nothing is silently dropped.

## 4. Deploying (free hosting)

### Cloudflare Pages
1. Push this folder to a GitHub repository.
2. In the Cloudflare dashboard → Pages → **Create a project** → connect the
   repo.
3. Build command: *none*. Output directory: `/` (root).
4. Deploy — you get a free `*.pages.dev` URL, with a free custom domain
   option.

### GitHub Pages
1. Push this folder to a GitHub repository.
2. Repo **Settings → Pages** → Source: deploy from branch → `main` / root.
3. Your site is live at `https://<username>.github.io/<repo>/`.

No server, database, or paid plan is required for either option.

## 5. Live Admin Panel (`/admin.html`) — Cloudflare Pages only

The admin panel lets you log in with a password and edit business name,
contact email, Telegram username, hero headline/subheadline, the form
endpoint, and the supported-assets list — changes go live within seconds,
with **no redeploy and no touching code**.

This needs a backend, so it only works when deployed on **Cloudflare
Pages** (via the `functions/` folder, which Cloudflare auto-detects and
deploys as serverless Functions — still on the free tier). **GitHub Pages
has no serverless backend**, so on GitHub Pages `admin.html` will simply
show "Admin backend not reachable" and the public site keeps working
normally off the defaults in `config.js`.

### One-time setup on Cloudflare

1. **Create a KV namespace** (free): Cloudflare dashboard → Workers &
   Pages → **KV** → Create namespace → name it anything, e.g.
   `site_config`.
2. **Bind it to your Pages project**: your Pages project → **Settings →
   Functions → KV namespace bindings** → Add binding:
   - Variable name: `SITE_CONFIG_KV` (must match exactly — this is what
     `functions/api/*.js` looks for)
   - KV namespace: the one you just created
   - Do this for both **Production** and **Preview** environments.
3. **Set two environment variables** (same Settings page → **Environment
   variables**, add as **encrypted/secret**, not plain text):
   - `ADMIN_PASSWORD` — the password you'll log in with. Pick something
     strong; this protects live editing of your site.
   - `SESSION_SECRET` — any long random string (e.g. 32+ random
     characters). Used only to sign the login session cookie.
4. **Redeploy** — trigger a new deployment (a new commit, or "Retry
   deployment" in the dashboard) so the Functions pick up the new
   bindings/variables. Bindings set after a deployment don't apply
   retroactively to it.
5. Visit `https://<your-site>.pages.dev/admin.html`, log in with
   `ADMIN_PASSWORD`, edit, and hit **Save Changes**. The public site
   polls `/api/config` on load (and every 5 minutes while open) and
   layers your saved values on top of the `config.js` defaults.

### How it works, and what it doesn't do

- All saved settings live in one Workers KV entry (`site-config`) — free
  tier gives 1,000 writes/day and 100,000 reads/day, far more than a
  small business site needs.
- The session cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, signed
  with HMAC-SHA256, and expires after 4 hours.
- Six wrong password attempts from the same IP locks that IP out for 15
  minutes (tracked in the same KV namespace).
- This is a **single shared admin password**, not a multi-user system
  with roles — appropriate for a small desk, not for a large team. For
  stronger protection you can additionally put the `/admin.html` route
  behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
  (also has a free tier for a handful of users).
- `ADMIN_PASSWORD` and `SESSION_SECRET` are never written to the repo,
  never returned by any API response, and never reach the browser except
  as the password you type into the login form.
- If KV isn't bound yet, `/api/config` returns `{}` and the site quietly
  uses the bundled defaults — nothing breaks, it just isn't editable yet.

## 6. Fonts & icons (all free)

- Fonts: **Source Serif 4** and **Inter**, loaded from Google Fonts (free,
  open-source, no key required).
- Asset icons: simple Unicode glyphs (₿, Ξ, ₮, etc.) defined in
  `config.js` — no image downloads, no licensing concerns. Swap in your own
  SVGs under `assets/icons/` if you prefer.
- Brand logo: `assets/icons/logo.png` (header/footer) and
  `assets/icons/favicon.png` (browser tab icon) are already wired up in
  `index.html`. The header/footer logo sits inside a light rounded "chip"
  (`.brand-logo-chip` in `style.css`) because the supplied logo's text is
  dark-navy and would disappear on the site's dark background — this chip
  keeps it legible without altering the logo itself. To swap the logo,
  just replace `logo.png` / `favicon.png` with same-named files; no other
  file needs to change unless you want to remove the light chip (delete
  the `.brand-logo-chip` wrapper in `index.html` and its CSS rule if you
  later use a logo variant made for dark backgrounds).

## 7. What this site intentionally does NOT do

- No fake regulatory badges, licenses, or "approved" claims.
- No fabricated statistics, testimonials, or trading volume.
- No storage of seed phrases, private keys, passwords, or OTPs — the
  contact form only ever asks for name, email, phone, and transaction
  details.
- No hardcoded/fake prices — if the market-data call fails, the UI says so.

## 8. Local preview

No build step needed. Just open `index.html` in a browser, or serve the
folder with any static file server, e.g.:

```
npx serve .
```
