# Dark Mode Extension

A browser extension that inverts site colors to provide a dark mode.  
Automatically built and released using GitHub Actions.

---

## Requirements

- [Node.js](https://nodejs.org/) **22.x**

---

## Build Instructions

1. Clone the repository:

 ```bash
 git clone https://github.com/your-username/dark-mode.git
 cd dark-mode
```

2. Install dependencies:

 ```bash
 npm install
 ```

3. Build the extension:

 ```bash
 npm run build
 ```

4. The built `.xpi` package will be located in: `dist/dark-mode.xpi`

---

## Development

* To test changes, load the unpacked extension in your browser:

  * **Firefox:** `about:debugging` → "This Firefox" → "Load Temporary Add-on" → select `manifest.json`
