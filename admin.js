/**
 * admin.js
 * ---------------------------------------------------------------------------
 * Talks to the Cloudflare Pages Functions under /api/admin/*. If those
 * endpoints aren't available (e.g. this file was opened on GitHub Pages, or
 * on Cloudflare before KV/env vars are configured), every call below fails
 * gracefully and the login screen shows a clear message instead of hanging.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  const DEFAULTS = window.CONFIG_DEFAULTS;

  const loginScreen = document.getElementById("loginScreen");
  const editorScreen = document.getElementById("editorScreen");
  const loginForm = document.getElementById("loginForm");
  const loginStatus = document.getElementById("loginStatus");
  const saveStatus = document.getElementById("saveStatus");
  const configForm = document.getElementById("configForm");
  const assetRows = document.getElementById("assetRows");
  const rowTemplate = document.getElementById("assetRowTemplate");

  function setStatus(el, message, type) {
    el.textContent = message;
    el.className = "form-status " + (type || "");
  }

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON response (e.g. host has no Functions at all) */
    }
    return { ok: res.ok, status: res.status, data };
  }

  /* ---------------------------------------------------------------------
   * ASSET ROWS
   * ------------------------------------------------------------------- */
  function addAssetRow(asset) {
    const node = rowTemplate.content.firstElementChild.cloneNode(true);
    const a = asset || { symbol: "", name: "", id: "", icon: "●", networks: [] };
    node.querySelector('[data-field="symbol"]').value = a.symbol || "";
    node.querySelector('[data-field="name"]').value = a.name || "";
    node.querySelector('[data-field="id"]').value = a.id || "";
    node.querySelector('[data-field="icon"]').value = a.icon || "";
    node.querySelector('[data-field="networks"]').value = (a.networks || []).join(", ");
    node.querySelector(".btn-remove-row").addEventListener("click", () => node.remove());
    assetRows.appendChild(node);
  }

  document.getElementById("addAssetBtn").addEventListener("click", () => addAssetRow(null));

  function collectAssets() {
    return Array.from(assetRows.querySelectorAll(".asset-row"))
      .map((row) => {
        const get = (f) => row.querySelector(`[data-field="${f}"]`).value.trim();
        const symbol = get("symbol").toUpperCase();
        const networks = get("networks")
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean);
        return { symbol, name: get("name"), id: get("id"), icon: get("icon") || "●", networks };
      })
      .filter((a) => a.symbol && a.name && a.id);
  }

  /* ---------------------------------------------------------------------
   * POPULATE FORM FROM SAVED CONFIG (falls back to bundled defaults)
   * ------------------------------------------------------------------- */
  function populateForm(saved) {
    const s = saved || {};
    document.getElementById("fBusinessName").value = s.businessName || DEFAULTS.BUSINESS_NAME;
    document.getElementById("fContactEmail").value = s.contactEmail || DEFAULTS.CONTACT_EMAIL;
    document.getElementById("fTelegram").value = s.telegramUsername || DEFAULTS.TELEGRAM_USERNAME;
    document.getElementById("fHeadline").value = s.heroHeadline || DEFAULTS.SITE_CONTENT.heroHeadline;
    document.getElementById("fSubheadline").value = s.heroSubheadline || DEFAULTS.SITE_CONTENT.heroSubheadline;
    document.getElementById("fFormEndpoint").value = s.formEndpoint || DEFAULTS.FORM_ENDPOINT || "";

    const map = { ...DEFAULTS.FORM_FIELD_MAP, ...(s.formFieldMap || {}) };
    document.getElementById("fMapFullName").value = map.fullName || "";
    document.getElementById("fMapEmail").value = map.email || "";
    document.getElementById("fMapPhone").value = map.phone || "";
    document.getElementById("fMapAsset").value = map.asset || "";
    document.getElementById("fMapAmount").value = map.amount || "";
    document.getElementById("fMapNetwork").value = map.network || "";
    document.getElementById("fMapContactMethod").value = map.contactMethod || "";
    document.getElementById("fMapMessage").value = map.message || "";

    assetRows.innerHTML = "";
    const assets = Array.isArray(s.supportedAssets) && s.supportedAssets.length ? s.supportedAssets : DEFAULTS.SUPPORTED_ASSETS;
    assets.forEach(addAssetRow);
  }

  /* ---------------------------------------------------------------------
   * LOGIN / SESSION
   * ------------------------------------------------------------------- */
  async function checkSession() {
    const { ok } = await api("/api/admin/session");
    return ok;
  }

  async function showEditor() {
    loginScreen.hidden = true;
    editorScreen.hidden = false;
    const { ok, data, status } = await api("/api/admin/config");
    if (ok) {
      populateForm(data);
    } else if (status === 401) {
      // session expired between check and load
      editorScreen.hidden = true;
      loginScreen.hidden = false;
    } else {
      populateForm(null);
      setStatus(saveStatus, "Couldn't load saved settings — showing defaults instead.", "error");
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    setStatus(loginStatus, "Signing in…", "info");

    const { ok, data, status } = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });

    btn.disabled = false;

    if (ok) {
      setStatus(loginStatus, "", "");
      await showEditor();
      return;
    }

    if (status === 0 || data === null) {
      setStatus(
        loginStatus,
        "Admin backend not reachable. This feature needs Cloudflare Pages with Functions + KV configured — see README.md.",
        "error"
      );
    } else {
      setStatus(loginStatus, (data && data.error) || "Sign-in failed.", "error");
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST" });
    editorScreen.hidden = true;
    loginScreen.hidden = false;
    document.getElementById("loginPassword").value = "";
  });

  /* ---------------------------------------------------------------------
   * SAVE
   * ------------------------------------------------------------------- */
  configForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;
    setStatus(saveStatus, "Saving…", "info");

    const payload = {
      businessName: document.getElementById("fBusinessName").value.trim(),
      contactEmail: document.getElementById("fContactEmail").value.trim(),
      telegramUsername: document.getElementById("fTelegram").value.trim().replace(/^@/, ""),
      heroHeadline: document.getElementById("fHeadline").value.trim(),
      heroSubheadline: document.getElementById("fSubheadline").value.trim(),
      formEndpoint: document.getElementById("fFormEndpoint").value.trim(),
      formFieldMap: {
        fullName: document.getElementById("fMapFullName").value.trim(),
        email: document.getElementById("fMapEmail").value.trim(),
        phone: document.getElementById("fMapPhone").value.trim(),
        asset: document.getElementById("fMapAsset").value.trim(),
        amount: document.getElementById("fMapAmount").value.trim(),
        network: document.getElementById("fMapNetwork").value.trim(),
        contactMethod: document.getElementById("fMapContactMethod").value.trim(),
        message: document.getElementById("fMapMessage").value.trim()
      },
      supportedAssets: collectAssets()
    };

    const { ok, data } = await api("/api/admin/config", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    saveBtn.disabled = false;

    if (ok) {
      setStatus(saveStatus, "Saved — the live site will reflect this within a few seconds.", "success");
    } else {
      setStatus(saveStatus, (data && data.error) || "Save failed. Please try again.", "error");
    }
  });

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */
  (async function init() {
    const loggedIn = await checkSession();
    if (loggedIn) {
      await showEditor();
    } else {
      loginScreen.hidden = false;
    }
  })();
})();
