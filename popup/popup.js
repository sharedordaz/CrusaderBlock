(() => {
  const browserApi = globalThis.browser || globalThis.chrome;
  const storage = browserApi.storage.local;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const ids = ["social", "youtube", "gambling", "custom", "keywordCensor", "closeTabs"];
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

  /** Loads saved protection settings and updates every popup control and cooldown label. */
  function load() {
    storage.get(["domainSettings", "cooldowns", "customDomains", "keywordSettings"], (saved) => {
      const domainSettings = saved.domainSettings || {};
      const cooldowns = saved.cooldowns || {};
      const keywordSettings = saved.keywordSettings || {};

      for (const id of ["social", "youtube", "gambling", "custom"]) {
        const lockedUntil = cooldowns[id] || 0;
        elements[id].checked = !!domainSettings[id] || lockedUntil > Date.now();
        elements[id].disabled = lockedUntil > Date.now();
      }

      elements.keywordCensor.checked = keywordSettings.censor !== false;
      elements.closeTabs.checked = keywordSettings.closeTab !== false;
      document.getElementById("customDomains").value = (saved.customDomains || []).join("\n");
      updateCountdown(cooldowns);
    });
  }

  /** Normalizes and saves the custom domain list entered in the popup. */
  function saveCustomDomains() {
    const custom = document.getElementById("customDomains").value
      .split(/\n|,/)
      .map((value) => value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);

    storage.set({ customDomains: custom }, () => {
      browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
    });
  }

  /** Enables or disables a domain group and starts or removes its 24-hour cooldown. */
  function setDomain(id, enabled) {
    storage.get(["domainSettings", "cooldowns"], (saved) => {
      const domainSettings = { ...(saved.domainSettings || {}) };
      const cooldowns = { ...(saved.cooldowns || {}) };

      if (enabled) {
        domainSettings[id] = true;
        delete cooldowns[id];
      } else {
        domainSettings[id] = false;
        cooldowns[id] = Date.now() + DAY_MS;
      }

      storage.set({ domainSettings, cooldowns }, () => {
        browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
        load();
      });
    });
  }

  /** Finds the earliest cooldown and renders its remaining hours and minutes. */
  function updateCountdown(cooldowns) {
    const active = Object.entries(cooldowns)
      .filter(([, until]) => until > Date.now())
      .sort((a, b) => a[1] - b[1]);

    const text = document.getElementById("unlockText");
    if (!active.length) {
      text.textContent = "";
      return;
    }

    const remaining = active[0][1] - Date.now();
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    text.textContent = `${hours}h ${minutes}m`;
  }

  for (const id of ["social", "youtube", "gambling", "custom"]) {
    elements[id].addEventListener("change", () => setDomain(id, elements[id].checked));
  }

  elements.keywordCensor.addEventListener("change", () => {
    storage.get(["keywordSettings"], (saved) => {
      const keywordSettings = { ...(saved.keywordSettings || {}) };
      keywordSettings.censor = elements.keywordCensor.checked;
      storage.set({ keywordSettings });
    });
  });

  elements.closeTabs.addEventListener("change", () => {
    storage.get(["keywordSettings"], (saved) => {
      const keywordSettings = { ...(saved.keywordSettings || {}) };
      keywordSettings.closeTab = elements.closeTabs.checked;
      storage.set({ keywordSettings });
    });
  });

  document.getElementById("customDomains").addEventListener("change", saveCustomDomains);

  load();
  setInterval(load, 60000);
})();
