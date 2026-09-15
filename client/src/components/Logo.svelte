<script lang="ts">
  let { size = 30, sweep = true }: { size?: number; sweep?: boolean } = $props();
</script>

<svg class="logo" class:sweep width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="wr-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2dd4bf" /><stop offset="1" stop-color="#0d9488" />
    </linearGradient>
    <linearGradient id="wr-s" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset="1" stop-color="#fff" stop-opacity=".9" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#wr-g)" />
  <g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2">
    <circle cx="32" cy="32" r="22" /><circle cx="32" cy="32" r="14" /><circle cx="32" cy="32" r="6" />
    <path d="M32 10v44M10 32h44" stroke-opacity=".28" />
  </g>
  <g class="beam"><path d="M32 32 L32 10 A22 22 0 0 1 52.5 24.5 Z" fill="url(#wr-s)" opacity=".9" /></g>
  <circle cx="32" cy="32" r="3" fill="#fff" />
  <circle class="blip" cx="44" cy="20" r="2.6" fill="#fbbf24" />
</svg>

<style>
  .logo { flex-shrink: 0; filter: drop-shadow(0 2px 6px rgb(13 148 136 / 0.35)); }
  .beam { transform-origin: 32px 32px; }
  .sweep .beam { animation: sweep 4s linear infinite; }
  .sweep .blip { animation: blip 4s ease-in-out infinite; }
  @keyframes sweep { to { transform: rotate(360deg); } }
  @keyframes blip { 0%, 8% { opacity: 1; } 60%, 100% { opacity: 0.15; } }
</style>
