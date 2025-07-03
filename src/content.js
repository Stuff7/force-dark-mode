(async () => {
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "toggleDarkMode") {
      toggleDarkMode(message.enabled);
    }
  });

  if ((await getSites()).some((host) => host === location.host)) {
    toggleDarkMode(true);
  }
})();

/** @returns {Promise<string[]>} */
async function getSites() {
  const { sites = [] } = await browser.storage.local.get("sites");
  return [...sites];
}

/** @param {boolean} enabled */
async function toggleDarkMode(enabled) {
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
