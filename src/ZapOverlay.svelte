<script lang="ts" module>
  import {
    elementMatchesBlacklist,
    escapeCSS,
    fetchBrowserStorage,
    findMatchingBlacklistSelectors,
    getBlacklist,
    getElementPath,
    getNthChild,
    getNthOfType,
    getUniqueAttributes,
    getUniqueClasses,
    removeSelectorFromBlacklist,
    setBrowserStorage,
  } from "./utils";

  function classesPart(classes: string[], limit?: number): string {
    const picked = limit === undefined ? classes : classes.slice(0, limit);
    return picked.map((cls) => `.${escapeCSS(cls)}`).join("");
  }

  function tagIdOrClasses(
    element: Element,
    classes: string[],
    classLimit?: number,
  ): string {
    const tagName = element.tagName.toLowerCase();
    if (element.id) return `${tagName}#${escapeCSS(element.id)}`;
    return `${tagName}${classesPart(classes, classLimit)}`;
  }

  function pathSelector(
    pickedElement: Element,
    maxDepth: number,
    classLimit: number,
    nthChildOnLeaf: boolean,
  ): string {
    const path = getElementPath(pickedElement);
    const start = Math.max(0, path.length - Math.min(path.length, maxDepth));

    return path
      .slice(start)
      .map((element, i, slice) => {
        let part = tagIdOrClasses(
          element,
          Array.from(element.classList),
          classLimit,
        );
        if (nthChildOnLeaf && i === slice.length - 1 && !element.id) {
          part += getNthChild(element);
        }
        return part;
      })
      .join(" > ");
  }

  function buildSelector(pickedElement: Element, specificity: number): string {
    const tagName = pickedElement.tagName.toLowerCase();
    const id = pickedElement.id;
    const classes = Array.from(pickedElement.classList);
    const uniqueClasses = getUniqueClasses(pickedElement);

    switch (specificity) {
      case 0:
        return tagName;

      case 1:
        return tagIdOrClasses(pickedElement, classes, 1);

      case 2:
        return tagIdOrClasses(pickedElement, classes);

      case 3: {
        if (id) return `${tagName}#${escapeCSS(id)}`;

        const uniqueAttrs = getUniqueAttributes(pickedElement);
        let selector = tagName + classesPart(uniqueClasses);
        if (uniqueAttrs.length > 0) {
          const attr = uniqueAttrs[0];
          selector += `[${escapeCSS(attr.name)}="${escapeCSS(attr.value)}"]`;
        }
        return selector;
      }

      case 4:
        return (
          tagIdOrClasses(pickedElement, uniqueClasses, 1) +
          getNthChild(pickedElement)
        );

      case 5:
      case 6: {
        const childSelector =
          specificity === 6 && !id && uniqueClasses.length === 0
            ? tagName + getNthChild(pickedElement)
            : tagIdOrClasses(pickedElement, uniqueClasses, 1);

        const parent = pickedElement.parentElement;
        if (!parent) return childSelector;

        const parentSelector =
          specificity === 5
            ? tagIdOrClasses(parent, Array.from(parent.classList), 1)
            : parent.id
              ? `${parent.tagName.toLowerCase()}#${escapeCSS(parent.id)}`
              : parent.tagName.toLowerCase();

        return `${parentSelector} > ${childSelector}`;
      }

      case 7:
        return pathSelector(pickedElement, 2, 1, false);

      case 8:
        return pathSelector(pickedElement, 3, 2, true);

      default: {
        const path = getElementPath(pickedElement);
        return path
          .map((element) => {
            if (element.id) {
              return `${element.tagName.toLowerCase()}#${escapeCSS(element.id)}`;
            }

            const attrs = getUniqueAttributes(element);
            let part =
              element.tagName.toLowerCase() +
              classesPart(Array.from(element.classList));
            if (attrs.length > 0) {
              const attr = attrs[0];
              part += `[${escapeCSS(attr.name)}="${escapeCSS(attr.value)}"]`;
            }
            part += getNthChild(element) + getNthOfType(element);
            return part;
          })
          .join(" > ");
      }
    }
  }

  class ZapState {
    inZapMode = $state(false);
    selectedText = $state("");
    matchCount = $state(0);
    specificityValue = $state(8);
    selectorValue = $state("");
    showEditor = $state(false);

    blacklists = $state.raw<Record<string, string[]>>({});
    blacklist = $derived(getBlacklist(this.blacklists));
    selectorInBlacklist = $derived(this.blacklist.includes(this.selectorValue));

    dragging = $state(false);
    dragX = $state(0);
    dragY = $state(0);
    startDragX = $state(0);
    startDragY = $state(0);
    endDragX = $state(0);
    endDragY = $state(0);

    zapHighlight = $state<DOMRect>(new DOMRect());
    highlights = $state<DOMRect[]>([]);
    popupHighlights = $state<DOMRect[]>([]);
    inspectorHoveredElement = $state<Element>();
    inspectorHighlight = $state<DOMRect>();

    pickedElement = $state<Element>();
    hoveredInBlacklist = $state(false);
    matchedElems: NodeListOf<Element> | undefined;

    setDragPosition(x: number, y: number) {
      this.dragX = x;
      this.dragY = y;
    }

    resetDragPosition(x: number, y: number) {
      this.setDragPosition(x, y);
      this.startDragX = x;
      this.startDragY = y;
      this.endDragX = x;
      this.endDragY = y;
    }

    startDrag(el: Element, ev: PointerEvent) {
      if (ev.target !== el || ev.button !== 0) return;
      this.dragging = true;
      this.startDragX = ev.pageX;
      this.startDragY = ev.pageY;
      this.handleDrag(ev);
    }

    handleDrag(ev: PointerEvent) {
      if (this.dragging) {
        this.setDragPosition(
          this.endDragX + ev.pageX - this.startDragX,
          this.endDragY + ev.pageY - this.startDragY,
        );
      }
    }

    stopDrag() {
      this.dragging = false;
      this.endDragX = this.dragX;
      this.endDragY = this.dragY;
    }

    setZapMode(value: boolean) {
      this.inZapMode = value;
      if (!this.inZapMode) {
        this.closeEditor();
      }
    }

    getHoveredElement(el: HTMLElement, ev: MouseEvent) {
      el.style.pointerEvents = "none";
      const hovered = document.elementFromPoint(
        ev.clientX,
        ev.clientY,
      ) as Element;
      el.style.pointerEvents = "auto";

      this.hoveredInBlacklist = hovered
        ? elementMatchesBlacklist(hovered, this.blacklist)
        : false;

      return hovered;
    }

    zapElement(el: HTMLElement, ev: MouseEvent) {
      if (this.pickedElement) return;
      this.pickedElement = this.getHoveredElement(el, ev);
      if (!this.pickedElement) return;
      this.tweakSpecificity();
      this.showEditor = true;

      const rect = this.pickedElement.getBoundingClientRect();
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

      this.resetDragPosition(x, y);
    }

    onScroll() {
      if (this.pickedElement) {
        this.zapHighlight = this.pickedElement.getBoundingClientRect();
      }
      if (this.inspectorHoveredElement) {
        this.inspectorHighlight =
          this.inspectorHoveredElement.getBoundingClientRect();
      }
      if (!this.matchedElems) return;
      for (let i = 0; i < this.matchedElems.length; i++) {
        this.highlights[i] = this.matchedElems[i].getBoundingClientRect();
      }
    }

    highlightElems() {
      this.removeHighlightedElems();

      try {
        this.matchedElems = document.querySelectorAll(this.selectorValue);
        this.matchCount = this.matchedElems.length;
        this.highlights = [...this.matchedElems].map((el) =>
          el.getBoundingClientRect(),
        );
      } catch (e) {
        this.matchCount = 0;
      }
    }

    removeHighlightedElems() {
      this.highlights = [];
      this.matchedElems = undefined;
    }

    highlightZapElement(el: Element, ev: MouseEvent) {
      if (this.pickedElement) return;
      const hovered = this.getHoveredElement(el as HTMLElement, ev);
      if (!hovered) return;

      this.zapHighlight = hovered.getBoundingClientRect();
      this.selectedText = [
        hovered.tagName.toLowerCase(),
        ...hovered.classList,
      ].join(".");
    }

    async addToBlacklist(ev: SubmitEvent) {
      ev.preventDefault();
      this.blacklists = (await fetchBrowserStorage("blacklists")).blacklists;

      if (!this.blacklist.includes(this.selectorValue)) {
        this.blacklist.push(this.selectorValue);
        await setBrowserStorage({ blacklists: this.blacklists });
      }
    }

    async removeSelectorValueFromBlacklist(ev: MouseEvent) {
      ev.preventDefault();
      this.blacklists = await removeSelectorFromBlacklist(this.selectorValue);
    }

    async removeElementFromBlacklist(el: Element) {
      const selectors = findMatchingBlacklistSelectors(el, this.blacklist);
      let updated = this.blacklists;
      for (const selector of selectors) {
        updated = await removeSelectorFromBlacklist(selector);
      }
      this.blacklists = updated;
    }

    pickElement(el: Element) {
      this.pickedElement = el;
      this.zapHighlight = el.getBoundingClientRect();
      this.selectedText = [el.tagName.toLowerCase(), ...el.classList].join(
        ".",
      );
      this.tweakSpecificity();
    }

    hoverInspectorElement(el: Element | undefined) {
      this.inspectorHoveredElement = el;
      this.inspectorHighlight = el?.getBoundingClientRect();
    }

    tweakSpecificity() {
      const pickedElement = this.pickedElement;
      if (!pickedElement) return;

      let selector = buildSelector(pickedElement, this.specificityValue);

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

      this.selectorValue = selector;
      this.highlightElems();
    }

    closeEditor() {
      this.specificityValue = 8;
      this.pickedElement = undefined;
      this.showEditor = false;
      this.removeHighlightedElems();
      this.hoverInspectorElement(undefined);
    }

    exitZapMode(ev: KeyboardEvent) {
      if (ev.key !== "Escape") return;
      if (this.pickedElement) return this.closeEditor();
      this.setZapMode(false);
    }
  }

  export const zap = new ZapState();
