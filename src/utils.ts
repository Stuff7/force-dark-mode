export type Storage = {
  sites: string[];
  blacklists: Record<string, string[]>;
  commandKey: string;
};

export type StorageChanges = {
  [K in keyof Storage]?: {
    oldValue: Storage[K];
    newValue: Storage[K];
  };
};

export function getBlacklist(
  blacklists: Storage["blacklists"],
  host = location.host,
) {
  if (!blacklists[host]) blacklists[host] = [];
  return blacklists[host];
}

type StorageResult<T> = {
  [K in keyof T]: T[K];
};

const defaultStorage: {
  [K in keyof Storage]: () => Storage[K];
} = {
  blacklists: () => ({}),
  sites: () => [],
  commandKey: () => "",
};

type BrowserStorageFetchResult<K extends keyof Storage> =
  | StorageResult<Storage>
  | StorageResult<Pick<Storage, K>>;

export async function fetchBrowserStorage<K extends keyof Storage>(
  keys?: K | K[],
): Promise<BrowserStorageFetchResult<K>> {
  const result = (await browser.storage.sync.get(
    keys,
  )) as BrowserStorageFetchResult<K>;

  if (typeof keys === "string") {
    if (result[keys] == null) result[keys] = defaultStorage[keys]?.();
  } else if (keys) {
    for (const k of keys) {
      if (result[k] == null) result[k] = defaultStorage[k]?.();
    }
  }

  return result;
}

export async function setBrowserStorage(data: Partial<Storage>) {
  await browser.storage.sync.set(data);
}

export function getElementByIdOrThrow<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw `[dark-mode]: Could not find element with id ${id}`;
  }

  return element as T;
}

export function generateShortId(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => chars[x % chars.length]).join("");
}

export function getCurrentHost(url: string) {
  return new URL(url).host;
}

export async function toggleSite(url: string) {
  let { sites } = await fetchBrowserStorage("sites");

  const enabled = sites.includes(url);
  if (enabled) {
    sites = sites.filter((s) => s !== url);
  } else {
    sites.push(url);
  }

  await setBrowserStorage({ sites });

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

export function escapeCSS(str: string): string {
  return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

export function getNthChild(element: Element): string {
  const siblings = Array.from(element.parentNode?.children || []);
  const index = siblings.indexOf(element) + 1;
  return `:nth-child(${index})`;
}

export function getNthOfType(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const siblings = Array.from(element.parentNode?.children || []).filter(
    (el) => el.tagName.toLowerCase() === tagName,
  );
  const index = siblings.indexOf(element) + 1;
  return `:nth-of-type(${index})`;
}

export function getElementPath(element: Element): Element[] {
  const path: Element[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    path.unshift(current);
    current = current.parentElement;
  }
  return path;
}

export function getUniqueClasses(element: Element): string[] {
  const classes = Array.from(element.classList);
  if (!element.parentNode) return classes;

  const siblings = Array.from(element.parentNode.children).filter(
    (el) => el !== element,
  );
  return classes.filter(
    (cls) => !siblings.some((sibling) => sibling.classList.contains(cls)),
  );
}

export function getUniqueAttributes(
  element: Element,
): Array<{ name: string; value: string }> {
  const attributeNames = element
    .getAttributeNames()
    .filter((name) => !["class", "id", "style"].includes(name));

  if (!element.parentNode) {
    return attributeNames.map((name) => ({
      name,
      value: element.getAttribute(name) || "",
    }));
  }

  const siblings = Array.from(element.parentNode.children).filter(
    (el) => el !== element,
  );

  return attributeNames
    .filter((name) => {
      const value = element.getAttribute(name);
      return !siblings.some((sibling) => sibling.getAttribute(name) === value);
    })
    .map((name) => ({
      name,
      value: element.getAttribute(name) || "",
    }));
}

type BrowserMsg<Name extends string, T = {}> = { event: Name } & T;

type BrowserEvent =
  | BrowserMsg<"popupClose">
  | BrowserMsg<"highlightSelector", { selector?: string }>
  | BrowserMsg<"toggleZapMode">
  | BrowserMsg<"toggleDarkMode">
  | BrowserMsg<"blacklistUpdate">
  | BrowserMsg<"toggleZapMode">
  | BrowserMsg<"getZapMode">;

export function sendBrowserMessage(tabId: number, ev: BrowserEvent) {
  return browser.tabs.sendMessage(tabId, ev);
}

export function onStorageChange(fn: (changes: StorageChanges) => void) {
  return browser.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") return fn(changes);
  });
}

export function onBrowserMessage(fn: (ev: BrowserEvent) => void) {
  return browser.runtime.onMessage.addListener(fn);
}
