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
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      console.error("Failed to get current tab id.");
      return;
    }
    browser.tabs.sendMessage(tab.id, { action: "toggle-dark-mode" });
  }
});