</script>

<script lang="ts">
  import EditorBox from "./EditorBox.svelte";
  import {
    buildDarkModeCSS,
    createDarkModeStyleElement,
    getConfig,
    getDefaultConfig,
    onBrowserMessage,
    onStorageChange,
    toggleSite,
    urlToID,
  } from "./utils";

  const { shadowId }: { shadowId: string } = $props();

  let cfg = $state.raw(getDefaultConfig());

  fetchBrowserStorage(["blacklists", "configs"]).then((r) => {
    if (r.blacklists) zap.blacklists = r.blacklists;
    if (r.configs) cfg = getConfig(r.configs);
  });

  onStorageChange((changes) => {
    if (changes.blacklists) {
      zap.blacklists = changes.blacklists.newValue;
      zap.popupHighlights = [];
    }

    if (changes.configs) {
      cfg = getConfig(changes.configs.newValue);
    }
  });

  const darkModeStyle = createDarkModeStyleElement();

  function toggleDarkMode(enabled: boolean) {
    if (enabled) {
      document.documentElement.appendChild(darkModeStyle);
    } else {
      darkModeStyle.remove();
    }
  }

  $effect(() => {
    darkModeStyle.innerHTML = buildDarkModeCSS(cfg, [
      `#${shadowId}`,
      ...zap.blacklist,
    ]);
  });

  (async () => {
    const urlID = urlToID(location);

    onBrowserMessage(async (message) => {
      if (message.event === "toggleDarkMode") {
        toggleDarkMode(await toggleSite(urlID));
      } else if (message.event === "toggleZapMode") {
        zap.setZapMode(!zap.inZapMode);
      } else if (message.event === "getZapMode") {
        return zap.inZapMode;
      } else if (message.event === "blacklistUpdate") {
        const { sites } = await fetchBrowserStorage("sites");
        await toggleDarkMode(sites.includes(urlID));
      } else if (message.event === "highlightSelector") {
        if (!message.selector) {
          zap.popupHighlights = [];
          return;
        }

        const elems = document.body.querySelectorAll(
          message.selector,
        ) as NodeListOf<Element>;

        zap.popupHighlights = elems
          ? [...elems].map((el) => el.getBoundingClientRect())
          : [];
      } else if (message.event === "popupClose") {
        zap.popupHighlights = [];
      }
    });
  })();

  const hlClasses = "fixed outline outline-solid outline-2 pointer-events-none";
  const hlColor = $derived(
    zap.hoveredInBlacklist
      ? "bg-red-400/50 outline-red-400"
      : "bg-blue-400/50 outline-blue-400",
  );
  const hlStyle = (hl: DOMRect) =>
    `left: ${hl.x}px; top: ${hl.y}px; width: ${hl.width}px; height: ${hl.height}px;`;
