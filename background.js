const blockedSites = [
  "*://*.masfe.org/*",
  "*://*.another-porn-site.com/*"
];

browser.webRequest.onBeforeRequest.addListener(
  function(details) {
    return { cancel: true };
  },
  { urls: blockedSites },
  ["blocking"]
);

browser.runtime.onInstalled.addListener(() => {
  browser.storage.sync.set({ cleanDays: 0, lastAccess: null });
});

function updateCleanDays() {
  browser.storage.sync.get(['cleanDays', 'lastAccess'], data => {
    const today = new Date().setHours(0, 0, 0, 0);
    if (data.lastAccess !== today) {
      const newCleanDays = (data.cleanDays || 0) + 1;
      browser.storage.sync.set({ cleanDays: newCleanDays, lastAccess: today });
    }
  });
}

browser.tabs.onActivated.addListener(updateCleanDays);
browser.tabs.onUpdated.addListener(updateCleanDays);
