import {
  debounce,
  fetchBrowserStorage,
  getBlacklist,
  getCurrentTab,
  getElementByIdOrThrow,
  saveBlacklistFromText,
  saveSitesFromText,
  sendBrowserMessage,
} from "./utils";

let tab: (browser.tabs.Tab & { id: number }) | undefined;
let url: URL | undefined;

const shortcutBtn = getElementByIdOrThrow<HTMLButtonElement>("shortcutBtn");
const shortcutStatus = getElementByIdOrThrow("shortcutStatus");

let listeningForShortcut = false;

shortcutBtn.addEventListener("click", () => {
  listeningForShortcut = true;
  shortcutStatus.textContent = "Press a key combination...";
});

const KEYS = [
  "Comma",
  "Period",
  "Space",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
  "Delete",
];

const MODIFIERS = [
  "ControlLeft",
  "ShiftLeft",
  "AltLeft",
  "ControlRight",
  "ShiftRight",
  "AltRight",
  "MetaLeft",
  "MetaRight",
];

const defaultShortcut = "Ctrl+Comma";

async function loadDefaultShortcut() {
  try {
    const commands = await browser.commands.getAll();
    const toggleCommand = commands.find((cmd) => cmd.name === "toggleDarkMode");

    if (toggleCommand && toggleCommand.shortcut) {
      setKeyCombination(toggleCommand.shortcut);
    } else {
      setKeyCombination(defaultShortcut);
    }
  } catch (error) {
    console.error("Failed to load shortcut from manifest:", error);
    setKeyCombination(defaultShortcut);
  }
}

document.body.addEventListener("keydown", async (event) => {
  if (!listeningForShortcut) return;
  event.preventDefault();

  const modifiers: string[] = [];
  const secondaryModifiers: string[] = [];

  if (event.ctrlKey) {
    modifiers.push("Ctrl");
  }
  if (event.altKey) {
    modifiers.push("Alt");
  }
  if (event.metaKey) {
    modifiers.push("Command");
  }

  if (event.shiftKey) {
    secondaryModifiers.push("Shift");
  }

  let keyPart = "";

  if (event.code.startsWith("F") && /^F([1-9]|1[0-2])$/.test(event.code)) {
    keyPart = event.code;
  } else if (event.code.startsWith("Key")) {
    keyPart = event.code.slice(3);
  } else if (event.code.startsWith("Digit")) {
    keyPart = event.code.slice(5);
  } else if (event.code.startsWith("Arrow")) {
    keyPart = event.code.slice(5);
  } else if (KEYS.includes(event.code)) {
    keyPart = event.code;
  } else if (MODIFIERS.includes(event.code)) {
    shortcutStatus.textContent =
      "❌ Please add a key to complete the combination.";
    return;
  } else {
    shortcutStatus.textContent = `❌ Key ${event.code} not allowed.`;
    return;
  }

  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(keyPart);

  if (!isFunctionKey && modifiers.length === 0) {
    shortcutStatus.textContent =
      "❌ Must have a modifier key (Ctrl, Alt, or Command).";
    return;
  }

  const combo = [...modifiers, ...secondaryModifiers, keyPart];

  if (combo.length > 3) {
    shortcutStatus.textContent =
      "❌ Too many modifiers. Maximum is 2 modifiers + 1 key.";
    return;
  }

  if (!isFunctionKey && combo.length < 2) {
    shortcutStatus.textContent = "❌ Must have a modifier + key.";
    return;
  }

  const combination = combo.join("+");

  try {
    await browser.commands.update({
      name: "toggleDarkMode",
      shortcut: combination,
    });
  } catch (error) {
    console.error("Failed to update shortcut:", error);
    shortcutStatus.textContent = `❌ Failed to save shortcut: ${error.message}`;
    return;
  }

  saveCommandKey(combination);
  setKeyCombination(combination);
  listeningForShortcut = false;
});

function setKeyCombination(combination: string) {
  shortcutBtn.dataset.keyCombination = combination;
  shortcutStatus.textContent = `Current: ${combination}`;
}

function saveCommandKey(commandKey: string) {
  browser.storage.sync.set({ commandKey }).catch((err) => {
    shortcutStatus.textContent = `❌ Error saving shortcut: ${err}`;
  });
}

const blacklistInput = getElementByIdOrThrow<HTMLTextAreaElement>("blacklist");
const blacklistStatus = getElementByIdOrThrow("blacklistStatus");
const sitesInput = getElementByIdOrThrow<HTMLTextAreaElement>("sitesList");
const sitesStatus = getElementByIdOrThrow("sitesStatus");

async function saveBlacklist() {
  if (!url) return;
  await saveBlacklistFromText(url.host, blacklistInput.value);
  blacklistStatus.textContent = "Saved!";
}

window.addEventListener("blur", () => {
  if (tab)
    sendBrowserMessage(tab.id, {
      event: "savePopupData",
      blacklistText: blacklistInput.value,
      sitesText: sitesInput.value,
    });
});

const saveBlacklistDebounced = debounce(saveBlacklist, 300);

blacklistInput.addEventListener("input", () => {
  blacklistStatus.textContent = "Saving...";
  saveBlacklistDebounced();
});

async function saveSites() {
  await saveSitesFromText(sitesInput.value);
  sitesStatus.textContent = "Saved!";
}

const saveSitesDebounced = debounce(saveSites, 300);

sitesInput.addEventListener("input", () => {
  sitesStatus.textContent = "Saving...";
  saveSitesDebounced();
});

const zapBtn = getElementByIdOrThrow<HTMLButtonElement>("zapBtn");

zapBtn.addEventListener("click", async () => {
  const tab = await getCurrentTab();
  sendBrowserMessage(tab.id, { event: "toggleZapMode" });
  window.close();
});

(async () => {
  tab = await getCurrentTab();
  const inZapMode: boolean = await sendBrowserMessage(tab.id, {
    event: "getZapMode",
  });
  zapBtn.textContent = inZapMode ? "⚡ Exit Zap Mode" : "⚡ Enter Zap Mode";

  loadDefaultShortcut();
  const { commandKey, blacklists, sites } = await fetchBrowserStorage([
    "commandKey",
    "blacklists",
    "sites",
  ]);

  if (commandKey) setKeyCombination(commandKey);

  sitesInput.value = sites.join("\n\n");

  url = tab.url ? new URL(tab.url) : undefined;
  if (!url) return;
  blacklistInput.value = getBlacklist(blacklists, url.host).join("\n\n");
})();
