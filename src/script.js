let styleElement = null;

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "toggle-dark-mode") {
    const existingStyle = document.querySelector("[data-force-dark-mode]");
    if (existingStyle) {
      existingStyle.remove();
      return;
    }

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

    document.head.appendChild(styleElement);
  }
});
