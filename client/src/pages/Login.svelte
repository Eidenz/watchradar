<script lang="ts">
  import { LogIn, Loader2, User, Lock } from '@lucide/svelte';
  import AuthLayout from '../components/AuthLayout.svelte';
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

<AuthLayout title="Welcome back" subtitle="Sign in to pick up where you left off.">
  {#if cfg?.first_run}
    <div class="note">No accounts yet — <a class="link" href="/register">create the first one</a>, it becomes the admin.</div>
  {/if}
  <form onsubmit={submit}>
    <label class="field-label" for="login">Username or email</label>
    <div class="field"><User size={16} class="fic" /><input id="login" class="input" bind:value={login} autocomplete="username" required /></div>
    <label class="field-label" for="pw">Password</label>
    <div class="field"><Lock size={16} class="fic" /><input id="pw" class="input" type="password" bind:value={password} autocomplete="current-password" required /></div>
    {#if error}<div class="err">{error}</div>{/if}
    <button class="btn btn-primary btn-lg btn-full" disabled={busy}>{#if busy}<Loader2 size={18} class="spin" />{:else}<LogIn size={18} />{/if} Sign in</button>
  </form>
  {#snippet footer()}
    {#if cfg?.registration_open ?? true}New here? <a class="link" href="/register">Create an account</a>{:else}Registration is closed on this server.{/if}
  {/snippet}
</AuthLayout>
