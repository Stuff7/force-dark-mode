/** @type {HTMLTextAreaElement} */
const textarea = getElementByIdOrThrow("sitesArea");
const saveBtn = getElementByIdOrThrow("saveBtn");

function loadSites() {
  browser.storage.local.get("sites").then((data) => {
    const sites = data.sites || [];
    textarea.value = sites.join("\n");
  });
}

async function saveSites() {
  const sites = textarea.value
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  await browser.storage.local.set({ sites });

  const saveText = saveBtn.textContent;
  saveBtn.textContent = "Saved!";
  setTimeout(() => {
    saveBtn.textContent = saveText;
  }, 1000);
}

saveBtn.addEventListener("click", saveSites);
window.addEventListener("load", loadSites);

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.sites) loadSites();
});

/**
 * @template {HTMLElement} T
 * @param {string} id - Element ID
 * @returns {T} - The HTML Element
 */
function getElementByIdOrThrow(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`[dark-mode]: Could not find element with id ${id}`);
  }

  return /** @type {T} */ (element);
}
