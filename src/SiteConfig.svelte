<script lang="ts">
  import {
    Config,
    fetchBrowserStorage,
    getConfig,
    onStorageChange,
    setBrowserStorage,
  } from "./utils";

  // TODO: make config reactive
  let configs = $state.raw<Record<string, Config>>({});
  onStorageChange((changes) => {
    if (changes.configs) {
      configs = changes.configs.newValue;
    }
  });
  fetchBrowserStorage("configs").then((r) => (configs = r.configs));
  let cfg = $derived(getConfig(configs).css);

  function applyDark() {
    cfg.invert = 100;
    cfg.brightness = 100;
    cfg.contrast = 100;
    cfg.hueRotate = 180;
    cfg.saturation = 100;
    cfg.preserveImages = true;
    setBrowserStorage({ configs });
  }

  function applyDimmed() {
    cfg.invert = 0;
    cfg.brightness = 80;
    cfg.contrast = 90;
    cfg.hueRotate = 0;
    cfg.saturation = 100;
    cfg.preserveImages = false;
    setBrowserStorage({ configs });
  }

  function applyLight() {
    cfg.invert = 0;
    cfg.brightness = 100;
    cfg.contrast = 100;
    cfg.hueRotate = 0;
    cfg.saturation = 100;
    cfg.preserveImages = false;
    setBrowserStorage({ configs });
  }

  function reset() {
    applyLight();
  }
</script>

<div class="w-full max-w-sm font-sans">
  <h2 class="text-bg text-lg font-semibold bg-gray-100 mb-4">
    ✏️ Per Site Config
  </h2>

  <div class="mb-4">
    <label for="invert" class="block mb-1.5 text-gray-300 font-medium text-xs">
      Inversion Amount
    </label>
    <div class="flex items-center gap-2">
      <input
        type="range"
        id="invert"
        bind:value={cfg.invert}
        min="0"
        max="100"
        class="flex-1 h-1 rounded-full bg-gray-700 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
      />
      <span class="min-w-10 text-right text-gray-400 text-xs font-medium"
        >{cfg.invert}%</span
      >
    </div>
  </div>

  <div class="mb-4">
    <label
      for="brightness"
      class="block mb-1.5 text-gray-300 font-medium text-xs"
    >
      Brightness
    </label>
    <div class="flex items-center gap-2">
      <input
        type="range"
        id="brightness"
        bind:value={cfg.brightness}
        min="50"
        max="150"
        class="flex-1 h-1 rounded-full bg-gray-700 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
      />
      <span class="min-w-10 text-right text-gray-400 text-xs font-medium"
        >{cfg.brightness}%</span
      >
    </div>
  </div>

  <div class="mb-4">
    <label
      for="contrast"
      class="block mb-1.5 text-gray-300 font-medium text-xs"
    >
      Contrast
    </label>
    <div class="flex items-center gap-2">
      <input
        type="range"
        id="contrast"
        bind:value={cfg.contrast}
        min="50"
        max="150"
        class="flex-1 h-1 rounded-full bg-gray-700 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
      />
      <span class="min-w-10 text-right text-gray-400 text-xs font-medium"
        >{cfg.contrast}%</span
      >
    </div>
  </div>

  <div class="mb-4">
    <label for="hue" class="block mb-1.5 text-gray-300 font-medium text-xs">
      Hue Rotate
    </label>
    <div class="flex items-center gap-2">
      <input
        type="range"
        id="hue"
        bind:value={cfg.hueRotate}
        min="0"
        max="360"
        class="flex-1 h-1 rounded-full bg-gray-700 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
      />
      <span class="min-w-10 text-right text-gray-400 text-xs font-medium"
        >{cfg.hueRotate}°</span
      >
    </div>
  </div>

  <div class="mb-4">
    <label
      for="saturation"
      class="block mb-1.5 text-gray-300 font-medium text-xs"
    >
      Saturation
    </label>
    <div class="flex items-center gap-2">
      <input
        type="range"
        id="saturation"
        bind:value={cfg.saturation}
        min="0"
        max="200"
        class="flex-1 h-1 rounded-full bg-gray-700 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
      />
      <span class="min-w-10 text-right text-gray-400 text-xs font-medium"
        >{cfg.saturation}%</span
      >
    </div>
  </div>

  <div class="flex items-center gap-2 mt-2 mb-3">
    <input
      type="checkbox"
      id="preserve"
      bind:checked={cfg.preserveImages}
      class="w-3.5 h-3.5 cursor-pointer"
    />
    <label
      for="preserve"
      class="cursor-pointer text-gray-300 text-xs font-normal"
    >
      Preserve images/videos
    </label>
  </div>

  <div class="flex gap-2 flex-wrap">
    <button
      onclick={applyDark}
      class="flex-1 min-w-20 bg-blue-600 text-white border-0 px-3 py-2 rounded-lg cursor-pointer text-xs font-medium transition-all hover:bg-blue-500"
    >
      Dark Mode
    </button>
    <button
      onclick={applyLight}
      class="flex-1 min-w-20 bg-blue-600 text-white border-0 px-3 py-2 rounded-lg cursor-pointer text-xs font-medium transition-all hover:bg-blue-500"
    >
      Light Mode
    </button>
  </div>
  <div class="flex gap-2 flex-wrap mt-2">
    <button
      onclick={applyDimmed}
      class="flex-1 min-w-20 bg-gray-700 text-white border-0 px-3 py-2 rounded-lg cursor-pointer text-xs font-medium transition-all hover:bg-gray-600"
    >
      Dimmed
    </button>
    <button
      onclick={reset}
      class="flex-1 min-w-20 bg-gray-700 text-white border-0 px-3 py-2 rounded-lg cursor-pointer text-xs font-medium transition-all hover:bg-gray-600"
    >
      Reset
    </button>
  </div>

  <div
    class="bg-blue-950 border-l-4 border-blue-500 p-3 rounded-md mt-3 text-blue-200 text-xs"
  >
    <strong>Tip:</strong> Try 100% inversion + 180° hue for natural dark mode!
  </div>
</div>
