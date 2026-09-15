<script lang="ts">
  import { Plus, Loader2, Check } from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  let { open = $bindable(false), mediaId, onchange }: { open: boolean; mediaId: number; onchange?: () => void } = $props();
  let lists = $state<{ id: number; name: string; has: boolean }[]>([]);
  let loading = $state(false);
  let newName = $state('');
  let creating = $state(false);

  $effect(() => {
    if (!open) return;
    loading = true;
    api.lists.forMedia(mediaId).then((r) => (lists = r.lists)).catch((e) => toast.error(e.message)).finally(() => (loading = false));
  });
  async function toggle(l: { id: number; name: string; has: boolean }) {
    try {
      if (l.has) await api.lists.removeItem(l.id, mediaId);
      else await api.lists.addItem(l.id, { media_id: mediaId });
      l.has = !l.has;
      onchange?.();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function create(e: Event) {
    e.preventDefault();
    if (!newName.trim()) return;
    creating = true;
    try {
      const l = await api.lists.create(newName.trim());
      await api.lists.addItem(l.id, { media_id: mediaId });
      lists = [...lists, { id: l.id, name: l.name, has: true }];
      newName = '';
      onchange?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      creating = false;
    }
  }
</script>

<Modal bind:open title="Add to lists" size="sm">
  {#if loading}<div class="skeleton sk"></div>
  {:else}
    <div class="rows">
      {#each lists as l (l.id)}
        <button class="row" data-on={l.has} onclick={() => toggle(l)}>
          <span class="box">{#if l.has}<Check size={14} />{/if}</span><span class="truncate">{l.name}</span>
        </button>
      {/each}
      {#if !lists.length}<p class="faint">You have no lists yet.</p>{/if}
    </div>
  {/if}
  <form class="new" onsubmit={create}>
    <input class="input" placeholder="New list name…" bind:value={newName} maxlength="100" />
    <button class="btn btn-secondary" disabled={creating || !newName.trim()}>{#if creating}<Loader2 size={16} class="spin" />{:else}<Plus size={16} />{/if}</button>
  </form>
</Modal>

<style>
  .sk { height: 6rem; }
  .rows { display: flex; flex-direction: column; gap: 0.25rem; max-height: 40dvh; overflow-y: auto; }
  .row { display: flex; align-items: center; gap: 0.625rem; padding: 0.55rem 0.6rem; border-radius: var(--radius-sm); text-align: left; font-weight: 600; transition: background-color var(--dur-2); }
  .row:hover { background: rgb(var(--c-subtle)); }
  .box { width: 1.25rem; height: 1.25rem; border-radius: 0.35rem; border: 1.5px solid rgb(var(--c-border-strong)); display: grid; place-items: center; color: rgb(var(--c-on-brand)); flex-shrink: 0; transition: all var(--dur-2) var(--ease-spring); }
  .row[data-on='true'] .box { background: rgb(var(--c-brand)); border-color: rgb(var(--c-brand)); }
  .new { display: flex; gap: 0.5rem; margin-top: 0.875rem; }
  .new .btn { flex-shrink: 0; width: 2.5rem; padding: 0; }
</style>
