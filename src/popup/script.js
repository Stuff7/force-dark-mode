const saveButton = getElementByIdOrThrow("saveButton");
const defaultCommand = "Ctrl+Comma";

browser.storage.local.get("commandKey").then(({ commandKey }) => {
  if (commandKey) {
    setKeyCombination(commandKey);
  }
});

document.body.addEventListener("keydown", (event) => {
  event.preventDefault();
  const modifiers = [];

  if (event.shiftKey) {
    modifiers.push("Shift");
  }

  if (event.ctrlKey) {
    modifiers.push("Ctrl");
  }

  if (event.altKey) {
    modifiers.push("Alt");
  }

  if (event.metaKey) {
    modifiers.push("Command");
  }

  const combination = modifiers.slice(0, 2);

  if (KEYS.includes(event.code)) {
    combination.push(event.code);
  } else if (
    event.code.startsWith("Key") ||
    event.code.startsWith("Numpad") ||
    event.code.startsWith("Digit")
  ) {
    combination.push(event.code.charAt(event.code.length - 1));
  } else if (event.code.startsWith("Arrow")) {
    combination.push(event.code.slice(5));
  } else if (!MODIFIERS.includes(event.code)) {
    saveButton.dataset.error = `Key ${event.code} is not allowed.`;
    return;
  } else {
    saveButton.dataset.error = "Shortcut must contain at least one key.";
    return;
  }

  if (combination.length < 2) {
    saveButton.dataset.error = "Shortcut must consist of at least 1 modifier and one key.";
    return;
  }

  setKeyCombination(combination.join("+"));
});

saveButton.addEventListener("click", () => {
  if (!saveButton.dataset.error) {
    saveCommandKey(saveButton.dataset.keyCombination || defaultCommand);
    window.close();
  }
});

/**
 * Sets key combination and clears errors.
 * @param {string} combination - Key combination to set.
 */
function setKeyCombination(combination) {
  saveButton.dataset.keyCombination = combination;
  delete saveButton.dataset.error;
}

/**
 * Gets an element by ID or throws an error if is not found.
 * @param {string} id - Element ID
 * @returns {HTMLElement} - The HTML Element
 */
function getElementByIdOrThrow(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Could not find element with id ${id}`);
  }
  return element;
}

/**
 * Saves the command key in the extension's storage.
 * @param {string} commandKey - The command key to be saved.
 */
function saveCommandKey(commandKey) {
  browser.storage.local.set({ commandKey })
    .catch((error) => console.error("Error saving command key:", error));
}

const KEYS = [
  "Comma",
  "Period",
  "Space",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
  "Delete",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
];

const MODIFIERS = [
  "ControlLeft",
  "ShiftLeft",
  "AltLeft",
  "ControlRight",
  "ShiftRight",
  "AltRight",
];
