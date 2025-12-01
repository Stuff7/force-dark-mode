<script lang="ts">
  import {
    escapeCSS,
    fetchBrowserStorage,
    getBlacklist,
    getConfig,
    getDefaultConfig,
    getElementPath,
    getNthChild,
    getNthOfType,
    getUniqueAttributes,
    getUniqueClasses,
    onBrowserMessage,
    onStorageChange,
    setBrowserStorage,
    toggleSite,
    urlToID,
  } from "./utils";

  const { shadowId }: { shadowId: string } = $props();

  let inZapMode = $state(false);
  let selectedText = $state("");
  let matchCount = $state(0);
  let specificityValue = $state(8);
  let selectorValue = $state("");
  let showEditor = $state(false);

  let blacklists = $state.raw<Record<string, string[]>>({});
  let blacklist = $derived(getBlacklist(blacklists));
  let selectorInBlacklist = $derived(blacklist.includes(selectorValue));

  let cfg = $state.raw(getDefaultConfig());

  fetchBrowserStorage(["blacklists", "configs"]).then((r) => {
    if (r.blacklists) blacklists = r.blacklists;
    if (r.configs) cfg = getConfig(r.configs);
  });

  onStorageChange((changes) => {
    if (changes.blacklists) {
      blacklists = changes.blacklists.newValue;
      popupHighlights = [];
    }

    if (changes.configs) {
      cfg = getConfig(changes.configs.newValue);
    }
  });

  let dragging = $state(false);
  let dragX = $state(0);
  let dragY = $state(0);
  let startDragX = $state(0);
  let startDragY = $state(0);
  let endDragX = $state(0);
  let endDragY = $state(0);

  let zapHighlight = $state<DOMRect>(new DOMRect());
  let highlights = $state<DOMRect[]>([]);
  let popupHighlights = $state<DOMRect[]>([]);

  let pickedElement: HTMLElement | undefined;
  let hoveredInBlacklist = $state(false);
  let matchedElems: NodeListOf<Element> | undefined;

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

  function startDrag(this: HTMLElement, ev: PointerEvent) {
    if (ev.target !== this || ev.button !== 0) return;
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

  function getHoveredElement(this: HTMLElement, ev: MouseEvent) {
    this.style.pointerEvents = "none";
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement;
    this.style.pointerEvents = "auto";

    hoveredInBlacklist = blacklist.some((s) => {
      const matches = document.querySelectorAll(s);
      return [...matches].includes(el);
    });

    return el;
  }

  function zapElement(this: HTMLElement, ev: MouseEvent) {
    if (pickedElement) return;
    pickedElement = getHoveredElement.call(this, ev);
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
    if (pickedElement) zapHighlight = pickedElement.getBoundingClientRect();
    if (!matchedElems) return;
    for (let i = 0; i < matchedElems.length; i++) {
      highlights[i] = matchedElems[i].getBoundingClientRect();
    }
  }

  function highlightElems() {
    removeHighlightedElems();

    try {
      matchedElems = document.querySelectorAll(selectorValue);
      matchCount = matchedElems.length;
      highlights = [...matchedElems].map((el) => el.getBoundingClientRect());
    } catch (e) {
      matchCount = 0;
    }
  }

  function removeHighlightedElems() {
    highlights = [];
    matchedElems = undefined;
  }

  function highlightZapElement(this: HTMLElement, ev: MouseEvent) {
    if (pickedElement) return;
    const hovered = getHoveredElement.call(this, ev);
    if (!hovered) return;

    zapHighlight = hovered.getBoundingClientRect();
    selectedText = [hovered.tagName.toLowerCase(), ...hovered.classList].join(
      ".",
    );
  }

  async function addToBlacklist(ev: SubmitEvent) {
    ev.preventDefault();
    blacklists = (await fetchBrowserStorage("blacklists")).blacklists;
    blacklist = getBlacklist(blacklists);

    if (!blacklist.includes(selectorValue)) {
      blacklist.push(selectorValue);
      await setBrowserStorage({ blacklists });
    }
  }

  async function removeFromBlacklist(ev: MouseEvent) {
    ev.preventDefault();
    blacklists = (await fetchBrowserStorage("blacklists")).blacklists;
    blacklist = getBlacklist(blacklists);

    const idx = blacklist.indexOf(selectorValue);
    if (idx !== -1) {
      blacklist.splice(idx, 1);
      await setBrowserStorage({ blacklists });
    }
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
    } else if (v === 2) {
      const tagName = pickedElement.tagName.toLowerCase();
      const id = pickedElement.id;
      const classes = Array.from(pickedElement.classList);

      if (id) {
        selector = `${tagName}#${escapeCSS(id)}`;
      } else if (classes.length > 0) {
        const classStr = classes.map((cls) => `.${escapeCSS(cls)}`).join("");
        selector = `${tagName}${classStr}`;
      } else {
        selector = tagName;
      }
    } else if (v === 3) {
      const tagName = pickedElement.tagName.toLowerCase();
      const id = pickedElement.id;
      const uniqueClasses = getUniqueClasses(pickedElement);
      const uniqueAttrs = getUniqueAttributes(pickedElement);

      let parts = [tagName];

      if (id) {
        parts.push(`#${escapeCSS(id)}`);
      } else {
        if (uniqueClasses.length > 0) {
          parts.push(...uniqueClasses.map((cls) => `.${escapeCSS(cls)}`));
        }
        if (uniqueAttrs.length > 0) {
          const attrStr = uniqueAttrs
            .slice(0, 1)
            .map(
              (attr) => `[${escapeCSS(attr.name)}="${escapeCSS(attr.value)}"]`,
            )
            .join("");
          parts.push(attrStr);
        }
      }

      selector = parts.join("");
    } else if (v === 4) {
      const tagName = pickedElement.tagName.toLowerCase();
      const id = pickedElement.id;
      const uniqueClasses = getUniqueClasses(pickedElement);

      let baseSelector = tagName;
      if (id) {
        baseSelector = `${tagName}#${escapeCSS(id)}`;
      } else if (uniqueClasses.length > 0) {
        baseSelector = `${tagName}.${escapeCSS(uniqueClasses[0])}`;
      }

      selector = `${baseSelector}${getNthChild(pickedElement)}`;
    } else if (v === 5) {
      const tagName = pickedElement.tagName.toLowerCase();
      const id = pickedElement.id;
      const parent = pickedElement.parentElement;

      let childSelector = tagName;
      if (id) {
        childSelector = `${tagName}#${escapeCSS(id)}`;
      } else {
        const uniqueClasses = getUniqueClasses(pickedElement);
        if (uniqueClasses.length > 0) {
          childSelector = `${tagName}.${escapeCSS(uniqueClasses[0])}`;
        }
      }

      if (parent) {
        const parentTag = parent.tagName.toLowerCase();
        const parentId = parent.id;
        const parentClasses = Array.from(parent.classList);

        let parentSelector = parentTag;
        if (parentId) {
          parentSelector = `${parentTag}#${escapeCSS(parentId)}`;
        } else if (parentClasses.length > 0) {
          parentSelector = `${parentTag}.${escapeCSS(parentClasses[0])}`;
        }

        selector = `${parentSelector} > ${childSelector}`;
      } else {
        selector = childSelector;
      }
    } else if (v === 6) {
      const tagName = pickedElement.tagName.toLowerCase();
      const id = pickedElement.id;
      const parent = pickedElement.parentElement;

      let childSelector = tagName;
      if (id) {
        childSelector = `${tagName}#${escapeCSS(id)}`;
      } else {
        const uniqueClasses = getUniqueClasses(pickedElement);
        if (uniqueClasses.length > 0) {
          childSelector = `${tagName}.${escapeCSS(uniqueClasses[0])}`;
        } else {
          childSelector = `${tagName}${getNthChild(pickedElement)}`;
        }
      }

      if (parent) {
        const parentTag = parent.tagName.toLowerCase();
        const parentId = parent.id;

        let parentSelector = parentTag;
        if (parentId) {
          parentSelector = `${parentTag}#${escapeCSS(parentId)}`;
        }

        selector = `${parentSelector} > ${childSelector}`;
      } else {
        selector = childSelector;
      }
    } else if (v === 7) {
      const path = getElementPath(pickedElement);
      const pathLength = Math.min(path.length, 2);

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
          part = `${tagName}.${escapeCSS(classes[0])}`;
        }

        selectorParts.push(part);
      }

      selector = selectorParts.join(" > ");
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
    } else {
      const path = getElementPath(pickedElement);
      const selectorParts: string[] = [];

      path.forEach((element) => {
        const tagName = element.tagName.toLowerCase();
        const id = element.id;
        const classes = Array.from(element.classList);
        const attrs = getUniqueAttributes(element);

        let part = tagName;

        if (id) {
          part = `${tagName}#${escapeCSS(id)}`;
        } else {
          if (classes.length > 0) {
            const classStr = classes
              .map((cls) => `.${escapeCSS(cls)}`)
              .join("");
            part = `${tagName}${classStr}`;
          }

          if (attrs.length > 0) {
            const attrStr = attrs
              .slice(0, 1)
              .map(
                (attr) =>
                  `[${escapeCSS(attr.name)}="${escapeCSS(attr.value)}"]`,
              )
              .join("");
            part += attrStr;
          }

          part += getNthChild(element);
          part += getNthOfType(element);
        }

        selectorParts.push(part);
      });

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
    pickedElement = undefined;
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
      document.head.appendChild(darkModeStyle);
    } else {
      darkModeStyle.remove();
    }
  }

  $effect(() => {
    const css = cfg.css;

    const blacklistSelectors = [
      ...(cfg.css.preserveImages ? ["img", "picture", "video", "iframe"] : []),
      `#${shadowId}`,
      ...blacklist,
    ].join(", ");

    darkModeStyle.innerHTML = `
        html {
          filter:
            invert(${css.invert}%)
            brightness(${css.brightness}%)
            contrast(${css.contrast}%)
            hue-rotate(${css.hueRotate}deg)
            saturate(${css.saturation}%)
          !important;
        }

        ${blacklistSelectors} {
          filter:
            invert(${css.invert}%)
            contrast(${(100 / css.contrast) * 100}%)
            saturate(${(100 / css.saturation) * 100}%)
            hue-rotate(${-css.hueRotate}deg)
          !important;
        }
      `;
  });

  (async () => {
    const urlID = urlToID(location);

    onBrowserMessage(async (message) => {
      if (message.event === "toggleDarkMode") {
        toggleDarkMode(await toggleSite(urlID));
      } else if (message.event === "toggleZapMode") {
        setZapMode(!inZapMode);
      } else if (message.event === "getZapMode") {
        return inZapMode;
      } else if (message.event === "blacklistUpdate") {
        const { sites } = await fetchBrowserStorage("sites");
        await toggleDarkMode(sites.includes(urlID));
        closeEditor();
      } else if (message.event === "highlightSelector") {
        if (!message.selector) {
          popupHighlights = [];
          return;
        }

        const elems = document.body.querySelectorAll(
          message.selector,
        ) as NodeListOf<HTMLElement>;

        popupHighlights = elems
          ? [...elems].map((el) => el.getBoundingClientRect())
          : [];
      } else if (message.event === "popupClose") {
        popupHighlights = [];
      }
    });

    if (
      (await fetchBrowserStorage("sites")).sites.some((host) => host === urlID)
    ) {
      toggleDarkMode(true);
    }
  })();

  const hlClasses = "fixed outline outline-solid outline-2 pointer-events-none";
  const hlColor = $derived(
    hoveredInBlacklist
      ? "bg-red-400/50 outline-red-400"
      : "bg-blue-400/50 outline-blue-400",
  );
  const hlStyle = (hl: DOMRect) =>
    `left: ${hl.x}px; top: ${hl.y}px; width: ${hl.width}px; height: ${hl.height}px;`;
