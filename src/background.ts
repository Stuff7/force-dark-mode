import {
  getCurrentHost,
  getCurrentTab,
  fetchBrowserStorage,
  sendBrowserMessage,
  onStorageChange,
} from "./utils";

function setCommandKey(commandKey: string) {
  browser.commands.update({
    name: "toggleDarkMode",
    shortcut: commandKey,
  });
}

browser.commands.onCommand.addListener(async (command) => {
  if (command === "toggleDarkMode") {
    const tab = await getCurrentTab();
    await sendBrowserMessage(tab.id, { event: "toggleDarkMode" });
  }
});

onStorageChange(async (changes) => {
  const tab = await getCurrentTab();

  if (changes.commandKey) {
    setCommandKey(changes.commandKey.newValue);
  }

  if (changes.blacklists) {
    sendBrowserMessage(tab.id, { event: "blacklistUpdate" });
  }

  if (!changes.sites) return;

  const sites: string[] = changes.sites.newValue || [];

  if (!tab.url || tab.id == null || !tab.url.startsWith("http")) return;

  const site = getCurrentHost(tab.url);
  const enabled = sites.includes(site);

  updateBadge(tab.id, enabled);
});

browser.tabs.onActivated.addListener(({ tabId }) => updateTabBadge(tabId));

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") updateTabBadge(tabId);
});

async function updateTabBadge(tabId: number) {
  const tab = await browser.tabs.get(tabId);
  if (!tab.url || tab.id == null) return;
  const site = getCurrentHost(tab.url);
  const { sites } = await fetchBrowserStorage("sites");
  const enabled = sites.includes(site);

  updateBadge(tab.id, enabled);
}

function updateBadge(tabId: number, enabled: boolean) {
  browser.browserAction.setBadgeText({
    tabId: tabId,
    text: enabled ? "✓" : "x",
  });
  browser.browserAction.setBadgeBackgroundColor({
    tabId: tabId,
    color: enabled ? "#00cc00" : "#cccccc",
  });
}
