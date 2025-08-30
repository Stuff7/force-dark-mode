import { mount } from "svelte";
import Popup from "./Popup.svelte";
import {
  fetchBrowserStorage,
  getBlacklist,
  getCurrentTab,
  sendBrowserMessage,
} from "./utils";

getCurrentTab().then(async (tab) => {
  let url: URL;

  try {
    if (!tab.url) return;
    url = new URL(tab.url);
  } catch (_) {
    return;
  }

  const inZapMode: boolean = await sendBrowserMessage(tab.id, {
    event: "getZapMode",
  });

  let initialShortcut = "Ctrl+Comma";

  // load default shortcut
  try {
    const commands = await browser.commands.getAll();
    const toggleCommand = commands.find((cmd) => cmd.name === "toggleDarkMode");

    if (toggleCommand && toggleCommand.shortcut) {
      initialShortcut = toggleCommand.shortcut;
    } else {
      initialShortcut = initialShortcut;
    }
  } catch (error) {
    console.error("Failed to load shortcut from manifest:", error);
    initialShortcut = initialShortcut;
  }

  const { commandKey, blacklists, sites } = await fetchBrowserStorage([
    "commandKey",
    "blacklists",
    "sites",
  ]);

  if (commandKey) initialShortcut = commandKey;

  const blacklist = getBlacklist(blacklists, url.host);

  mount(Popup, {
    target: document.body,
    props: {
      tabId: tab.id,
      url,
      inZapMode,
      sitesText: sites.join("\n\n"),
      blacklist,
      initialShortcut,
    },
  });
});
