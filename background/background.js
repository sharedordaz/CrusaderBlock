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
  let gamblingBlocklistDomains = new Set();
  let gamblingBlocklistLoaded = false;
  let readyPromise = null;

  /** Calls a Chrome callback API or Firefox Promise API consistently. */
  function storageGet(keys) {
    return storage.get(keys).then((result) => result || {});
  }

  function storageSet(values) {
    return storage.set(values);
  }

  function storageRemove(keys) {
    return storage.remove(keys);
  }

  function removeTab(tabId) {
    try {
      const result = browserApi.tabs.remove(tabId);
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch {
      // A tab may already be closed or unavailable.
    }
  }

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

  /** Reads extension settings through either Chromium callbacks or Firefox Promises. */
  async function getStoredData(keys) {
    try {
      return await storageGet(keys);
    } catch (error) {
      console.error("Could not read Crusader Block storage:", error);
      return {};
    }
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

  /** Parses plain-host and hosts-file blocklist formats into valid domains. */
  function parseBlocklist(text) {
    return new Set(text.split(/\r?\n/)
      .map((line) => line.trim().replace(/\s+#.*$/, ""))
      .filter((line) => line && !line.startsWith("#"))
      .flatMap((line) => {
        const parts = line.trim().split(/\s+/);
        const candidate = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        if (!candidate || candidate === "0.0.0.0" || candidate === "127.0.0.1") return [];
        return [normalizeHost(candidate
          .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
          .split("/")[0]
          .split(":")[0])];
      })
      .filter((domain) => domain && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(domain)));
  }

  /** Loads the packaged adult blocklist once. */
  async function loadAdultBlocklist() {
    if (adultBlocklistLoaded) return adultBlocklistDomains;

    try {
      const blocklistUrl = browserApi.runtime.getURL("assets/adult-blocklist.txt");
      const response = await fetch(blocklistUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Blocklist request failed: ${response.status} ${response.statusText}`);

      adultBlocklistDomains = parseBlocklist(await response.text());
      if (!adultBlocklistDomains.size) throw new Error("Adult blocklist contained no valid domains");

      adultBlocklistLoaded = true;
      console.info(`Crusader Block: loaded ${adultBlocklistDomains.size} adult domains`);
    } catch (error) {
      console.error("Could not load adult blocklist:", error);
    }

    return adultBlocklistDomains;
  }

  /** Loads the packaged gambling blocklist once. */
  async function loadGamblingBlocklist() {
    if (gamblingBlocklistLoaded) return gamblingBlocklistDomains;

    try {
      const blocklistUrl = browserApi.runtime.getURL("assets/gambling-blocklist.txt");
      const response = await fetch(blocklistUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Blocklist request failed: ${response.status} ${response.statusText}`);

      gamblingBlocklistDomains = parseBlocklist(await response.text());
      if (!gamblingBlocklistDomains.size) throw new Error("Gambling blocklist contained no valid domains");

      gamblingBlocklistLoaded = true;
      console.info(`Crusader Block: loaded ${gamblingBlocklistDomains.size} gambling domains`);
    } catch (error) {
      console.error("Could not load gambling blocklist:", error);
    }

    return gamblingBlocklistDomains;
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

    const domainSettings = { adult: true, ...(saved.domainSettings || {}) };
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
      storageSet({ domainSettings, keywordSettings, customDomains, cooldowns }).then(() => {
        if (clearPendingDomains) storageRemove("pendingCustomDomains").catch(() => {});
      }).catch((error) => console.error("Could not save Crusader Block settings:", error));
    }

    const domains = new Set();
    for (const key of Object.keys(DOMAIN_GROUPS)) {
      if (key !== "custom" && key !== "gambling" && domainSettings[key]) {
        for (const domain of DOMAIN_GROUPS[key] || []) {
          domains.add(normalizeHost(domain));
        }
      }
    }

    if (domainSettings.adult) {
      const adultDomains = await loadAdultBlocklist();
      for (const domain of adultDomains) domains.add(domain);
    }

    if (domainSettings.gambling) {
      const gamblingDomains = await loadGamblingBlocklist();
      for (const domain of gamblingDomains) domains.add(domain);
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
        removeTab(tabId);
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
      removeTab(sender.tab.id);
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