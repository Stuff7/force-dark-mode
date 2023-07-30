let styleElement = null;

(async function () {
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "toggle-dark-mode") {
      toggleDarkMode();
    }
  });

  if ((await getDarkSites()).some((host) => window.location.href.includes(host))) {
    toggleDarkMode();
  }
})();

/**
 * @returns {Promise<string[]>} sites where dark mode has been enabled before
 */
async function getDarkSites() {
  const { forceDarkModeSites = [] } = await browser.storage.local.get("forceDarkModeSites");
  return [...forceDarkModeSites];
}

/** Toggles dark mode */
async function toggleDarkMode() {
  const existingStyle = document.querySelector("[data-force-dark-mode]");
  const forceDarkModeSites = new Set(await getDarkSites());
  if (existingStyle) {
    forceDarkModeSites.delete(window.location.host);
    existingStyle.remove();
  } else {
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.dataset.forceDarkMode = "";

      styleElement.textContent = `
        * {
          background: #111 !important;
          color: #ccc !important;
        }
      `;
    }
    forceDarkModeSites.add(window.location.host);
    document.head.appendChild(styleElement);
  }

  browser.storage.local.set({ forceDarkModeSites }).catch((error) => {
    console.error(`Error saving forceDarkModeSites: ${error}`);
  });
}
