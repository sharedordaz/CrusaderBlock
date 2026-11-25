(() => {
  const translations = {
    es: {
      pageTitle: "Cruzader Block",
      languageSelectAria: "Seleccionar idioma",
      statusText: "Ajustes de protección",
      social: "Redes sociales",
      youtube: "YouTube",
      gambling: "Apuestas",
      adult: "Contenido para adultos",
      videoPlatforms: "Plataformas de video",
      streamingPlatforms: "Plataformas de streaming",
      keywordCensor: "Censura de palabras clave",
      closeTabs: "Cerrar pestañas bloqueadas",
      customDomainsSummary: "Dominios personalizados",
      customDomainsAria: "Dominios personalizados, uno por línea",
      customDomainsPlaceholder: "ejemplo.com\notro.ejemplo",
      blockCustom: "Bloquear dominios personalizados",
      note: "Desactivar la protección inicia un tiempo de espera de 24 horas.",
      donate: "☕ Apoya el desarrollo de CrusaderBlock"
    },
    en: {
      pageTitle: "Cruzader Block",
      languageSelectAria: "Select language",
      statusText: "Protection settings",
      social: "Social networks",
      youtube: "YouTube",
      gambling: "Gambling",
      adult: "Adult content",
      videoPlatforms: "Video platforms",
      streamingPlatforms: "Streaming platforms",
      keywordCensor: "Keyword censor",
      closeTabs: "Close blocked tabs",
      customDomainsSummary: "Custom domains",
      customDomainsAria: "Custom domains, one per line",
      customDomainsPlaceholder: "example.com\nanother.example",
      blockCustom: "Block custom domains",
      note: "Turning protection off starts a 24-hour cooldown.",
      donate: "☕ Support the development of CrusaderBlock"
    },
    pt: {
      pageTitle: "Cruzader Block",
      languageSelectAria: "Selecionar idioma",
      statusText: "Configurações de proteção",
      social: "Redes sociais",
      youtube: "YouTube",
      gambling: "Apostas",
      adult: "Conteúdo adulto",
      videoPlatforms: "Plataformas de vídeo",
      streamingPlatforms: "Plataformas de streaming",
      keywordCensor: "Censura de palavras-chave",
      closeTabs: "Fechar abas bloqueadas",
      customDomainsSummary: "Domínios personalizados",
      customDomainsAria: "Domínios personalizados, um por linha",
      customDomainsPlaceholder: "exemplo.com\noutro.exemplo",
      blockCustom: "Bloquear domínios personalizados",
      note: "Desativar a proteção inicia um tempo de espera de 24 horas.",
      donate: "☕ Apoie o desenvolvimento do CrusaderBlock"
    },
    zh: {
      pageTitle: "Cruzader Block",
      languageSelectAria: "选择语言",
      statusText: "保护设置",
      social: "社交网络",
      youtube: "YouTube",
      gambling: "赌博网站",
      adult: "成人内容",
      videoPlatforms: "视频平台",
      streamingPlatforms: "流媒体平台",
      keywordCensor: "关键词过滤",
      closeTabs: "关闭被屏蔽的标签页",
      customDomainsSummary: "自定义域名",
      customDomainsAria: "自定义域名，每行一个",
      customDomainsPlaceholder: "example.com\nanother.example",
      blockCustom: "屏蔽自定义域名",
      note: "关闭保护将启动24小时冷却时间。",
      donate: "☕ 支持 CrusaderBlock 的开发"
    },
    ru: {
      pageTitle: "Cruzader Block",
      languageSelectAria: "Выбрать язык",
      statusText: "Настройки защиты",
      social: "Социальные сети",
      youtube: "YouTube",
      gambling: "Азартные игры",
      adult: "Контент для взрослых",
      videoPlatforms: "Видеоплатформы",
      streamingPlatforms: "Стриминговые платформы",
      keywordCensor: "Цензура ключевых слов",
      closeTabs: "Закрывать заблокированные вкладки",
      customDomainsSummary: "Пользовательские домены",
      customDomainsAria: "Пользовательские домены, по одному в строке",
      customDomainsPlaceholder: "example.com\nanother.example",
      blockCustom: "Блокировать свои домены",
      note: "Отключение защиты запускает 24-часовую задержку.",
      donate: "☕ Поддержать разработку CrusaderBlock"
    }
  };

  function getSavedLanguage() {
    try {
      return localStorage.getItem("cruzader_lang") || "es";
    } catch {
      return "es";
    }
  }

  function setLanguage(lang) {
    const dict = translations[lang] || translations.en;
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (dict[key]) el.setAttribute("aria-label", dict[key]);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[key]) el.placeholder = dict[key];
    });

    try {
      localStorage.setItem("cruzader_lang", lang);
    } catch {
      // The page still works if extension localStorage is unavailable.
    }
  }

  const languageSelect = document.getElementById("languageSelect");
  if (languageSelect) {
    const savedLang = getSavedLanguage();
    languageSelect.value = translations[savedLang] ? savedLang : "es";
    setLanguage(languageSelect.value);

    languageSelect.addEventListener("change", (event) => {
      setLanguage(event.target.value);
    });
  }
})();