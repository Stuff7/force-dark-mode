import { mount } from "svelte";
import ZapOverlay from "./ZapOverlay.svelte";
import { generateShortId } from "./utils";

const shadowHost = document.createElement("div");
shadowHost.style.position = "fixed";
shadowHost.style.zIndex = Number.MAX_SAFE_INTEGER.toString();
shadowHost.style.left = "0";
shadowHost.style.top = "0";
shadowHost.style.pointerEvents = "none";
shadowHost.id = "dark-mode-" + generateShortId();

const shadowRoot = shadowHost.attachShadow({ mode: "open" });

shadowRoot.innerHTML = `
  <style>
    /* @import "tailwindcss"; */
  </style>
`;

document.body.appendChild(shadowHost);

mount(ZapOverlay, { target: shadowRoot, props: { shadowId: shadowHost.id } });
