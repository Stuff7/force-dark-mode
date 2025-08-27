import { getCurrentHost, getCurrentTab, getSites } from "./utils";

function setCommandKey(commandKey: string) {
  browser.commands.update({
    name: "toggleDarkMode",
    shortcut: commandKey,
  });
}

browser.commands.onCommand.addListener(async (command) => {
  if (command === "toggleDarkMode") {
    const tab = await getCurrentTab();
    browser.tabs.sendMessage(tab.id, { action: "toggleDarkMode" });
  }
});

browser.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  if (changes.commandKey) setCommandKey(changes.commandKey.newValue);
  if (!changes.sites) return;

  const sites: string[] = changes.sites.newValue || [];

  const tab = (
    await browser.tabs.query({ active: true, currentWindow: true })
  )[0];

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
  const sites = await getSites();
  const enabled = sites.includes(site);

  updateBadge(tab.id, enabled);
}

function updateBadge(tabId: number, enabled: boolean) {
  browser.action.setBadgeText({
    tabId: tabId,
    text: enabled ? "✓" : "x",
  });
  browser.action.setBadgeBackgroundColor({
    tabId: tabId,
    color: enabled ? "#00cc00" : "#cccccc",
  });
}
