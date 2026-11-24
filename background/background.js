if (typeof importScripts === "function") {
  importScripts("../lists/domains.js", "../lists/keywords.js");
}

(() => {
  const browserApi = globalThis.browser || globalThis.chrome;
  const storage = browserApi.storage.local;

  let activeDomains = new Set();
  let lastPopupTime = 0;
  let adultBlocklistDomains = new Set();
  let adultBlocklistLoaded = false;
  let readyPromise = null;

  /** Removes protocol and subdomain prefixes so domains can be compared consistently. */
  function normalizeHost(hostname) {
    return String(hostname || "").trim().toLowerCase().replace(/^www\./, "");
  }

  /** Checks whether a hostname is exactly blocked or belongs to a blocked subdomain. */
  function matchesDomain(hostname, domain) {
    const host = normalizeHost(hostname);
    const blocked = normalizeHost(domain);
    if (!blocked) return false;
    return host === blocked || host.endsWith(`.${blocked}`);
  }

  /** Reads extension settings from browser storage and resolves the callback API as a Promise. */
  async function getStoredData(keys) {
    if (browserApi.storage?.local?.get) {
      return new Promise((resolve) => {
        browserApi.storage.local.get(keys, (result) => resolve(result || {}));
      });
    }
    return {};
  }

  /** Opens a small popup window showing the protection screen. */
  function showProtectedPopup(reason = "page", detail = "") {
    const now = Date.now();
    if (now - lastPopupTime < 2000) return;
    lastPopupTime = now;

    if (browserApi.windows?.create) {
      const params = new URLSearchParams({ reason, detail });
      browserApi.windows.create({
        url: `${browserApi.runtime.getURL("protected/protected.html")}?${params.toString()}`,
        type: "popup",
        width: 380,
        height: 480
      });
    }
  }

  /** Loads plain-hostname entries from the packaged adult blocklist once. */
  async function loadAdultBlocklist() {
    if (adultBlocklistLoaded) return adultBlocklistDomains;

    try {
      const response = await fetch(browserApi.runtime.getURL("assets/adult-blocklist.txt"));
      if (!response.ok) throw new Error(`Blocklist request failed: ${response.status}`);

      const text = await response.text();
      adultBlocklistDomains = new Set(
        text.split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#") && !line.includes(" "))
          .map((line) => normalizeHost(line.replace(/^[a-z]+:\/\//i, "").split("/")[0]))
          .filter(Boolean)
      );
      adultBlocklistLoaded = true;
    } catch (error) {
      console.error("Could not load adult blocklist:", error);
    }

    return adultBlocklistDomains;
  }

  /** Loads enabled domain groups, applies expired cooldowns, and rebuilds the active domain set. */
  async function refreshDomains() {
    const saved = await getStoredData([
      "domainSettings",
      "keywordSettings",
      "cooldowns",
      "customDomains",
      "pendingCustomDomains"
    ]);

    const domainSettings = { ...(saved.domainSettings || {}) };
    const keywordSettings = { ...(saved.keywordSettings || {}) };
    let customDomains = saved.customDomains || [];
    const cooldowns = { ...(saved.cooldowns || {}) };
    const now = Date.now();
    let needsSave = false;
    let clearPendingDomains = false;

    for (const id of Object.keys(cooldowns)) {
      if (cooldowns[id] <= now) {
        if (id === "customDomains" && Array.isArray(saved.pendingCustomDomains)) {
          customDomains = saved.pendingCustomDomains;
          clearPendingDomains = true;
        } else if (id === "keywordCensor") {
          keywordSettings.censor = false;
        } else if (id === "closeTabs") {
          keywordSettings.closeTab = false;
        } else {
          domainSettings[id] = false;
        }
        delete cooldowns[id];
        needsSave = true;
      }
    }

    if (needsSave) {
      storage.set({ domainSettings, keywordSettings, customDomains, cooldowns }, () => {
        if (clearPendingDomains) storage.remove("pendingCustomDomains");
      });
    }

    const domains = new Set();
    for (const key of Object.keys(DOMAIN_GROUPS)) {
      if (key !== "custom" && domainSettings[key]) {
        for (const domain of DOMAIN_GROUPS[key] || []) {
          domains.add(normalizeHost(domain));
        }
      }
    }

    if (domainSettings.adult) {
      const adultDomains = await loadAdultBlocklist();
      for (const domain of adultDomains) domains.add(domain);
    }

    if (domainSettings.custom) {
      for (const domain of customDomains) {
        domains.add(normalizeHost(domain));
      }
    }

    activeDomains = domains;
  }

  /** Guarantees activeDomains is populated even right after a Service Worker cold wake-up. */
  function ensureReady() {
    if (!readyPromise) {
      readyPromise = refreshDomains();
    }
    return readyPromise;
  }

  /** Evaluates a URL against activeDomains and closes the tab if blocked. */
  async function checkAndBlockTab(tabId, url) {
    if (!url || tabId < 0 || !url.startsWith("http")) return;

    await ensureReady();

    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return;
    }

    for (const domain of activeDomains) {
      if (matchesDomain(hostname, domain)) {
        browserApi.tabs.remove(tabId).catch(() => {});
        showProtectedPopup("page", hostname);
        return;
      }
    }
  }

  // Fires as soon as navigation begins (replaces blocking webRequest in Chromium MV3).
  if (browserApi.webNavigation?.onBeforeNavigate) {
    browserApi.webNavigation.onBeforeNavigate.addListener((details) => {
      if (details.frameId === 0) {
        checkAndBlockTab(details.tabId, details.url);
      }
    });
  }

  // Fallback for cached pages, Service Workers, SPA history changes, or already-open tabs.
  if (browserApi.tabs?.onUpdated) {
    browserApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      const url = changeInfo.url || tab?.url;
      if (url) checkAndBlockTab(tabId, url);
    });
  }

  // Handle popup setting updates and requests from content scripts to close tabs.
  browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "UPDATE_SETTINGS") {
      readyPromise = refreshDomains();
      sendResponse?.({ ok: true });
    }

    if (message?.type === "CLOSE_TAB" && sender.tab?.id !== undefined) {
      browserApi.tabs.remove(sender.tab.id).catch(() => {});
      showProtectedPopup("keyword", message.reason || "");
    }
  });

  // Rebuild blocked domains immediately when extension storage changes.
  browserApi.storage?.onChanged?.addListener((changes, area) => {
    if (area === "local") {
      readyPromise = refreshDomains();
    }
  });

  // Schedule recurring cooldown checks so protection settings expire automatically.
  if (browserApi.alarms?.create) {
    browserApi.alarms.create("cruzader-cooldown-check", { periodInMinutes: 5 });
    browserApi.alarms.onAlarm?.addListener((alarm) => {
      if (alarm.name === "cruzader-cooldown-check") {
        readyPromise = refreshDomains();
      }
    });
  }

  ensureReady();
})();