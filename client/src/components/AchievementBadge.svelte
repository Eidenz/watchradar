<script lang="ts">
  import { Award } from '@lucide/svelte';
  import { ACHIEVEMENT_ICONS } from '../lib/achievementIcons';
  import type { Achievement } from '../lib/api';
  import { TIERS } from '../lib/format';
  let { a, size = 44, locked = false }: { a: Achievement; size?: number; locked?: boolean } = $props();
  const Icon = $derived(ACHIEVEMENT_ICONS[a.icon] ?? Award);
</script>

<div class="badge tier-{a.tier}" class:locked title="{a.name} — {a.description} ({TIERS[a.tier]})" style:width="{size}px" style:height="{size}px">
  <Icon size={size * 0.45} />
  <span class="tier">{a.tier}</span>
</div>

<style>
  .badge { position: relative; border-radius: 999px; display: grid; place-items: center; border: 2px solid var(--t); color: var(--t); background: color-mix(in srgb, var(--t) 14%, transparent); flex-shrink: 0; transition: transform var(--dur-2) var(--ease-spring); }
  .badge:hover { transform: scale(1.08); }
  .locked { filter: grayscale(1); opacity: 0.35; }
  .tier { position: absolute; bottom: -0.2rem; right: -0.2rem; width: 1rem; height: 1rem; border-radius: 999px; background: var(--t); color: #fff; font-size: 0.625rem; font-weight: 800; display: grid; place-items: center; }
  .tier-1 { --t: #b87333; }
  .tier-2 { --t: #8a949c; }
  .tier-3 { --t: #d4a017; }
  .tier-4 { --t: #8b5cf6; }
  .tier-5 { --t: #06b6d4; }
</style>