</script>

<svelte:window
  onkeydown={exitZapMode}
  onscroll={onScroll}
  onpointermove={handleDrag}
  onpointerup={stopDrag}
/>

{#if inZapMode}
  <div
    class="fixed inset-0 bg-black/30 border-4 border-dashed border-white p-4 cursor-crosshair z-[2147483647] pointer-events-auto w-dvw h-dvh"
    onpointerdown={zapElement}
    onpointermove={highlightZapElement}
  >
    <em class="p-1 text-white"
      >Press <strong>Escape</strong> to exit zap mode.</em
    >

    <div class="{hlClasses} z-2 {hlColor}" style={hlStyle(zapHighlight)}>
      <strong
        class="absolute top-full left-0 text-white bg-black bg-opacity-75 px-1 text-sm truncate text-ellipsis max-w-full"
      >
        {hoveredInBlacklist ? "🚫 " : ""}
        {selectedText}
      </strong>

      {#if showEditor}
        <form
          class="fixed bg-zinc-800 text-zinc-200 p-4 w-[350px] border border-zinc-600 rounded-lg pointer-events-auto flex flex-col gap-2 cursor-grab"
          class:cursor-grabbing={dragging}
          style="left: {dragX}px; top: {dragY}px;"
          onsubmit={addToBlacklist}
          onpointerdown={startDrag}
        >
          <button
            type="button"
            class="danger self-end compact h-6 w-6"
            onclick={closeEditor}
          >
            ×
          </button>

          <div class="flex items-center gap-2">
            <input
              class="flex-1 bg-zinc-700"
              type="range"
              min={0}
              max={9}
              bind:value={specificityValue}
              oninput={tweakSpecificity}
            />
            <span class="text-sm"><strong>{matchCount}</strong> matches</span>
          </div>

          <textarea
            class="bg-zinc-700 text-zinc-200 p-2 rounded border border-zinc-600 resize-y font-mono text-sm"
            rows="5"
            bind:value={selectorValue}
            oninput={highlightElems}
          ></textarea>

          <button type="submit" disabled={selectorInBlacklist} class="primary">
            <span class="text-bg bg-white">
              {selectorInBlacklist
                ? "🚫 Already In Blacklist"
                : "Add To Blacklist"}
            </span>
          </button>

          {#if selectorInBlacklist}
            <button type="button" onclick={removeFromBlacklist} class="danger">
              Remove
            </button>
          {/if}
        </form>
      {/if}
    </div>
    {#each highlights as hl}
      <div
        class="{hlClasses} bg-yellow-400/50 outline-yellow-400 z-1"
        style={hlStyle(hl)}
      ></div>
    {/each}
  </div>
{/if}

{#each popupHighlights as hl}
  <div
    class="{hlClasses} bg-lime-400/50 outline-lime-400 z-3"
    style={hlStyle(hl)}
  ></div>
{/each}
