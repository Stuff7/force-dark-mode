<script lang="ts">
  import {
    Config,
    fetchBrowserStorage,
    getConfig,
    getInvertConfigPreset,
    getDefaultConfig,
    getDimmedConfigPreset,
    setBrowserStorage,
    getSolarizedPreset,
    getHighContrastPreset,
    getNightOwlPreset,
    getSepiaMoodPreset,
    getUltraDimPreset,
    numericInput,
  } from "./utils";

  const { id }: { id: string } = $props();

  let storedConfigs: Record<string, Config> = {};
  let userPreset = getDefaultConfig();
  let cfg = $state(userPreset);

  fetchBrowserStorage("configs").then((r) => {
    storedConfigs = r.configs;
    cfg = getConfig(storedConfigs, id);
    userPreset = cfg;
  });

  $effect(() => {
    storedConfigs[id] = cfg;
    setBrowserStorage({ configs: storedConfigs });
  });

  const sliders: {
    label: string;
    key: keyof Config["css"];
    min: number;
    max: number;
    unit?: string;
  }[] = [
    { label: "Inversion Amount", key: "invert", min: 0, max: 100 },
    { label: "Brightness", key: "brightness", min: 50, max: 150 },
    { label: "Contrast", key: "contrast", min: 50, max: 150 },
    { label: "Hue Rotate", key: "hueRotate", min: 0, max: 360, unit: "°" },
    { label: "Saturation", key: "saturation", min: 0, max: 200 },
  ];

  const presets: { name: string; apply: () => Config; class?: string }[] = [
    { name: "Simple Invert", apply: getInvertConfigPreset },
    { name: "Dimmed", apply: getDimmedConfigPreset },
    { name: "Solarized", apply: getSolarizedPreset },
    { name: "High Contrast", apply: getHighContrastPreset },
    { name: "Night Owl", apply: getNightOwlPreset },
    { name: "Sepia Mood", apply: getSepiaMoodPreset },
    { name: "Ultra Dim", apply: getUltraDimPreset },
    { name: "Reset", apply: () => userPreset, class: "primary" },
  ];
</script>

<div class="w-full max-w-sm font-sans space-y-2">
  <h2 class="text-bg text-lg font-semibold bg-gray-100">✏️ Per Site Config</h2>

  {#each sliders as s}
    <label class="grid grid-cols-[1fr_auto] gap-y-1 gap-x-2 items-center">
      <div class="text-gray-300 font-medium text-xs col-span-2">
        {s.label}
      </div>
      <input type="range" bind:value={cfg.css[s.key]} min={s.min} max={s.max} />
      <label class="min-w-10 text-right text-gray-400 text-xs font-medium">
        <input
          class="text-right w-[3ch] focus:outline-0 focus:text-amber-500 focus:font-bold"
          type="number"
          bind:value={cfg.css[s.key]}
          onfocus={(ev) => ev.currentTarget.select()}
          {@attach numericInput()}
        />
        {s.unit ?? "%"}
      </label>
    </label>
  {/each}

  <label class="flex items-center gap-2">
    <input type="checkbox" bind:checked={cfg.css.preserveImages} />
    <span class="cursor-pointer text-gray-300 text-xs font-normal">
      Preserve images/videos
    </span>
  </label>

  <div class="grid grid-cols-2 gap-2">
    {#each presets as preset}
      <button
        onclick={() => (cfg = preset.apply())}
        class={preset.class ?? "secondary"}
      >
        {preset.name}
      </button>
    {/each}
  </div>

  <div
    class="bg-blue-950 border-l-4 border-blue-500 p-3 rounded-md text-blue-200 text-xs"
  >
    <strong>Tip:</strong> Try 100% inversion + 180° hue to keep colors close to the
    originals
  </div>
</div>
