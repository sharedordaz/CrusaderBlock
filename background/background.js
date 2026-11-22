(() => {
  const browserApi = globalThis.browser || globalThis.chrome;
  const storage = browserApi.storage.local;

  let activeDomains = new Set();
  let lastPopupTime = 0;

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
  function showProtectedPopup() {
    const now = Date.now();
    if (now - lastPopupTime < 2000) return;
    lastPopupTime = now;

    if (browserApi.windows?.create) {
      browserApi.windows.create({
        url: browserApi.runtime.getURL("protected/protected.html"),
        type: "popup",
        width: 380,
        height: 480
      });
    }
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

    if (domainSettings.custom) {
      for (const domain of customDomains) {
        domains.add(normalizeHost(domain));
      }
    }

    activeDomains = domains;
  }

  // Cancel navigation requests and close tabs whose hostname belongs to a blocked domain.
  if (browserApi.webRequest?.onBeforeRequest) {
    browserApi.webRequest.onBeforeRequest.addListener(
      (details) => {
        let hostname;
        try {
          hostname = new URL(details.url).hostname;
        } catch {
          return { cancel: false };
        }

        for (const domain of activeDomains) {
          if (matchesDomain(hostname, domain)) {
            if (details.tabId >= 0) browserApi.tabs.remove(details.tabId);
            showProtectedPopup();
            return { cancel: true };
          }
        }
        return { cancel: false };
      },
      { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
      ["blocking"]
    );
  }

  // Fallback for cached pages / Service Workers (like Facebook) or already-open tabs.
  if (browserApi.tabs?.onUpdated) {
    browserApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      const url = changeInfo.url || tab?.url;
      if (!url) return;

      let hostname;
      try {
        hostname = new URL(url).hostname;
      } catch {
        return;
      }

      for (const domain of activeDomains) {
        if (matchesDomain(hostname, domain)) {
          browserApi.tabs.remove(tabId);
          showProtectedPopup();
          return;
        }
      }
    });
  }

  // Handle popup setting updates and requests from content scripts to close tabs.
  browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "UPDATE_SETTINGS") {
      refreshDomains();
      sendResponse?.({ ok: true });
    }

    if (message?.type === "CLOSE_TAB" && sender.tab?.id !== undefined) {
      browserApi.tabs.remove(sender.tab.id);
      showProtectedPopup();
    }
  });

  // Rebuild blocked domains immediately when extension storage changes.
  browserApi.storage?.onChanged?.addListener((changes, area) => {
    if (area === "local") refreshDomains();
  });

  // Schedule recurring cooldown checks so protection settings expire automatically.
  if (browserApi.alarms?.create) {
    browserApi.alarms.create("cruzader-cooldown-check", { periodInMinutes: 5 });
    browserApi.alarms.onAlarm?.addListener((alarm) => {
      if (alarm.name === "cruzader-cooldown-check") refreshDomains();
    });
  }

  refreshDomains();
})();