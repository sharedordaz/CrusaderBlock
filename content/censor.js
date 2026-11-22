(() => {
  const browserApi = globalThis.browser || globalThis.chrome;
  if (!browserApi?.runtime) return;

  let censorWords = [];
  let closeWords = [];

  /** Escapes regular-expression characters so keyword text is matched literally. */
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /** Loads censor and tab-closing keywords, then applies them to the current page. */
  function refreshWords() {
    if (!browserApi.storage?.local) return;
    browserApi.storage.local.get(["keywordSettings"], (result) => {
      const settings = result.keywordSettings || {};
      censorWords = (KEYWORDS.censor || []).filter(() => settings.censor !== false)
        .concat(Array.isArray(settings.censorCustom) ? settings.censorCustom : []);
      closeWords = (KEYWORDS.closeTab || []).filter(() => settings.closeTab !== false)
        .concat(Array.isArray(settings.closeTabCustom) ? settings.closeTabCustom : []);

      if (!checkAndCloseTab()) {
        censorText(document.body);
      }
    });
  }

  /** Reports whether a text value contains at least one configured blocked phrase. */
  function containsBlockedPhrase(text, words) {
    if (!text || !words.length) return false;
    const haystack = text.toLocaleLowerCase();
    return words.some((word) => {
      const normalized = String(word).trim().toLocaleLowerCase();
      return normalized && haystack.includes(normalized);
    });
  }

  /** Checks the page title and body for blocked phrases and closes the tab if matched. */
  function checkAndCloseTab() {
    if (!closeWords.length) return false;

    if (containsBlockedPhrase(document.title, closeWords)) {
      browserApi.runtime.sendMessage({ type: "CLOSE_TAB", reason: document.title });
      return true;
    }

    if (containsBlockedPhrase(document.body?.innerText || "", closeWords)) {
      browserApi.runtime.sendMessage({ type: "CLOSE_TAB", reason: "blocked keyword" });
      return true;
    }

    return false;
  }

  /** Replaces matching text nodes inside root with ASCII bricks. */
  function censorText(root) {
    if (!root) return;

    const censorRegex = censorWords
      .map((word) => escapeRegex(String(word).trim()))
      .filter(Boolean)
      .join("|");
    if (!censorRegex) return;

    const re = new RegExp(censorRegex, "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.parentElement) return NodeFilter.FILTER_REJECT;
        const tag = node.parentElement.tagName;
        return ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(tag)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      if (re.test(node.nodeValue)) {
        re.lastIndex = 0;
        node.nodeValue = node.nodeValue.replace(re, (match) => "█".repeat(match.length));
      }
    }
  }

  refreshWords();

  browserApi.storage?.onChanged?.addListener((changes, area) => {
    if (area === "local" && changes.keywordSettings) refreshWords();
  });

  const observer = new MutationObserver((mutations) => {
    if (checkAndCloseTab()) return;

    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        censorText(mutation.target.parentElement || mutation.target);
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          censorText(node.parentElement || node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          censorText(node);
        }
      }
    }
  });

  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
