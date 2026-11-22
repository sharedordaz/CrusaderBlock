(() => {
  const browserApi = globalThis.browser || globalThis.chrome;
  const storage = browserApi.storage.local;
  const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const DEBUG_COOLDOWN_MS = 10 * 1000; // 10 seconds

  // true = use cooldowns; false = disable cooldowns completely
  const COOLDOWN_ENABLED = true;
  // true = 10 seconds (debug); false = 24 hours (normal)
  const DEBUG_COOLDOWN = true;

  const SHUTDOWN_COOLDOWN = true; // true = dev-only: allows clearing cooldowns from popup console with resetCooldowns()

  const COOLDOWN_MS = DEBUG_COOLDOWN ? DEBUG_COOLDOWN_MS : DAY_MS;

  const elements = Object.fromEntries(
    Object.keys(CONTROLS).map((id) => [id, document.getElementById(id)])
  );

  /** Loads settings, applies any expired pending deactivations, and updates the UI. */
  function load() {
    storage.get(
      ["domainSettings", "cooldowns", "customDomains", "pendingCustomDomains", "keywordSettings"],
      (saved) => {
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
            storage.remove(["cooldowns", "pendingCustomDomains"]);
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
            storage.set({ domainSettings, keywordSettings, customDomains, cooldowns }, () => {
              if (clearPendingDomains) storage.remove("pendingCustomDomains");
              browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
            });
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
        if (document.activeElement !== customDomainsEl) {
          customDomainsEl.value = customDomains.join("\n");
        }
        customDomainsEl.disabled = COOLDOWN_ENABLED && (cooldowns.customDomains || 0) > now;

        updateCountdown(cooldowns);
      }
    );
  }

  /** Saves added custom domains immediately; delays removals until after cooldown. */
  function saveCustomDomains() {
    storage.get(["customDomains", "cooldowns"], (saved) => {
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
        // Queue the removal and keep the old list active until cooldown expires
        cooldowns.customDomains = Date.now() + COOLDOWN_MS;
        storage.set({ pendingCustomDomains: nextDomains, cooldowns }, load);
      } else {
        // Adding domains (or cooldown disabled): apply immediately
        storage.set({ customDomains: nextDomains }, () => {
          browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
          load();
        });
      }
    });
  }

  /** Activates immediately; queues deactivations until after the cooldown expires. */
  function setSetting(id, enabled) {
    const cfg = CONTROLS[id];

    storage.get([cfg.group, "cooldowns"], (saved) => {
      const cooldowns = { ...(saved.cooldowns || {}) };
      if (COOLDOWN_ENABLED && (cooldowns[id] || 0) > Date.now()) return;

      if (enabled || !COOLDOWN_ENABLED) {
        // Activating (or cooldown disabled): apply immediately
        const groupData = { ...(saved[cfg.group] || {}) };
        groupData[cfg.key] = enabled;
        delete cooldowns[id];

        storage.set({ [cfg.group]: groupData, cooldowns }, () => {
          browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
          load();
        });
      } else {
        // Deactivating: keep it enabled and start the cooldown first
        cooldowns[id] = Date.now() + COOLDOWN_MS;
        storage.set({ cooldowns }, load);
      }
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

  // Dev-only: lets you run resetCooldowns() from the popup console
  if (SHUTDOWN_COOLDOWN) {
    globalThis.resetCooldowns = () => {
      storage.remove(["cooldowns", "pendingCustomDomains"], () => {
        browserApi.runtime.sendMessage({ type: "UPDATE_SETTINGS" });
        load();
        console.log("Cooldowns cleared!");
      });
    };
  }

  load();
  setInterval(load, DEBUG_COOLDOWN ? 1000 : 60000);
})();
