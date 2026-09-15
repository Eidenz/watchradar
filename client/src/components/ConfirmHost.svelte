<script lang="ts">
  import Modal from './Modal.svelte';
  import { confirm } from '../lib/confirm.svelte';

  let value = $state('');
  const c = $derived(confirm.current);
  $effect(() => {
    if (c) value = '';
  });
  function ok() {
    if (!c) return;
    confirm.settle(c.input ? value : true);
  }
  function cancel() {
    if (!c) return;
    confirm.settle(c.input ? null : false);
  }
</script>

{#if c}
  <Modal open={true} title={c.title} size="sm" onclose={cancel}>
    {#if c.message}<p class="muted msg">{c.message}</p>{/if}
    {#if c.input}
      <form onsubmit={(e) => { e.preventDefault(); ok(); }}>
        <label class="field-label" for="confirm-input">{c.input.label}</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input id="confirm-input" class="input" type={c.input.type || 'text'} placeholder={c.input.placeholder} bind:value autofocus autocomplete={c.input.type === 'password' ? 'current-password' : 'off'} />
      </form>
    {/if}
    {#snippet footer()}
      <button class="btn btn-secondary" onclick={cancel}>{c.cancelLabel || 'Cancel'}</button>
      <button class="btn {c.danger ? 'btn-danger' : 'btn-primary'}" onclick={ok} disabled={!!c.input && !value}>{c.confirmLabel || 'Confirm'}</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .msg { white-space: pre-line; margin-bottom: 0.75rem; }
</style>
