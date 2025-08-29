<script lang="ts">
  import {
    escapeCSS,
    fetchBrowserStorage,
    generateShortId,
    getBlacklist,
    getElementPath,
    getNthChild,
    onBrowserMessage,
    saveBlacklistFromText,
    saveSitesFromText,
    setBrowserStorage,
    toggleSite,
  } from "./utils";

  let inZapMode = $state(false);
  let pickedElement = $state<HTMLElement | null>();
  let matchedElems = $state<NodeListOf<Element> | undefined>();
  let highlightedElems = $state<HTMLElement[]>([]);
  let selectedText = $state("");
  let matchCount = $state(0);
  let specificityValue = $state(8);
  let selectorValue = $state("");
  let showEditor = $state(false);

  let dragging = $state(false);
  let dragX = $state(0);
  let dragY = $state(0);
  let startDragX = $state(0);
  let startDragY = $state(0);
  let endDragX = $state(0);
  let endDragY = $state(0);

  let zapOverlay = $state<HTMLDivElement>();
  let zapHighlight = $state<HTMLDivElement>();
  let editorForm = $state<HTMLFormElement>();

  const shadowId = "dark-mode-" + generateShortId();

  function setDragPosition(x: number, y: number) {
    dragX = x;
    dragY = y;
  }

  function resetDragPosition(x: number, y: number) {
    setDragPosition(x, y);
    startDragX = x;
    startDragY = y;
    endDragX = x;
    endDragY = y;
  }

  function startDrag(ev: PointerEvent) {
    if (ev.target !== editorForm || ev.button !== 0) return;
    dragging = true;
    startDragX = ev.pageX;
    startDragY = ev.pageY;
    handleDrag(ev);
  }

  function handleDrag(ev: PointerEvent) {
    if (dragging) {
      setDragPosition(
        endDragX + ev.pageX - startDragX,
        endDragY + ev.pageY - startDragY,
      );
    }
  }

  function stopDrag() {
    dragging = false;
    endDragX = dragX;
    endDragY = dragY;
  }

  function setZapMode(value: boolean) {
    inZapMode = value;
    if (!inZapMode) {
      closeEditor();
    }
  }

  function getHoveredElement(ev: MouseEvent) {
    if (!zapOverlay) return;
    zapOverlay.style.pointerEvents = "none";
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement;
    zapOverlay.style.pointerEvents = "auto";
    return el;
  }

  function zapElement(ev: MouseEvent) {
    if (pickedElement) return;
    pickedElement = getHoveredElement(ev);
    if (!pickedElement) return;
    tweakSpecificity();
    showEditor = true;

    const rect = pickedElement.getBoundingClientRect();
    let x =
      rect.x + 350 > window.innerWidth
        ? rect.x - Math.abs(350 - rect.width)
        : rect.x;
    let y =
      rect.bottom + 250 > window.innerHeight
        ? rect.y - 250
        : rect.y + rect.height;

    if (
      x < 0 ||
      x + 350 >= window.innerWidth ||
      y < 0 ||
      y + 250 >= window.innerHeight
    ) {
      x = (window.innerWidth - 350) / 2;
      y = (window.innerHeight - 250) / 2;
    }

    resetDragPosition(x, y);
  }

  function onScroll() {
    if (pickedElement) createHighlight(pickedElement, zapHighlight);
    if (!matchedElems) return;
    for (let i = 0; i < matchedElems.length; i++) {
      createHighlight(matchedElems[i] as HTMLElement, highlightedElems[i]);
    }
  }

  function highlightElems() {
    removeHighlightedElems();

    try {
      matchedElems = document.querySelectorAll(selectorValue);
      matchCount = matchedElems.length;

      for (const el of matchedElems) {
        const hl = createHighlight(el as HTMLElement);
        hl.classList.add("secondary");
        highlightedElems.push(hl);
      }

      if (zapOverlay) {
        zapOverlay.append(...highlightedElems);
      }
    } catch (e) {
      matchCount = 0;
    }
  }

  function removeHighlightedElems() {
    for (const hl of highlightedElems) hl.remove();
    highlightedElems = [];
    matchedElems = undefined;
  }

  function createHighlight(
    target: HTMLElement,
    el: HTMLElement = document.createElement("div"),
  ) {
    el.classList.add("hl");
    const rect = target.getBoundingClientRect();
    Object.assign(el.style, {
      position: "fixed",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      background: "rgba(255, 240, 0, 0.25)",
      outline: "2px solid #ff0",
      pointerEvents: "none",
    });

    if (el.classList.contains("secondary")) {
      el.style.background = "rgba(255, 240, 0, 0.25)";
      el.style.outline = "2px solid #ff0";
    }

    return el;
  }

  function highlightZapElement(ev: MouseEvent) {
    if (pickedElement) return;
    const hovered = getHoveredElement(ev);
    if (!hovered) return;

    createHighlight(hovered, zapHighlight);
    selectedText = [hovered.tagName.toLowerCase(), ...hovered.classList].join(
      ".",
    );
  }

  async function addToBlacklist(ev: SubmitEvent) {
    ev.preventDefault();
    const { blacklists } = await fetchBrowserStorage(["blacklists"]);
    getBlacklist(blacklists).push(selectorValue);
    await setBrowserStorage({ blacklists });
  }

  function tweakSpecificity() {
    if (!pickedElement) return;
    const v = specificityValue;
    let selector = "";

    if (v === 0) {
      selector = pickedElement.tagName.toLowerCase();
    } else if (v === 1) {
      const tagName = pickedElement.tagName.toLowerCase();
      const id = pickedElement.id;
      const classes = Array.from(pickedElement.classList);
      if (id) {
        selector = `${tagName}#${escapeCSS(id)}`;
      } else if (classes.length > 0) {
        selector = `${tagName}.${escapeCSS(classes[0])}`;
      } else {
        selector = tagName;
      }
    } else if (v === 8) {
      const path = getElementPath(pickedElement);
      const pathLength = Math.min(path.length, 3);
      const selectorParts: string[] = [];
      for (
        let i = Math.max(0, path.length - pathLength);
        i < path.length;
        i++
      ) {
        const element = path[i];
        const tagName = element.tagName.toLowerCase();
        const id = element.id;
        const classes = Array.from(element.classList);
        let part = tagName;
        if (id) {
          part = `${tagName}#${escapeCSS(id)}`;
        } else if (classes.length > 0) {
          const classStr = classes
            .slice(0, 2)
            .map((cls) => `.${escapeCSS(cls)}`)
            .join("");
          part = `${tagName}${classStr}`;
        }
        if (i === path.length - 1 && !id) {
          part += getNthChild(element);
        }
        selectorParts.push(part);
      }
      selector = selectorParts.join(" > ");
    }

    if (!selector) {
      selector = pickedElement.tagName.toLowerCase();
    }

    try {
      const matches = document.querySelectorAll(selector);
      if (!Array.from(matches).includes(pickedElement)) {
        selector =
          pickedElement.tagName.toLowerCase() + getNthChild(pickedElement);
      }
    } catch (e) {
      selector = pickedElement.tagName.toLowerCase();
    }

    selectorValue = selector;
    highlightElems();
  }

  function closeEditor() {
    specificityValue = 8;
    pickedElement = null;
    showEditor = false;
    removeHighlightedElems();
  }

  function exitZapMode(ev: KeyboardEvent) {
    if (ev.key !== "Escape") return;
    if (pickedElement) return closeEditor();
    setZapMode(false);
  }

  const darkModeStyle = document.createElement("style");
  darkModeStyle.dataset.darkMode = "";
  darkModeStyle.setAttribute("type", "text/css");

  async function toggleDarkMode(enabled: boolean) {
    if (enabled) {
      const blacklist = [
        "img",
        "picture",
        "video",
        "iframe",
        `#${shadowId}`,
        ...getBlacklist((await fetchBrowserStorage("blacklists")).blacklists),
      ].join(", ");

      darkModeStyle.innerHTML = `
        html {
          filter: invert(1) hue-rotate(180deg) !important;
        }
        ${blacklist} {
          filter: invert(1) hue-rotate(180deg) !important;
        }
      `;

      document.head.appendChild(darkModeStyle);
    } else {
      darkModeStyle.remove();
    }
  }

  (async () => {
    onBrowserMessage(async (message) => {
      if (message.event === "toggleDarkMode") {
        toggleDarkMode(await toggleSite(location.host));
      } else if (message.event === "toggleZapMode") {
        setZapMode(!inZapMode);
      } else if (message.event === "getZapMode") {
        return inZapMode;
      } else if (message.event === "blacklistUpdate") {
        const { sites } = await fetchBrowserStorage("sites");
        await toggleDarkMode(sites.includes(location.host));
        closeEditor();
      } else if (message.event === "savePopupData") {
        saveBlacklistFromText(location.host, message.blacklistText);
        saveSitesFromText(message.sitesText);
      }
    });

    if (
      (await fetchBrowserStorage("sites")).sites.some(
        (host) => host === location.host,
      )
    ) {
      toggleDarkMode(true);
    }
  })();
