<script lang="ts">
  import { UserPlus, Loader2, User, Mail, Lock } from '@lucide/svelte';
  import AuthLayout from '../components/AuthLayout.svelte';
  import { api } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';

  let username = $state('');
  let email = $state('');
  let password = $state('');
  let confirm = $state('');
  let busy = $state(false);
  let error = $state('');

  async function submit(e: Event) {
    e.preventDefault();
    if (password !== confirm) return (error = 'Passwords do not match.');
    busy = true;
    error = '';
    try {
      auth.apply(await api.auth.register(username, email, password));
      router.go('/');
    } catch (err: any) {
      error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

<AuthLayout title="Create your account" subtitle="Start tracking what you watch.">
  <form onsubmit={submit}>
    <label class="field-label" for="u">Username</label>
    <div class="field"><User size={16} class="fic" /><input id="u" class="input" bind:value={username} autocomplete="username" required minlength="2" maxlength="32" /></div>
    <label class="field-label" for="e">Email</label>
    <div class="field"><Mail size={16} class="fic" /><input id="e" class="input" type="email" bind:value={email} autocomplete="email" required /></div>
    <label class="field-label" for="p">Password</label>
    <div class="field"><Lock size={16} class="fic" /><input id="p" class="input" type="password" bind:value={password} autocomplete="new-password" required minlength="8" /></div>
    <label class="field-label" for="c">Confirm password</label>
    <div class="field"><Lock size={16} class="fic" /><input id="c" class="input" type="password" bind:value={confirm} autocomplete="new-password" required /></div>
    {#if error}<div class="err">{error}</div>{/if}
    <button class="btn btn-primary btn-lg btn-full" disabled={busy}>{#if busy}<Loader2 size={18} class="spin" />{:else}<UserPlus size={18} />{/if} Create account</button>
  </form>
  {#snippet footer()}Already have one? <a class="link" href="/login">Sign in</a>{/snippet}
</AuthLayout>
