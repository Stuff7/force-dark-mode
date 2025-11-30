# Dark Mode Extension

A browser extension that inverts site colors to provide a dark mode.  

---

## Requirements

- [Node.js](https://nodejs.org/) **22.x**
- [tailwindcss in PATH](https://github.com/tailwindlabs/tailwindcss/releases) **4.1.17**
- [esbuild in PATH](https://esbuild.github.io/getting-started/#download-a-build) **0.27.x**
- bsdtar in PATH

---

## Build Instructions

1. Clone the repository:

 ```bash
 git clone https://github.com/stuff7/dark-mode.git
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
