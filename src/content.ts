import { mount } from "svelte";
import ZapOverlay from "./ZapOverlay.svelte";
import {
  buildDarkModeCSS,
  createDarkModeStyleElement,
  fetchBrowserStorage,
  generateShortId,
  getBlacklist,
  getConfig,
  urlToID,
} from "./utils";

const darkModeStyle = createDarkModeStyleElement();

const shadowHost = document.createElement("div");
shadowHost.style.position = "fixed";
shadowHost.style.zIndex = Number.MAX_SAFE_INTEGER.toString();
shadowHost.style.left = "0";
shadowHost.style.top = "0";
shadowHost.style.pointerEvents = "none";
shadowHost.id = "dark-mode-" + generateShortId();

fetchBrowserStorage(["sites", "configs", "blacklists"]).then(
  ({ sites, configs, blacklists }) => {
    const host = urlToID(location);
    if (!sites.includes(host)) return;
    darkModeStyle.innerHTML = buildDarkModeCSS(getConfig(configs, host), [
      `#${shadowHost.id}`,
      ...getBlacklist(blacklists, host),
    ]);
    document.documentElement.appendChild(darkModeStyle);
  },
);

const shadowRoot = shadowHost.attachShadow({ mode: "open" });

shadowRoot.innerHTML = `
  <style>
    /* @import "tailwindcss"; */
  </style>
`;

function mountOverlay() {
  document.body.appendChild(shadowHost);
  mount(ZapOverlay, { target: shadowRoot, props: { shadowId: shadowHost.id } });
}

if (document.body) {
  mountOverlay();
} else {
  document.addEventListener("DOMContentLoaded", mountOverlay, { once: true });
}
