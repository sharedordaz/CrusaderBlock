(() => {
  const browserApi = globalThis.browser || globalThis.chrome;
  const popupStorage = browserApi.storage.local;

  function storageGet(keys) {
    return popupStorage.get(keys).then((result) => result || {});
  }

  function storageSet(values) {
    return popupStorage.set(values);
  }

  function storageRemove(keys) {
    return popupStorage.remove(keys);
  }

  function notifySettingsChanged() {
    try {
      const result = browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch {
      // Message delivery can fail while the background worker is waking up.
    }
  }

  const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const DEBUG_COOLDOWN_MS = 10 * 1000; // 10 seconds

  // true = use cooldowns; false = disable cooldowns completely
  const COOLDOWN_ENABLED = true;
  // true = 10 seconds (debug); false = 24 hours (normal)
  const DEBUG_COOLDOWN = false;

  const SHUTDOWN_COOLDOWN = false; // Production: no console cooldown bypass.

  const COOLDOWN_MS = DEBUG_COOLDOWN ? DEBUG_COOLDOWN_MS : DAY_MS;

  const elements = Object.fromEntries(
    Object.keys(CONTROLS).map((id) => [id, document.getElementById(id)])
  );

  /** Loads settings, applies any expired pending deactivations, and updates the UI. */
  function load() {
    storageGet(["domainSettings", "cooldowns", "customDomains", "pendingCustomDomains", "keywordSettings"])
      .then((saved) => {
        const domainSettings = { ...(saved.domainSettings || {}) };
        const keywordSettings = { ...(saved.keywordSettings || {}) };
        let customDomains = saved.customDomains || [];
        let cooldowns = { ...(saved.cooldowns || {}) };
        const now = Date.now();
        let needsSave = false;
        let clearPendingDomains = false;

        if (!COOLDOWN_ENABLED) {
          if (Object.keys(cooldowns).length || saved.pendingCustomDomains) {
            cooldowns = {};
            storageRemove(["cooldowns", "pendingCustomDomains"]).catch(() => {});
          }
        } else {
          for (const id of Object.keys(cooldowns)) {
            if (cooldowns[id] <= now) {
              // Cooldown finished: apply the pending deactivation now
              if (id === "customDomains" && Array.isArray(saved.pendingCustomDomains)) {
                customDomains = saved.pendingCustomDomains;
                clearPendingDomains = true;
              } else if (CONTROLS[id]) {
                const cfg = CONTROLS[id];
                if (cfg.group === "domainSettings") domainSettings[cfg.key] = false;
                if (cfg.group === "keywordSettings") keywordSettings[cfg.key] = false;
              }
              delete cooldowns[id];
              needsSave = true;
            }
          }

          if (needsSave) {
            storageSet({ domainSettings, keywordSettings, customDomains, cooldowns }).then(() => {
              if (clearPendingDomains) storageRemove("pendingCustomDomains").catch(() => {});
              notifySettingsChanged();
            }).catch(() => {});
          }
        }

        for (const [id, cfg] of Object.entries(CONTROLS)) {
          const groupData = cfg.group === "domainSettings" ? domainSettings : keywordSettings;
          const isEnabled = cfg.defaultOn
            ? groupData[cfg.key] !== false
            : !!groupData[cfg.key];

          elements[id].checked = isEnabled;
          elements[id].disabled = COOLDOWN_ENABLED && (cooldowns[id] || 0) > now;
        }

        const customDomainsEl = document.getElementById("customDomains");
        if (document.activeElement !== customDomainsEl) customDomainsEl.value = customDomains.join("\n");
        customDomainsEl.disabled = COOLDOWN_ENABLED && (cooldowns.customDomains || 0) > now;

        updateCountdown(cooldowns);
      })
      .catch((error) => console.error("Could not load Crusader Block popup settings:", error));
  }

  /** Saves added custom domains immediately; delays removals until after cooldown. */
  function saveCustomDomains() {
    storageGet(["customDomains", "cooldowns"]).then((saved) => {
      const cooldowns = { ...(saved.cooldowns || {}) };
      if (COOLDOWN_ENABLED && (cooldowns.customDomains || 0) > Date.now()) return;

      const prevDomains = saved.customDomains || [];
      const nextDomains = document.getElementById("customDomains").value
        .split(/\n|,/)
        .map((value) => value.trim().toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0])
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index);

      if (JSON.stringify(nextDomains) === JSON.stringify(prevDomains)) return;
      const removedAny = prevDomains.some((domain) => !nextDomains.includes(domain));

      if (removedAny && COOLDOWN_ENABLED) {
        cooldowns.customDomains = Date.now() + COOLDOWN_MS;
        storageSet({ pendingCustomDomains: nextDomains, cooldowns }).then(load).catch(() => {});
      } else {
        storageSet({ customDomains: nextDomains }).then(() => {
          notifySettingsChanged();
          load();
        }).catch(() => {});
      }
    }).catch((error) => console.error("Could not save custom domains:", error));
  }

  /** Activates immediately; queues deactivations until after the cooldown expires. */
  function setSetting(id, enabled) {
    const cfg = CONTROLS[id];

    storageGet([cfg.group, "cooldowns"]).then((saved) => {
      const cooldowns = { ...(saved.cooldowns || {}) };
      if (COOLDOWN_ENABLED && (cooldowns[id] || 0) > Date.now()) return;

      if (enabled || !COOLDOWN_ENABLED) {
        // Activating (or cooldown disabled): apply immediately
        const groupData = { ...(saved[cfg.group] || {}) };
        groupData[cfg.key] = enabled;
        delete cooldowns[id];

        storageSet({ [cfg.group]: groupData, cooldowns }).then(() => {
          notifySettingsChanged();
          load();
        }).catch(() => {});
      } else {
        // Deactivating: keep it enabled and start the cooldown first
        cooldowns[id] = Date.now() + COOLDOWN_MS;
        storageSet({ cooldowns }).then(load).catch(() => {});
      }
    }).catch((error) => console.error("Could not update Crusader Block settings:", error));
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

  // Dev-only: lets you run resetCooldowns() from the popup console
  if (SHUTDOWN_COOLDOWN) {
    globalThis.resetCooldowns = () => {
      storageRemove(["cooldowns", "pendingCustomDomains"]).then(() => {
        notifySettingsChanged();
        load();
        console.log("Cooldowns cleared!");
      }).catch(() => {});
    };
  }

  load();
  setInterval(load, DEBUG_COOLDOWN ? 1000 : 60000);
})();
