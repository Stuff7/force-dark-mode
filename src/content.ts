import {
  dragState,
  escapeCSS,
  fetchBrowserStorage,
  generateShortId,
  getBlacklist,
  getElementPath,
  getNthChild,
  getNthOfType,
  getUniqueAttributes,
  getUniqueClasses,
  onBrowserMessage,
  saveBlacklistFromText,
  saveSitesFromText,
  setBrowserStorage,
  toggleSite,
} from "./utils";

let inZapMode = false;

const shadowHost = document.createElement("div");
shadowHost.style.position = "fixed";
shadowHost.style.zIndex = Number.MAX_SAFE_INTEGER.toString();
shadowHost.style.left = "0";
shadowHost.style.top = "0";
shadowHost.id = "dark-mode-" + generateShortId();
const shadowRoot = shadowHost.attachShadow({ mode: "open" });
shadowRoot.innerHTML = `
  <style>
    * {
      box-sizing: border-box;
    }

    #overlay {
      position: fixed;
      background: #0005;
      width: 100dvw;
      height: 100dvh;
      border: 4px dashed;
      left: 0;
      top: 0;
      padding: 16px;
      cursor: crosshair;

      * {
        pointer-events: none;
      }

      #exitTip {
        padding: 4px;
      }

      #highlight, .hl {
        --bg: #08f4;
        --border-color: #08f;

        position: fixed;
        background: var(--bg);
        pointer-events: none;
        outline: 2px solid var(--border-color);

        .text {
          position: absolute;
          top: 100%;
          left: 0;
        }

        #editor {
          position: fixed;
          left: var(--x);
          top: var(--y);
          background: #1e1e1e;
          color: #e5e5e5;
          padding: 16px;
          width: 350px;
          border: 1px solid;
          border-radius: 8px;

          &, * {
            pointer-events: all;
          }

          #editorClose {
            height: 24px;
            width: 24px;
            align-self: end;
          }

          textarea {
            resize: vertical;
          }
        }
      }

      #highlight {
        z-index: 1;
      }

      .hl.secondary {
        --bg: #8f04;
        --border-color: #8f0;
      }

      .cursor-grab {
        cursor: grab;
      }

      .cursor-grabbing {
        cursor: grabbing;
      }

      .flex {
        display: flex;
      }

      .gap {
        gap: 8px;
      }

      .flex-col {
        flex-direction: column;
      }

      .grow {
        flex-grow: 1;
      }

      .hidden {
        display: none;
      }
    }
  </style>

  <div id="overlay">
    <em id="exitTip">Press <strong>Escape</strong> to exit zap mode.</em>
    <div id="highlight">
      <strong class="text"></strong>
      <form id="editor" class="hidden flex flex-col gap">
        <button id="editorClose" type="button">x</button>
        <div class="flex">
          <input
            class="grow"
            name="specificity"
            type="range"
            max="9"
            value="8"
          />
          <span><strong id="matchCount"></strong> matches</span>
        </div>
        <textarea name="selector" rows="5"></textarea>
        <button>Add To Blacklist</button>
      </form>
    </div>
  </div>
`;

const zapOverlay = shadowRoot.getElementById("overlay")!;
const zapHighlight = shadowRoot.getElementById("highlight")!;
const selectedText = zapHighlight.querySelector(".text")! as HTMLElement;

const editorForm = shadowRoot.getElementById("editor")! as HTMLFormElement;
const editorClose = shadowRoot.getElementById("editorClose")!;
const matchCount = shadowRoot.getElementById("matchCount")!;
const specificityInput = editorForm.querySelector("input")!;
const selectorInput = editorForm.querySelector("textarea")!;

let pickedElement: HTMLElement | null;

const editorFormDrag = dragState(editorForm);

