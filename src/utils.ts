export function getElementByIdOrThrow<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw `[dark-mode]: Could not find element with id ${id}`;
  }

  return element as T;
}

export async function getSites() {
  const { sites } = await browser.storage.sync.get("sites");
  return Array.isArray(sites) ? sites : [];
}

export function getCurrentHost(url: string) {
  return new URL(url).host;
}

export async function toggleSite(url: string) {
  let sites = await getSites();

  const enabled = sites.includes(url);
  if (enabled) {
    sites = sites.filter((s) => s !== url);
  } else {
    sites.push(url);
  }

  await browser.storage.sync.set({ sites });

  return !enabled;
}

export function debounce(fn: () => void, delayMs = 100) {
  let id = -1;
  return () => {
    clearTimeout(id);
    id = window.setTimeout(fn, delayMs);
  };
}

export async function getCurrentTab() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab.id) {
    throw "Failed to get current tab id.";
  }

  return tab as browser.tabs.Tab & { id: number };
}
