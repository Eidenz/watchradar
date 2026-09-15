<script lang="ts">
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { CheckCircle2, AlertTriangle, Info } from '@lucide/svelte';
  import { toast } from '../lib/toast.svelte';
</script>

<div class="host" aria-live="polite">
  {#each toast.items as t (t.id)}
    <div class="toast" animate:flip={{ duration: 200 }} in:fly={{ y: 16, duration: 260 }} out:fly={{ y: 8, duration: 160 }}>
      <button class="main" onclick={() => toast.dismiss(t.id)}>
        {#if t.type === 'success'}<CheckCircle2 size={17} class="ic ok" />
        {:else if t.type === 'error'}<AlertTriangle size={17} class="ic bad" />
        {:else}<Info size={17} class="ic info" />{/if}
        <span>{t.message}</span>
      </button>
      {#if t.action}
        <button class="act" onclick={() => { t.action?.run(); toast.dismiss(t.id); }}>{t.action.label}</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .host {
    position: fixed; left: 0; right: 0; bottom: calc(1rem + env(safe-area-inset-bottom)); z-index: 100;
    display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 0 1rem; pointer-events: none;
  }
  @media (max-width: 1023px) { .host { bottom: calc(var(--bottomnav-h) + 0.75rem + env(safe-area-inset-bottom)); } }
  .toast {
    pointer-events: auto; display: flex; align-items: center; max-width: 30rem;
    background: rgb(var(--c-raised)); border: 1px solid rgb(var(--c-border)); border-radius: var(--radius-md); box-shadow: var(--shadow-pop);
    font-size: 0.875rem; font-weight: 500; color: rgb(var(--c-text-1)); overflow: hidden;
  }
  .main { display: flex; align-items: center; gap: 0.625rem; padding: 0.625rem 1rem; text-align: left; color: inherit; }
  .act { padding: 0.625rem 0.9rem; border-left: 1px solid rgb(var(--c-border)); color: rgb(var(--c-brand)); font-weight: 700; }
  .act:hover { background: rgb(var(--c-subtle)); }
  .toast :global(.ic) { flex-shrink: 0; }
  .toast :global(.ok) { color: rgb(var(--c-success)); }
  .toast :global(.bad) { color: rgb(var(--c-danger)); }
  .toast :global(.info) { color: rgb(var(--c-brand)); }
</style>
