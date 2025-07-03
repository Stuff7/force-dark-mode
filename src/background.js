browser.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.sites) return;

  const sites = changes.sites.newValue || [];

  const tab = (
    await browser.tabs.query({ active: true, currentWindow: true })
  )[0];

  if (!tab.url || tab.id == null || !tab.url.startsWith("http")) return;

  const site = getCurrentHost(tab.url);
  const enabled = sites.includes(site);

  browser.tabs.sendMessage(tab.id, {
    action: "toggleDarkMode",
    enabled,
  });

  updateBadge(tab.id, enabled);
});

browser.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.id == null) return;
  const site = getCurrentHost(tab.url);
  let sites = await getSites();

  const enabled = sites.includes(site);
  if (enabled) {
    sites = sites.filter((s) => s !== site);
  } else {
    sites.push(site);
  }

  await browser.storage.local.set({ sites });
});

browser.tabs.onActivated.addListener(({ tabId }) => updateTabBadge(tabId));

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") updateTabBadge(tabId);
});

/** @param {number} tabId */
async function updateTabBadge(tabId) {
  const tab = await browser.tabs.get(tabId);
  if (!tab.url || tab.id == null) return;
  const site = getCurrentHost(tab.url);
  const sites = await getSites();
  const enabled = sites.includes(site);

  updateBadge(tab.id, enabled);
}

/** @param {number} tabId @param {boolean} enabled */
function updateBadge(tabId, enabled) {
  browser.action.setBadgeText({
    tabId: tabId,
    text: enabled ? "✓" : "x",
  });
  browser.action.setBadgeBackgroundColor({
    tabId: tabId,
    color: enabled ? "#00cc00" : "#cccccc",
  });
}

/** @returns {Promise<string[]>} */
async function getSites() {
  return (await browser.storage.local.get("sites")).sites || [];
}

/** @param {string} url */
function getCurrentHost(url) {
  return new URL(url).host;
}
