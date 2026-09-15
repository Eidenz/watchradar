<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { X } from '@lucide/svelte';

  interface Props {
    open?: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    children?: Snippet;
    footer?: Snippet;
    onclose?: () => void;
  }
  let { open = $bindable(false), title, size = 'md', children, footer, onclose }: Props = $props();

  function close() {
    open = false;
    onclose?.();
  }

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  });
</script>

{#if open}
  <div class="wrap">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="backdrop" role="presentation" transition:fade={{ duration: 180 }} onclick={close}></div>
    <div class="dialog {size}" role="dialog" aria-modal="true" aria-label={title} in:fly={{ y: 24, duration: 260, opacity: 0 }} out:fly={{ y: 12, duration: 160, opacity: 0 }}>
      {#if title}
        <div class="head">
          <h2>{title}</h2>
          <button class="icon-btn" onclick={close} aria-label="Close"><X size={18} /></button>
        </div>
      {/if}
      <div class="body">{@render children?.()}</div>
      {#if footer}<div class="foot">{@render footer()}</div>{/if}
    </div>
  </div>
{/if}

<style>
  .wrap { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center; }
  @media (min-width: 640px) { .wrap { align-items: center; padding: 1rem; } }
  .backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / 0.4); backdrop-filter: blur(3px); }
  :global(html.dark) .backdrop { background: rgb(0 0 0 / 0.6); }
  .dialog {
    position: relative; width: 100%; max-height: 92dvh; display: flex; flex-direction: column;
    background: rgb(var(--c-raised)); border: 1px solid rgb(var(--c-border));
    border-radius: var(--radius-xl) var(--radius-xl) 0 0; box-shadow: var(--shadow-lg);
    animation: pop var(--dur-4) var(--ease-spring) both;
  }
  @keyframes pop { from { transform: scale(0.97); } to { transform: scale(1); } }
  @media (min-width: 640px) {
    .dialog { border-radius: var(--radius-xl); max-height: 85dvh; }
    .sm { max-width: 24rem; }
    .md { max-width: 32rem; }
    .lg { max-width: 42rem; }
    .xl { max-width: 56rem; }
  }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.25rem 0.25rem; }
  .head h2 { font-size: 1.125rem; }
  .body { padding: 0.75rem 1.25rem 1.25rem; overflow-y: auto; }
  .foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0 1.25rem 1.25rem; flex-wrap: wrap; }
</style>
