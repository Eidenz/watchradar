<script lang="ts">
  import { UserPlus, Loader2 } from '@lucide/svelte';
  import Logo from '../components/Logo.svelte';
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

<div class="auth-page">
  <div class="panel card animate-rise">
    <div class="brand"><Logo size={44} /><div><h1>Create account</h1><p class="muted">Start tracking what you watch.</p></div></div>
    <form onsubmit={submit}>
      <label class="field-label" for="u">Username</label>
      <input id="u" class="input" bind:value={username} autocomplete="username" required minlength="2" maxlength="32" />
      <label class="field-label" for="e">Email</label>
      <input id="e" class="input" type="email" bind:value={email} autocomplete="email" required />
      <label class="field-label" for="p">Password</label>
      <input id="p" class="input" type="password" bind:value={password} autocomplete="new-password" required minlength="8" />
      <label class="field-label" for="c">Confirm password</label>
      <input id="c" class="input" type="password" bind:value={confirm} autocomplete="new-password" required />
      {#if error}<div class="err">{error}</div>{/if}
      <button class="btn btn-primary btn-lg btn-full" disabled={busy}>{#if busy}<Loader2 size={18} class="spin" />{:else}<UserPlus size={18} />{/if} Create account</button>
    </form>
    <p class="alt muted">Already have one? <a class="link" href="/login">Sign in</a></p>
  </div>
</div>
