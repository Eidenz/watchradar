<script lang="ts">
  import { ListVideo, Plus, Pencil, Trash2, Loader2 } from '@lucide/svelte';
  import { api, type ListSummary } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { confirm } from '../lib/confirm.svelte';
  import { img, relTime } from '../lib/format';
  import Modal from '../components/Modal.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let lists = $state<ListSummary[] | null>(null);
  let modal = $state(false);
  let editing = $state<ListSummary | null>(null);
  let name = $state('');
  let description = $state('');
  let busy = $state(false);

  async function load() {
    try {
      lists = (await api.lists.all()).lists;
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  $effect(() => {
    load();
  });
  function openCreate() {
    editing = null;
    name = '';
    description = '';
    modal = true;
  }
  function openEdit(l: ListSummary, e: Event) {
    e.preventDefault();
    editing = l;
    name = l.name;
    description = l.description || '';
    modal = true;
  }
  async function save(e: Event) {
    e.preventDefault();
    busy = true;
    try {
      if (editing) await api.lists.update(editing.id, { name, description });
      else await api.lists.create(name, description);
      modal = false;
      toast.success(editing ? 'List updated' : 'List created');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      busy = false;
    }
  }
  async function remove(l: ListSummary, e: Event) {
    e.preventDefault();
    if (!(await confirm.ask({ title: `Delete “${l.name}”?`, message: 'The list is removed. Titles in it stay in your library.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.lists.remove(l.id);
      lists = lists?.filter((x) => x.id !== l.id) ?? null;
      toast.success('List deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  }
</script>

<div class="page">
  <div class="page-head animate-rise">
    <div><h1>Lists</h1><p class="sub">Your own collections, in your own order.</p></div>
    <button class="btn btn-primary" onclick={openCreate}><Plus size={16} /> New list</button>
  </div>

  {#if lists === null}
    <div class="grid">{#each [1, 2, 3] as _}<div class="skeleton sk"></div>{/each}</div>
  {:else if !lists.length}
    <EmptyState title="No lists yet" text="Group titles however you like: a marathon, favourites by year, things to show a friend.">
      {#snippet icon()}<ListVideo size={26} />{/snippet}
      <button class="btn btn-primary" onclick={openCreate}><Plus size={16} /> Create your first list</button>
    </EmptyState>
  {:else}
    <div class="grid">
      {#each lists as l, i (l.id)}
        <a class="list card animate-rise" href="/lists/{l.id}" style:animation-delay="{i * 40}ms">
          <div class="stack">
            {#each [0, 1, 2, 3] as k}
              <div class="p" style:background-image={l.posters[k] ? `url(${img(l.posters[k], 'w185')})` : undefined}></div>
            {/each}
          </div>
          <div class="body">
            <div class="name truncate">{l.name}</div>
            {#if l.description}<div class="desc clamp-2 muted">{l.description}</div>{/if}
            <div class="meta faint">{l.item_count} title{l.item_count === 1 ? '' : 's'} · updated {relTime(l.updated_at)}</div>
          </div>
          <div class="acts">
            <button class="icon-btn icon-btn-sm" onclick={(e) => openEdit(l, e)} aria-label="Edit"><Pencil size={15} /></button>
            <button class="icon-btn icon-btn-sm" onclick={(e) => remove(l, e)} aria-label="Delete"><Trash2 size={15} /></button>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<Modal bind:open={modal} title={editing ? 'Edit list' : 'New list'} size="sm">
  <form onsubmit={save} id="list-form">
    <label class="field-label" for="ln">Name</label>
    <input id="ln" class="input" bind:value={name} required maxlength="100" placeholder="Weekend binge" />
    <label class="field-label mt" for="ld">Description</label>
    <textarea id="ld" class="textarea" bind:value={description} maxlength="1000" placeholder="Optional"></textarea>
  </form>
  {#snippet footer()}
    <button class="btn btn-secondary" onclick={() => (modal = false)}>Cancel</button>
    <button class="btn btn-primary" form="list-form" disabled={busy || !name.trim()}>{#if busy}<Loader2 size={16} class="spin" />{/if} {editing ? 'Save' : 'Create'}</button>
  {/snippet}
</Modal>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: 0.875rem; }
  .sk { height: 7rem; border-radius: var(--radius-lg); }
  .list { display: flex; gap: 0.875rem; padding: 0.75rem; position: relative; transition: transform var(--dur-2) var(--ease-spring), box-shadow var(--dur-2) var(--ease); }
  .list:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .stack { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; width: 4.5rem; aspect-ratio: 2/3; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: rgb(var(--c-subtle)); }
  .p { background: rgb(var(--c-subtle)) center / cover; }
  .body { flex: 1; min-width: 0; padding-right: 3.5rem; }
  .name { font-weight: 700; font-size: 0.9375rem; }
  .desc { font-size: 0.8125rem; margin-top: 0.15rem; }
  .meta { font-size: 0.75rem; margin-top: 0.35rem; }
  .acts { position: absolute; top: 0.6rem; right: 0.6rem; display: flex; gap: 0.15rem; opacity: 0; transition: opacity var(--dur-2); }
  .list:hover .acts, .list:focus-within .acts { opacity: 1; }
  @media (hover: none) { .acts { opacity: 1; } }
  .mt { margin-top: 0.75rem; }
</style>