function setZapMode(value: boolean) {
  inZapMode = value;
  if (inZapMode) {
    document.body.append(shadowHost);
    selectorInput.value = selectedText.innerText;
    window.addEventListener("keydown", exitZapMode, true);
    window.addEventListener("scroll", onScroll, true);
    zapOverlay.addEventListener("click", zapElement, true);
    zapOverlay.addEventListener("pointermove", highlightZapElement, true);
    editorForm.addEventListener("submit", addToBlacklist, true);
    editorFormDrag.addEvents();
    editorClose.addEventListener("click", closeEditor, true);
    specificityInput.addEventListener("input", tweakSpecificity, true);
    selectorInput.addEventListener("input", highlightElems, true);
    return;
  }

  closeEditor();
  window.removeEventListener("keydown", exitZapMode, true);
  window.removeEventListener("scroll", onScroll, true);
  zapOverlay.removeEventListener("click", zapElement, true);
  zapOverlay.removeEventListener("pointermove", highlightZapElement, true);
  editorForm.removeEventListener("submit", addToBlacklist, true);
  editorFormDrag.removeEvents();
  editorClose.removeEventListener("click", closeEditor, true);
  specificityInput.removeEventListener("input", tweakSpecificity, true);
  selectorInput.removeEventListener("input", highlightElems, true);
  shadowHost.remove();
}

function getHoveredElement(ev: MouseEvent) {
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
  editorForm.classList.remove("hidden");
  const rect = pickedElement.getBoundingClientRect();

  let x =
    rect.x + editorForm.clientWidth > window.innerWidth
      ? rect.x - Math.abs(editorForm.clientWidth - rect.width)
      : rect.x;
  let y =
    rect.bottom + editorForm.clientHeight > window.innerHeight
      ? rect.y - editorForm.clientHeight
      : rect.y + rect.height;

  if (
    x < 0 ||
    x + editorForm.clientWidth >= window.innerWidth ||
    y < 0 ||
    y + editorForm.clientHeight >= window.innerHeight
  ) {
    x = (window.innerWidth - editorForm.clientWidth) / 2;
    y = (window.innerHeight - editorForm.clientHeight) / 2;
  }

  editorFormDrag.resetPosition(x, y);
}

function onScroll() {
  if (pickedElement) createHighlight(pickedElement, zapHighlight);
  if (!matchedElems) return;
  for (let i = 0; i < matchedElems.length; i++) {
    createHighlight(matchedElems[i] as HTMLElement, highlightedElems[i]);
  }
}

let matchedElems: NodeListOf<Element> | undefined;
let highlightedElems: HTMLElement[] = [];

function highlightElems() {
  removeHighlightedElems();

  matchedElems = document.querySelectorAll(selectorInput.value);
  matchCount.innerText = matchedElems.length.toString();

  for (const el of matchedElems) {
    const hl = createHighlight(el as HTMLElement);
    hl.classList.add("secondary");
    highlightedElems.push(hl);
  }

  zapOverlay.append(...highlightedElems);
}

function removeHighlightedElems() {
  for (const hl of highlightedElems) hl.remove();
  highlightedElems.length = 0;
  matchedElems = undefined;
}

function createHighlight(
  target: HTMLElement,
  el: HTMLElement = document.createElement("div"),
) {
  el.classList.add("hl");
  const rect = target.getBoundingClientRect();
  Object.assign(el.style, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  return el;
}

function highlightZapElement(this: HTMLElement, ev: MouseEvent) {
  if (pickedElement) return;
  const hovered = getHoveredElement(ev);
  if (!hovered) return;

  createHighlight(hovered, zapHighlight);
  selectedText.innerText = [
    hovered.tagName.toLowerCase(),
    ...hovered.classList,
  ].join(".");
}

async function addToBlacklist(ev: SubmitEvent) {
  ev.preventDefault();
  const { blacklists } = await fetchBrowserStorage(["blacklists"]);
  getBlacklist(blacklists).push(selectorInput.value);
  await setBrowserStorage({ blacklists });
}

function tweakSpecificity() {
  if (!pickedElement) return;
  const v = +specificityInput.value;

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
          .map((attr) => `[${escapeCSS(attr.name)}="${escapeCSS(attr.value)}"]`)
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

    for (let i = Math.max(0, path.length - pathLength); i < path.length; i++) {
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

    for (let i = Math.max(0, path.length - pathLength); i < path.length; i++) {
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
          const classStr = classes.map((cls) => `.${escapeCSS(cls)}`).join("");
          part = `${tagName}${classStr}`;
        }

        if (attrs.length > 0) {
          const attrStr = attrs
            .slice(0, 1)
            .map(
              (attr) => `[${escapeCSS(attr.name)}="${escapeCSS(attr.value)}"]`,
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

  selectorInput.value = selector;
  highlightElems();
}

function closeEditor() {
  specificityInput.value = "8";
  pickedElement = null;
  editorForm.classList.add("hidden");
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
      `#${shadowHost.id}`,
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
