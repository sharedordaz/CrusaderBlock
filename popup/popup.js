(() => {
  const browserApi = globalThis.browser || globalThis.chrome;
  const storage = browserApi.storage.local;
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Set to false for debugging: settings and custom domains change immediately.
  // Set to true for the normal 24-hour cooldown behavior.
  const COOLDOWN_ENABLED = false;

  const elements = Object.fromEntries(
    Object.keys(CONTROLS).map((id) => [id, document.getElementById(id)])
  );

  /** Loads settings and disables options that are in their 24-hour cooldown. */
  function load() {
    storage.get(["domainSettings", "cooldowns", "customDomains", "keywordSettings"], (saved) => {
      let cooldowns = { ...(saved.cooldowns || {}) };
      const now = Date.now();

      if (!COOLDOWN_ENABLED) {
        cooldowns = {};
        storage.remove("cooldowns");
      } else {
        for (const id of Object.keys(cooldowns)) {
          if (cooldowns[id] <= now) delete cooldowns[id];
        }
        storage.set({ cooldowns });
      }

      for (const [id, cfg] of Object.entries(CONTROLS)) {
        const groupData = saved[cfg.group] || {};
        const isEnabled = cfg.defaultOn
          ? groupData[cfg.key] !== false
          : !!groupData[cfg.key];

        elements[id].checked = isEnabled;
        elements[id].disabled = COOLDOWN_ENABLED && (cooldowns[id] || 0) > now;
      }

      const customDomains = document.getElementById("customDomains");
      customDomains.value = (saved.customDomains || []).join("\n");
      customDomains.disabled = COOLDOWN_ENABLED && (cooldowns.custom || 0) > now;

      updateCountdown(cooldowns);
    });
  }

  /** Normalizes and saves custom domains, then optionally starts a 24-hour cooldown. */
  function saveCustomDomains() {
    storage.get(["customDomains", "cooldowns"], (saved) => {
      const cooldowns = { ...(saved.cooldowns || {}) };
      if (COOLDOWN_ENABLED && (cooldowns.custom || 0) > Date.now()) return;

      const customDomains = document.getElementById("customDomains").value
        .split(/\n|,/)
        .map((value) => value.trim().toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0])
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index);

      if (JSON.stringify(customDomains) === JSON.stringify(saved.customDomains || [])) return;

      if (COOLDOWN_ENABLED) cooldowns.custom = Date.now() + DAY_MS;
      storage.set({ customDomains, cooldowns }, () => {
        browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
        load();
      });
    });
  }

  /** Updates any setting and optionally locks only that setting for 24 hours. */
  function setSetting(id, enabled) {
    const cfg = CONTROLS[id];

    storage.get([cfg.group, "cooldowns"], (saved) => {
      const cooldowns = { ...(saved.cooldowns || {}) };
      if (COOLDOWN_ENABLED && (cooldowns[id] || 0) > Date.now()) return;

      const groupData = { ...(saved[cfg.group] || {}) };
      groupData[cfg.key] = enabled;
      if (COOLDOWN_ENABLED) cooldowns[id] = Date.now() + DAY_MS;

      storage.set({ [cfg.group]: groupData, cooldowns }, () => {
        browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
        load();
      });
    });
  }

  /** Finds the earliest cooldown and displays its remaining hours and minutes. */
  function updateCountdown(cooldowns) {
    if (!COOLDOWN_ENABLED) {
      const text = document.getElementById("unlockText");
      text.textContent = "";
      return;
    }

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

  for (const id of Object.keys(CONTROLS)) {
    elements[id].addEventListener("change", () => setSetting(id, elements[id].checked));
  }

  document.getElementById("customDomains").addEventListener("change", saveCustomDomains);

  load();
  setInterval(load, 60000);
})();

storage.remove("cooldowns", load);
