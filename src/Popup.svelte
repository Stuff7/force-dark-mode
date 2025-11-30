<script lang="ts">
  import {
    debounce,
    fetchBrowserStorage,
    onStorageChange,
    sendBrowserMessage,
    setBrowserStorage,
    urlToID,
  } from "./utils";

  const {
    tabId,
    url,
    inZapMode,
    initialShortcut,
    ...props
  }: {
    tabId: number;
    url: URL;
    inZapMode: boolean;
    sites: string[];
    blacklist: string[];
    initialShortcut: string;
  } = $props();

  const urlID = urlToID(url);

  let sitesText = $state(props.sites.join("\n\n"));
  let blacklist = $state(props.blacklist);
  let shortcutStatus = $state(`Toggle with: (${initialShortcut})`);
  let blacklistStatus = $state("");
  let sitesStatus = $state("");

  let isDarkModeOn = $derived(sitesText.split("\n\n").includes(urlID));

  let listeningForShortcut = false;

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

  onStorageChange((changes) => {
    if (changes.sites) {
      sitesText = changes.sites.newValue.join("\n\n");
    }
  });

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
    shortcutStatus = `Toggle with: (${combination})`;
    listeningForShortcut = false;
  }

  function handleShortcutClick() {
    listeningForShortcut = true;
    shortcutStatus = "Press a key combination...";
  }

  async function removeBlacklistItem(i: number) {
    blacklist.splice(i, 1);
    const { blacklists } = await fetchBrowserStorage("blacklists");
    await setBrowserStorage({
      blacklists: {
        ...blacklists,
        [urlID]: blacklist,
      },
    });
  }

  async function saveSites() {
    const sites = sitesText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await setBrowserStorage({ sites });
    sitesStatus = "Saved!";
  }

  const saveSitesDebounced = debounce(saveSites, 300);

  function handleSitesInput() {
    sitesStatus = "Saving...";
    saveSitesDebounced();
  }

  async function handleZapClick() {
    sendBrowserMessage(tabId, { event: "toggleZapMode" });
    window.close();
  }

  async function handleWindowBlur() {
    sendBrowserMessage(tabId, { event: "popupClose" });
  }
</script>

<svelte:window onkeydown={handleKeydown} onblur={handleWindowBlur} />

<div class="bg-zinc-800 text-zinc-200 p-4 w-75 font-sans rounded-md">
  <h1
    class="flex gap-2 items-center justify-between text-lg font-medium mb-3 text-white"
  >
    <span>Dark Mode</span>
    <button
      class="grow px-2 py-1 text-base text-zinc-900 cursor-pointer rounded-sm"
      class:bg-green-500={!isDarkModeOn}
      class:bg-rose-300={isDarkModeOn}
      onclick={() => sendBrowserMessage(tabId, { event: "toggleDarkMode" })}
    >
      Toggle <strong>{isDarkModeOn ? "OFF" : "ON"}</strong>
    </button>
  </h1>

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
    onblur={saveSites}
    class="w-full h-30 mt-2.5 p-2 rounded-md border border-zinc-600 bg-zinc-750 text-zinc-200 resize-y font-mono text-xs"
    placeholder="Sites list..."
  ></textarea>

  <p class="text-sm text-zinc-400 mt-1">{sitesStatus}</p>

  <div class="flex flex-col gap-3">
    {#if blacklist.length}
      <h2
        class="text-lg font-bold tracking-wide text-zinc-200 uppercase border-b border-zinc-700 pb-1"
      >
        Blacklist
      </h2>
    {/if}
    <ul class="flex flex-col gap-2 overflow-auto max-h-48 pr-1">
      {#each blacklist as selector, i (selector)}
        <li
          class="group cursor-help flex shrink-0 items-center justify-between gap-3 rounded-sm bg-gradient-to-r from-zinc-900 to-zinc-700 text-zinc-200 shadow-md border border-zinc-600 hover:border-red-500/70 hover:shadow-red-500/30 transition-all overflow-hidden"
          onpointerenter={() =>
            sendBrowserMessage(tabId, { event: "highlightSelector", selector })}
          onpointerleave={() =>
            sendBrowserMessage(tabId, { event: "highlightSelector" })}
        >
          <span
            class="grow px-2 py-1 truncate text-sm font-mono tracking-tight"
            title={selector}
          >
            {selector}
          </span>
          <button
            class="flex items-center justify-center px-2 py-1 text-sm font-bold
                 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow cursor-pointer
                 transition-all group-hover:scale-105 group-hover:shadow-red-500/40"
            onclick={() => removeBlacklistItem(i)}
          >
            ✕
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <p class="text-sm text-zinc-400 mt-1">{blacklistStatus}</p>

  <button
    onclick={handleZapClick}
    class="block w-full p-2.5 mt-1.5 border-none rounded-md bg-zinc-700 text-zinc-200 text-sm cursor-pointer transition-colors hover:bg-zinc-600"
  >
    {inZapMode ? "⚡ Exit Zap Mode" : "⚡ Enter Zap Mode"}
  </button>
</div>
