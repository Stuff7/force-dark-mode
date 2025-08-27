import { debounce, getCurrentTab, getElementByIdOrThrow } from "./utils";

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

const sitesList = getElementByIdOrThrow<HTMLTextAreaElement>("sitesList");
const sitesStatus = getElementByIdOrThrow("sitesStatus");

async function saveSites() {
  const sites = sitesList.value
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  await browser.storage.sync.set({ sites });
  sitesStatus.textContent = "Saved!";
}

window.addEventListener("unload", saveSites);

const saveSitesDebounced = debounce(saveSites, 500);

sitesList.addEventListener("input", () => {
  sitesStatus.textContent = "Saving...";
  saveSitesDebounced();
});

const zapBtn = getElementByIdOrThrow<HTMLButtonElement>("zapBtn");

zapBtn.addEventListener("click", async () => {
  const tab = await getCurrentTab();
  browser.tabs.sendMessage(tab.id, { action: "toggleZapMode" });
  window.close();
});

(async () => {
  const tab = await getCurrentTab();
  const inZapMode: boolean = await browser.tabs.sendMessage(tab.id, {
    type: "getZapMode",
  });
  zapBtn.textContent = inZapMode ? "⚡ Exit Zap Mode" : "⚡ Enter Zap Mode";

  loadDefaultShortcut();
  const { commandKey, sites } = await browser.storage.sync.get([
    "commandKey",
    "sites",
  ]);
  if (commandKey) setKeyCombination(commandKey);
  if (Array.isArray(sites)) sitesList.value = sites.join("\n");
})();
