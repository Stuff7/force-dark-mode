/**
 * Sets the command key in the extension's storage.
 * @param {string} commandKey - The command key to be set.
 */
function setCommandKey(commandKey) {
  browser.commands.update({
    name: "toggle-dark-mode",
    shortcut: commandKey,
  });
}

browser.storage.onChanged.addListener((changes) => {
  if (changes.commandKey) {
    setCommandKey(changes.commandKey.newValue);
  }
});

browser.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-dark-mode") {
    const { extensionStatus = true } = await browser.storage.local.get("extensionStatus");

    if (!extensionStatus) {
      return;
    }

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      throw new Error("Failed to get current tab id.");
    }

    browser.tabs.sendMessage(tab.id, { action: "toggle-dark-mode" });
  }
});
