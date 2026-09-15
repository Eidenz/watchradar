<script lang="ts">
  import { Play, Bookmark, CheckCheck, PauseCircle, XCircle } from '@lucide/svelte';
  import type { Status } from '../lib/api';
  import { STATUS_LABEL, STATUS_ORDER } from '../lib/format';
  interface Props {
    value: Status | null;
    onchange: (s: Status) => void;
    compact?: boolean;
    disabled?: boolean;
  }
  let { value, onchange, compact = false, disabled = false }: Props = $props();
  const icons = { watching: Play, to_watch: Bookmark, watched: CheckCheck, on_hold: PauseCircle, dropped: XCircle } as const;
</script>

<div class="picker" class:compact role="group" aria-label="Status">
  {#each STATUS_ORDER as s}
    {@const Icon = icons[s]}
    <button type="button" class="opt status-{s}" data-active={value === s} onclick={() => onchange(s)} {disabled} title={STATUS_LABEL[s]}>
      <Icon size={16} />
      <span>{STATUS_LABEL[s]}</span>
    </button>
  {/each}
</div>

<style>
  .picker { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .opt {
    display: inline-flex; align-items: center; gap: 0.4rem; height: 2.125rem; padding: 0 0.8rem; border-radius: 999px; font-weight: 600; font-size: 0.8125rem;
    background: rgb(var(--c-surface)); border: 1px solid rgb(var(--c-border)); color: rgb(var(--c-text-2)); transition: all var(--dur-2) var(--ease-spring);
  }
  .opt:hover { border-color: rgb(var(--status) / 0.6); color: rgb(var(--status)); transform: translateY(-1px); }
  .opt[data-active='true'] { background: rgb(var(--status) / 0.14); border-color: rgb(var(--status) / 0.5); color: rgb(var(--status)); }
  .opt:disabled { opacity: 0.5; pointer-events: none; }
  .compact .opt span { display: none; }
  .compact .opt { padding: 0; width: 2.125rem; justify-content: center; }
</style>
