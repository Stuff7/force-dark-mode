<script lang="ts">
  import {
    debounce,
    fetchBrowserStorage,
    getBlacklist,
    getCurrentTab,
    saveBlacklistFromText,
    saveSitesFromText,
    sendBrowserMessage,
  } from "./utils";

  let tab = $state<(browser.tabs.Tab & { id: number }) | undefined>();
  let url = $state<URL | undefined>();
  let listeningForShortcut = $state(false);
  let shortcutStatus = $state("Current: (none)");
  let blacklistText = $state("");
  let blacklistStatus = $state("");
  let sitesText = $state("");
  let sitesStatus = $state("");
  let zapButtonText = $state("⚡ Enter Zap Mode");

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
      const toggleCommand = commands.find(
        (cmd) => cmd.name === "toggleDarkMode",
      );

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

  function setKeyCombination(combination: string) {
    shortcutStatus = `Current: ${combination}`;
  }

  function saveCommandKey(commandKey: string) {
    browser.storage.sync.set({ commandKey }).catch((err) => {
      shortcutStatus = `❌ Error saving shortcut: ${err}`;
    });
  }

  async function handleKeydown(event: KeyboardEvent) {
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
      shortcutStatus = "❌ Please add a key to complete the combination.";
      return;
    } else {
      shortcutStatus = `❌ Key ${event.code} not allowed.`;
      return;
    }

    const isFunctionKey = /^F([1-9]|1[0-2])$/.test(keyPart);

    if (!isFunctionKey && modifiers.length === 0) {
      shortcutStatus = "❌ Must have a modifier key (Ctrl, Alt, or Command).";
      return;
    }

    const combo = [...modifiers, ...secondaryModifiers, keyPart];

    if (combo.length > 3) {
      shortcutStatus = "❌ Too many modifiers. Maximum is 2 modifiers + 1 key.";
      return;
    }

    if (!isFunctionKey && combo.length < 2) {
      shortcutStatus = "❌ Must have a modifier + key.";
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
      shortcutStatus = `❌ Failed to save shortcut: ${error.message}`;
      return;
    }

    saveCommandKey(combination);
    setKeyCombination(combination);
    listeningForShortcut = false;
  }

  function handleShortcutClick() {
    listeningForShortcut = true;
    shortcutStatus = "Press a key combination...";
  }

  async function saveBlacklist() {
    if (!url) return;
    await saveBlacklistFromText(url.host, blacklistText);
    blacklistStatus = "Saved!";
  }

  async function saveSites() {
    await saveSitesFromText(sitesText);
    sitesStatus = "Saved!";
  }

  const saveBlacklistDebounced = debounce(saveBlacklist, 300);
  const saveSitesDebounced = debounce(saveSites, 300);

  function handleBlacklistInput() {
    blacklistStatus = "Saving...";
    saveBlacklistDebounced();
  }

  function handleSitesInput() {
    sitesStatus = "Saving...";
    saveSitesDebounced();
  }

  async function handleZapClick() {
    if (!tab) return;
    sendBrowserMessage(tab.id, { event: "toggleZapMode" });
    window.close();
  }

  function handleWindowBlur() {
    if (tab) {
      sendBrowserMessage(tab.id, {
        event: "savePopupData",
        blacklistText,
        sitesText,
      });
    }
  }

  (async () => {
    tab = await getCurrentTab();
    const inZapMode: boolean = await sendBrowserMessage(tab.id, {
      event: "getZapMode",
    });
    zapButtonText = inZapMode ? "⚡ Exit Zap Mode" : "⚡ Enter Zap Mode";

    loadDefaultShortcut();
    const { commandKey, blacklists, sites } = await fetchBrowserStorage([
      "commandKey",
      "blacklists",
      "sites",
    ]);

    if (commandKey) setKeyCombination(commandKey);

    sitesText = sites.join("\n\n");

    url = tab.url ? new URL(tab.url) : undefined;
    if (!url) return;
    blacklistText = getBlacklist(blacklists, url.host).join("\n\n");
  })();
</script>

<svelte:window onkeydown={handleKeydown} onblur={handleWindowBlur} />

<div class="bg-zinc-800 text-zinc-200 p-4 w-75 font-sans">
  <h1 class="text-lg font-medium mb-3 text-white text-center">Dark Mode</h1>

  <button
    onclick={handleShortcutClick}
    class="block w-full p-2.5 mb-1.5 border-none rounded-md bg-zinc-700 text-zinc-200 text-sm cursor-pointer transition-colors hover:bg-zinc-600"
  >
    🎹 Set Keyboard Shortcut
  </button>

  <div class="text-sm text-zinc-300 mb-2.5">{shortcutStatus}</div>

  <textarea
    bind:value={sitesText}
    oninput={handleSitesInput}
    class="w-full h-30 mt-2.5 p-2 rounded-md border border-zinc-600 bg-zinc-750 text-zinc-200 resize-y font-mono text-xs"
    placeholder="Sites list..."
  ></textarea>

  <p class="text-sm text-zinc-400 mt-1">{sitesStatus}</p>

  <textarea
    bind:value={blacklistText}
    oninput={handleBlacklistInput}
    class="w-full h-30 mt-2.5 p-2 rounded-md border border-zinc-600 bg-zinc-750 text-zinc-200 resize-y font-mono text-xs"
    placeholder="Blacklist..."
  ></textarea>

  <p class="text-sm text-zinc-400 mt-1">{blacklistStatus}</p>

  <button
    onclick={handleZapClick}
    class="block w-full p-2.5 mt-1.5 border-none rounded-md bg-zinc-700 text-zinc-200 text-sm cursor-pointer transition-colors hover:bg-zinc-600"
  >
    {zapButtonText}
  </button>
</div>