</script>

<svelte:window
  onkeydown={(ev) => zap.exitZapMode(ev)}
  onscroll={() => zap.onScroll()}
  onpointermove={(ev) => zap.handleDrag(ev)}
  onpointerup={() => zap.stopDrag()}
/>

{#if zap.inZapMode}
  <div
    class="fixed inset-0 bg-black/30 border-4 border-dashed border-white p-4 cursor-crosshair z-[2147483647] pointer-events-auto w-dvw h-dvh"
    onpointerdown={(ev) => zap.zapElement(ev.currentTarget, ev)}
    onpointermove={(ev) => zap.highlightZapElement(ev.currentTarget, ev)}
  >
    <em class="p-1 text-white"
      >Press <strong>Escape</strong> to exit zap mode.</em
    >

    <div class="{hlClasses} z-2 {hlColor}" style={hlStyle(zap.zapHighlight)}>
      <strong
        class="absolute top-full left-0 text-white bg-black bg-opacity-75 px-1 text-sm truncate text-ellipsis max-w-full"
      >
        {zap.hoveredInBlacklist ? "🚫 " : ""}
        {zap.selectedText}
      </strong>

      {#if zap.showEditor && zap.pickedElement}
        <EditorBox />
      {/if}
    </div>
    {#each zap.highlights as hl}
      <div
        class="{hlClasses} bg-yellow-400/50 outline-yellow-400 z-1"
        style={hlStyle(hl)}
      ></div>
    {/each}
    {#if zap.inspectorHighlight}
      <div
        class="{hlClasses} bg-purple-400/50 outline-purple-400 z-1"
        style={hlStyle(zap.inspectorHighlight)}
      ></div>
    {/if}
  </div>
{/if}

{#each zap.popupHighlights as hl}
  <div
    class="{hlClasses} bg-lime-400/50 outline-lime-400 z-3"
    style={hlStyle(hl)}
  ></div>
{/each}
