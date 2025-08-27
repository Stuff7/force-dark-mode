import { getSites, toggleSite } from "./utils";

let inZapMode = false;

const shadowHost = document.createElement("div");
shadowHost.style.position = "fixed";
shadowHost.style.zIndex = Number.MAX_SAFE_INTEGER.toString();
shadowHost.style.left = "0";
shadowHost.style.top = "0";
shadowHost.id = "dark-mode-zap-overlay";
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

      #highlight {
        position: fixed;
        background: #08f4;
        pointer-events: none;
        outline: 2px solid #08f8;
        z-index: 1;

        .text {
          position: absolute;
          top: 100%;
          left: 0;
        }
      }
    }
  </style>

  <div id="overlay">
    <em>Press <strong>Escape</strong> to exit zap mode.</em>
    <div id="highlight">
      <strong class="text"></strong>
    </div>
  </div>
`;

const zapOverlay = shadowRoot.getElementById("overlay")!;
const zapHighlight = shadowRoot.getElementById("highlight")!;
const selectedText = zapHighlight.querySelector(".text")! as HTMLElement;
let pickedElement: HTMLElement | null;

window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") setZapMode(false);
});

function getPickedElement(ev: MouseEvent) {
  zapOverlay.style.pointerEvents = "none";
  pickedElement = document.elementFromPoint(
    ev.clientX,
    ev.clientY,
  ) as HTMLElement;
  zapOverlay.style.pointerEvents = "auto";
  return pickedElement;
}

function zapElement(ev: MouseEvent) {
  if (!getPickedElement(ev)) return;
  console.log("TARGET", pickedElement);
  console.log("SELECTOR", selectedText.innerText);
}

function highlightZapElement(this: HTMLElement, ev: MouseEvent) {
  if (!(pickedElement = getPickedElement(ev))) return;

  zapHighlight.className = "zap-highlight";
  const rect = pickedElement.getBoundingClientRect();
  Object.assign(zapHighlight.style, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  selectedText.innerText = [
    pickedElement.tagName.toLowerCase(),
    ...pickedElement.classList,
  ].join(".");
}

function setZapMode(value: boolean) {
  inZapMode = value;
  if (!inZapMode) {
    zapOverlay.removeEventListener("click", zapElement, true);
    zapOverlay.removeEventListener("pointermove", highlightZapElement, true);
    shadowHost.remove();
    return;
  }

  console.log("ATTACH ZAP");
  document.body.append(shadowHost);
  zapOverlay.addEventListener("click", zapElement, true);
  zapOverlay.addEventListener("pointermove", highlightZapElement, true);
}

async function toggleDarkMode(enabled: boolean) {
  if (enabled) {
    const darkModeStyle = document.createElement("style");
    darkModeStyle.dataset.darkMode = "";
    darkModeStyle.setAttribute("type", "text/css");

    darkModeStyle.innerHTML = `
      html {
        filter: invert(1) hue-rotate(180deg) !important;
      }
      img, picture, video, iframe {
        filter: invert(1) hue-rotate(180deg) !important;
      }
    `;

    document.head.appendChild(darkModeStyle);
  } else {
    document.querySelector("[data-dark-mode]")?.remove();
  }
}

(async () => {
  browser.runtime.onMessage.addListener(async (message) => {
    console.log("MESSAGE", message);
    if (message.action === "toggleDarkMode") {
      toggleDarkMode(await toggleSite(location.host));
    } else if (message.action === "toggleZapMode") {
      setZapMode(!inZapMode);
    } else if (message.type === "getZapMode") {
      return inZapMode;
    }
  });

  if ((await getSites()).some((host) => host === location.host)) {
    toggleDarkMode(true);
  }
})();
