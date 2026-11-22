(() => {
  const browserApi = globalThis.browser || globalThis.chrome;
  const storage = browserApi.storage.local;
  const DAY_MS = 24 * 60 * 60 * 1000;

  let activeDomains = new Set();

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

  /** Loads enabled domain groups, removes expired cooldowns, and rebuilds the active domain set. */
  async function refreshDomains() {
    const saved = await getStoredData(["domainSettings", "cooldowns", "customDomains"]);
    const domainSettings = saved.domainSettings || {};
    const cooldowns = saved.cooldowns || {};
    const now = Date.now();

    const changedCooldowns = { ...cooldowns };
    for (const key of ["social", "youtube", "gambling", "custom", "keywordCensor", "closeTabs"]) {
      if (cooldowns[key] && cooldowns[key] <= now) {
        delete changedCooldowns[key];
      }
    }
    if (JSON.stringify(changedCooldowns) !== JSON.stringify(cooldowns)) {
      storage.set({ cooldowns: changedCooldowns, domainSettings });
    }

    const domains = new Set();
    for (const key of ["social", "youtube", "gambling"]) {
      if (domainSettings[key]) {
        for (const domain of DOMAIN_GROUPS[key] || []) domains.add(normalizeHost(domain));
      }
    }

    if (domainSettings.custom) {
      for (const domain of saved.customDomains || []) domains.add(normalizeHost(domain));
    }

    activeDomains = domains;
  }

  // Cancel navigation requests whose hostname belongs to an enabled blocked domain.
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
          if (matchesDomain(hostname, domain)) return { cancel: true };
        }
        return { cancel: false };
      },
      { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
      ["blocking"]
    );
  }

  // Handle popup setting updates and requests from content scripts to close tabs.
  browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "UPDATE_SETTINGS") {
      refreshDomains();
      sendResponse?.({ ok: true });
    }

    if (message?.type === "CLOSE_TAB" && sender.tab?.id !== undefined) {
      browserApi.tabs.remove(sender.tab.id);
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
