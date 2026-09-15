<script lang="ts">
  import { LogIn, Loader2 } from '@lucide/svelte';
  import Logo from '../components/Logo.svelte';
  import { api } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';

  let login = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');
  let cfg = $state<{ registration_open: boolean; first_run: boolean; tmdb_configured: boolean } | null>(null);
  $effect(() => {
    api.auth.config().then((c) => (cfg = c)).catch(() => {});
  });
  const next = $derived(router.query.get('next') || '/');

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      auth.apply(await api.auth.login(login, password));
      router.go(next.startsWith('/') ? next : '/');
    } catch (err: any) {
      error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

<div class="auth-page">
  <div class="panel card animate-rise">
    <div class="brand"><Logo size={44} /><div><h1>Watch<span>Radar</span></h1><p class="muted">Welcome back.</p></div></div>
    {#if cfg?.first_run}
      <div class="note">No accounts yet — <a class="link" href="/register">create the first one</a>, it becomes the admin.</div>
    {/if}
    <form onsubmit={submit}>
      <label class="field-label" for="login">Username or email</label>
      <input id="login" class="input" bind:value={login} autocomplete="username" required />
      <label class="field-label" for="pw">Password</label>
      <input id="pw" class="input" type="password" bind:value={password} autocomplete="current-password" required />
      {#if error}<div class="err">{error}</div>{/if}
      <button class="btn btn-primary btn-lg btn-full" disabled={busy}>{#if busy}<Loader2 size={18} class="spin" />{:else}<LogIn size={18} />{/if} Sign in</button>
    </form>
    {#if cfg?.registration_open ?? true}
      <p class="alt muted">New here? <a class="link" href="/register">Create an account</a></p>
    {/if}
  </div>
</div>

<style>
  :global(.auth-page) { min-height: 100dvh; display: grid; place-items: center; padding: 1.5rem 1rem; }
  :global(.auth-page .panel) { width: 100%; max-width: 24rem; padding: 1.75rem; }
  :global(.auth-page .brand) { display: flex; align-items: center; gap: 0.875rem; margin-bottom: 1.5rem; }
  :global(.auth-page h1) { font-size: 1.375rem; letter-spacing: -0.02em; }
  :global(.auth-page h1 span) { color: rgb(var(--c-brand)); }
  :global(.auth-page form) { display: flex; flex-direction: column; }
  :global(.auth-page form .input) { margin-bottom: 0.875rem; }
  :global(.auth-page form .btn) { margin-top: 0.25rem; }
  :global(.auth-page .err) { color: rgb(var(--c-danger)); font-size: 0.8125rem; margin: -0.25rem 0 0.75rem; }
  :global(.auth-page .alt) { text-align: center; margin-top: 1.25rem; font-size: 0.8125rem; }
  :global(.auth-page .note) { background: rgb(var(--c-brand) / 0.1); color: rgb(var(--c-brand)); padding: 0.625rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.8125rem; margin-bottom: 1rem; }
</style>
