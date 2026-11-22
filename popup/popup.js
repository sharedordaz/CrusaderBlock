(() => {
  const browserApi = globalThis.browser || globalThis.chrome;
  const storage = browserApi.storage.local;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEBUG_COOLDOWN_MS = 10 * 1000; // 10 segundos

  // true = usa los cooldowns; false = desactiva los cooldowns por completo
  const COOLDOWN_ENABLED = true;
  // true = 10 segundos (debug); false = 24 horas (normal)
  const DEBUG_COOLDOWN = true;

  const COOLDOWN_MS = DEBUG_COOLDOWN ? DEBUG_COOLDOWN_MS : DAY_MS;

  const elements = Object.fromEntries(
    Object.keys(CONTROLS).map((id) => [id, document.getElementById(id)])
  );

  /** Loads settings and disables options that are in their cooldown. */
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

  /** Normalizes and saves custom domains, then optionally starts a cooldown. */
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

      if (COOLDOWN_ENABLED) cooldowns.custom = Date.now() + COOLDOWN_MS;
      storage.set({ customDomains, cooldowns }, () => {
        browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
        load();
      });
    });
  }

  /** Updates any setting and optionally locks only that setting for COOLDOWN_MS. */
  function setSetting(id, enabled) {
    const cfg = CONTROLS[id];

    storage.get([cfg.group, "cooldowns"], (saved) => {
      const cooldowns = { ...(saved.cooldowns || {}) };
      if (COOLDOWN_ENABLED && (cooldowns[id] || 0) > Date.now()) return;

      const groupData = { ...(saved[cfg.group] || {}) };
      groupData[cfg.key] = enabled;
      if (COOLDOWN_ENABLED) cooldowns[id] = Date.now() + COOLDOWN_MS;

      storage.set({ [cfg.group]: groupData, cooldowns }, () => {
        browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
        load();
      });
    });
  }

  /** Finds the earliest cooldown and displays its remaining time. */
  function updateCountdown(cooldowns) {
    const text = document.getElementById("unlockText");
    if (!COOLDOWN_ENABLED) {
      text.textContent = "";
      return;
    }

    const active = Object.entries(cooldowns)
      .filter(([, until]) => until > Date.now())
      .sort((a, b) => a[1] - b[1]);

    if (!active.length) {
      text.textContent = "";
      return;
    }

    const remaining = active[0][1] - Date.now();
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.ceil((remaining % 60000) / 1000);

    text.textContent = remaining < 60000 ? `${seconds}s` : `${hours}h ${minutes}m`;
  }

  for (const id of Object.keys(CONTROLS)) {
    elements[id].addEventListener("change", () => setSetting(id, elements[id].checked));
  }

  document.getElementById("customDomains").addEventListener("change", saveCustomDomains);

  load();
  setInterval(load, DEBUG_COOLDOWN ? 1000 : 60000);
})();