</script>

<svelte:window
  onkeydown={exitZapMode}
  onscroll={onScroll}
  onpointermove={handleDrag}
  onpointerup={stopDrag}
/>

{#if inZapMode}
  <div
    bind:this={zapOverlay}
    class="fixed inset-0 bg-black/30 border-4 border-dashed border-white p-4 cursor-crosshair z-[2147483647]"
    onpointerdown={zapElement}
    onpointermove={highlightZapElement}
  >
    <em class="p-1 text-white"
      >Press <strong>Escape</strong> to exit zap mode.</em
    >

    <div
      bind:this={zapHighlight}
      class="fixed bg-blue-400 bg-opacity-25 outline outline-2 outline-blue-400 pointer-events-none z-10"
    >
      <strong
        class="absolute top-full left-0 text-white bg-black bg-opacity-75 px-1 text-sm"
      >
        {selectedText}
      </strong>

      {#if showEditor}
        <form
          bind:this={editorForm}
          class="fixed bg-gray-800 text-gray-200 p-4 w-[350px] border border-gray-600 rounded-lg pointer-events-auto flex flex-col gap-2 {dragging
            ? 'cursor-grabbing'
            : 'cursor-grab'}"
          style="left: {dragX}px; top: {dragY}px;"
          onsubmit={addToBlacklist}
          onpointerdown={startDrag}
        >
          <button
            type="button"
            class="h-6 w-6 self-end bg-red-500 hover:bg-red-600 rounded text-white"
            onclick={closeEditor}
          >
            ×
          </button>

          <div class="flex items-center gap-2">
            <input
              class="flex-1 bg-gray-700"
              type="range"
              min="0"
              max="9"
              bind:value={specificityValue}
              oninput={tweakSpecificity}
            />
            <span class="text-sm"><strong>{matchCount}</strong> matches</span>
          </div>

          <textarea
            class="bg-gray-700 text-gray-200 p-2 rounded border border-gray-600 resize-y font-mono text-sm"
            rows="5"
            bind:value={selectorValue}
            oninput={highlightElems}
          ></textarea>

          <button
            type="submit"
            class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
          >
            Add To Blacklist
          </button>
        </form>
      {/if}
    </div>
  </div>
{/if}
