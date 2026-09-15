<script lang="ts">
  import { User, ShieldCheck, Palette, Database, AlertTriangle, Sun, Moon, Monitor, Loader2, Download, Globe, Users, Lock, EyeOff, Check } from '@lucide/svelte';
  import { api, type Privacy, type TitleLanguage } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';
  import { theme, type ThemePref } from '../lib/theme.svelte';
  import { toast } from '../lib/toast.svelte';
  import { confirm } from '../lib/confirm.svelte';
  import ImportPanel from '../components/ImportPanel.svelte';

  let { tab }: { tab: string } = $props();
  const tabs = [
    { key: 'account', label: 'Account', icon: User },
    { key: 'privacy', label: 'Privacy', icon: ShieldCheck },
    { key: 'preferences', label: 'Preferences', icon: Palette },
    { key: 'data', label: 'Import & export', icon: Database },
    { key: 'danger', label: 'Danger zone', icon: AlertTriangle },
  ];
  const u = $derived(auth.user!);
  let email = $state('');
  let cur = $state('');
  let next = $state('');
  let confirmPw = $state('');
  let busy = $state(false);
  $effect(() => {
    email = u.email;
  });

  async function patch(p: Parameters<typeof api.auth.update>[0], msg = 'Saved') {
    try {
      auth.apply(await api.auth.update(p));
      toast.success(msg);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function changePassword(e: Event) {
    e.preventDefault();
    if (next !== confirmPw) return toast.error('New passwords do not match.');
    busy = true;
    try {
      await api.auth.password(cur, next);
      toast.success('Password changed');
      cur = next = confirmPw = '';
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      busy = false;
    }
  }
  async function deleteAccount() {
    const pw = await confirm.prompt({ title: 'Delete your account?', message: 'Everything you tracked, rated and wrote is permanently removed. Enter your password to confirm.', confirmLabel: 'Delete forever', danger: true, input: { label: 'Password', type: 'password' } });
    if (!pw) return;
    try {
      await api.auth.deleteAccount(pw);
      auth.user = null;
      router.go('/login');
      toast.info('Account deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  const privacyOptions: { v: Privacy; label: string; desc: string; icon: any }[] = [
    { v: 'public', label: 'Public', desc: 'Anyone with the link can see your profile and completed titles.', icon: Globe },
    { v: 'friends_only', label: 'Friends only', desc: 'Only accepted friends can see your profile.', icon: Users },
    { v: 'users_only', label: 'Signed-in users', desc: 'Anyone with a WatchRadar account.', icon: Lock },
    { v: 'private', label: 'Private', desc: 'Nobody but you.', icon: EyeOff },
  ];
  const langs: { v: TitleLanguage; label: string; desc: string }[] = [
    { v: 'en', label: 'English', desc: 'TMDB’s main title' },
    { v: 'original', label: 'Original', desc: 'Romaji for anime, native titles elsewhere' },
    { v: 'ja', label: 'Japanese', desc: 'Japanese title when available' },
  ];
  const themes: { v: ThemePref; label: string; icon: any }[] = [
    { v: 'system', label: 'System', icon: Monitor },
    { v: 'light', label: 'Light', icon: Sun },
    { v: 'dark', label: 'Dark', icon: Moon },
  ];
</script>

<div class="page settings">
  <div class="page-head animate-rise"><div><h1>Settings</h1></div></div>
  <div class="layout">
    <nav class="tabs animate-rise">
      {#each tabs as t}<a class="tab" data-active={tab === t.key} href="/settings/{t.key}"><t.icon size={16} /> {t.label}</a>{/each}
    </nav>
    <div class="content">
      {#key tab}
        {#if tab === 'account'}
          <section class="card card-pad animate-rise">
            <h2>Account</h2>
            <p class="muted">Signed in as <b>{u.username}</b>.</p>
            <form class="frm" onsubmit={(e) => { e.preventDefault(); if (email !== u.email) patch({ email }, 'Email updated'); }}>
              <label class="field-label" for="em">Email</label>
              <div class="inline"><input id="em" class="input" type="email" bind:value={email} /><button class="btn btn-secondary" disabled={email === u.email}>Save</button></div>
            </form>
          </section>
          <section class="card card-pad animate-rise">
            <h2>Password</h2>
            <form class="frm" onsubmit={changePassword}>
              <label class="field-label" for="cp">Current password</label><input id="cp" class="input" type="password" bind:value={cur} autocomplete="current-password" required />
              <label class="field-label" for="np">New password</label><input id="np" class="input" type="password" bind:value={next} autocomplete="new-password" required minlength="8" />
              <label class="field-label" for="np2">Confirm new password</label><input id="np2" class="input" type="password" bind:value={confirmPw} autocomplete="new-password" required />
              <div><button class="btn btn-primary" disabled={busy}>{#if busy}<Loader2 size={16} class="spin" />{/if} Change password</button></div>
            </form>
          </section>
          <section class="card card-pad animate-rise">
            <h2>Sessions</h2>
            <p class="muted">Signed in on another device you no longer use? Sign out everywhere.</p>
            <button class="btn btn-secondary" onclick={async () => { await api.auth.logoutAll(); auth.user = null; router.go('/login'); }}>Sign out of all devices</button>
          </section>
        {:else if tab === 'privacy'}
          <section class="card card-pad animate-rise">
            <h2>Profile visibility</h2>
            <p class="muted">Your profile lives at <a class="link" href="/u/{encodeURIComponent(u.username)}">/u/{u.username}</a>. Individual titles can also be marked private from their page.</p>
            <div class="opts">
              {#each privacyOptions as o}
                <button class="opt" data-active={u.profile_privacy === o.v} onclick={() => patch({ profile_privacy: o.v }, 'Privacy updated')}>
                  <o.icon size={18} /><div><b>{o.label}</b><span class="faint">{o.desc}</span></div>{#if u.profile_privacy === o.v}<Check size={16} class="tick" />{/if}
                </button>
              {/each}
            </div>
          </section>
        {:else if tab === 'preferences'}
          <section class="card card-pad animate-rise">
            <h2>Appearance</h2>
            <div class="seg">{#each themes as t}<button class="seg-item" data-active={theme.pref === t.v} onclick={() => theme.set(t.v)}><t.icon size={14} /> {t.label}</button>{/each}</div>
          </section>
          <section class="card card-pad animate-rise">
            <h2>Title language</h2>
            <div class="opts">
              {#each langs as l}
                <button class="opt" data-active={u.title_language === l.v} onclick={() => patch({ title_language: l.v }, 'Title language updated')}><div><b>{l.label}</b><span class="faint">{l.desc}</span></div>{#if u.title_language === l.v}<Check size={16} class="tick" />{/if}</button>
              {/each}
            </div>
          </section>
          <section class="card card-pad animate-rise">
            <h2>Automation</h2>
            <label class="toggle-row">
              <div><b>Resume completed series when new episodes air</b><span class="faint">Moves the show back to Watching and picks up where you left off. You get a notification either way.</span></div>
              <input type="checkbox" class="toggle" checked={u.auto_resume} onchange={(e) => patch({ auto_resume: (e.target as HTMLInputElement).checked })} />
            </label>
            <label class="toggle-row">
              <div><b>Remove titles from lists when completed</b><span class="faint">Handy for “to watch” style lists.</span></div>
              <input type="checkbox" class="toggle" checked={u.auto_remove_from_lists} onchange={(e) => patch({ auto_remove_from_lists: (e.target as HTMLInputElement).checked })} />
            </label>
          </section>
        {:else if tab === 'data'}
          <section class="card card-pad animate-rise">
            <h2>Import</h2>
            <p class="muted">Bring your history over from MyAnimeList or Watcharr. Entries are matched against TMDB; when several titles match you get to pick. Already-tracked titles are skipped.</p>
            <ImportPanel />
          </section>
          <section class="card card-pad animate-rise">
            <h2>Export</h2>
            <p class="muted">A JSON file with every title, status, rating, viewing, cut, review and list. Yours to keep.</p>
            <a class="btn btn-secondary" href={api.library.exportUrl} download><Download size={16} /> Download export</a>
          </section>
        {:else if tab === 'danger'}
          <section class="card card-pad animate-rise danger">
            <h2>Delete account</h2>
            <p class="muted">Permanently deletes your account and everything in it.</p>
            <button class="btn btn-danger" onclick={deleteAccount}>Delete my account</button>
          </section>
        {/if}
      {/key}
    </div>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  @media (min-width: 800px) { .layout { grid-template-columns: 13rem 1fr; align-items: start; } }
  .tabs { display: flex; gap: 0.25rem; overflow-x: auto; scrollbar-width: none; }
  @media (min-width: 800px) { .tabs { flex-direction: column; position: sticky; top: 1rem; } }
  .tab { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0 0.875rem; height: 2.375rem; border-radius: var(--radius-sm); font-weight: 600; color: rgb(var(--c-text-2)); white-space: nowrap; transition: all var(--dur-2); }
  .tab:hover { background: rgb(var(--c-subtle)); color: rgb(var(--c-text-1)); }
  .tab[data-active='true'] { background: rgb(var(--c-brand) / 0.12); color: rgb(var(--c-brand)); }
  .content { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
  section h2 { font-size: 1.0625rem; margin-bottom: 0.5rem; }
  section p { margin-bottom: 0.875rem; }
  .frm { display: flex; flex-direction: column; gap: 0.25rem; max-width: 26rem; }
  .frm .input { margin-bottom: 0.5rem; }
  .inline { display: flex; gap: 0.5rem; }
  .opts { display: flex; flex-direction: column; gap: 0.375rem; }
  .opt { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0.875rem; border-radius: var(--radius-md); border: 1px solid rgb(var(--c-border)); text-align: left; transition: all var(--dur-2); }
  .opt div { flex: 1; display: flex; flex-direction: column; line-height: 1.3; }
  .opt:hover { border-color: rgb(var(--c-border-strong)); background: rgb(var(--c-subtle)); }
  .opt[data-active='true'] { border-color: rgb(var(--c-brand)); background: rgb(var(--c-brand) / 0.06); }
  .opt :global(.tick) { color: rgb(var(--c-brand)); }
  .toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem 0; cursor: pointer; }
  .toggle-row + .toggle-row { border-top: 1px solid rgb(var(--c-border)); }
  .toggle-row div { display: flex; flex-direction: column; line-height: 1.3; }
  .toggle { appearance: none; width: 2.75rem; height: 1.625rem; border-radius: 999px; background: rgb(var(--c-border-strong)); position: relative; cursor: pointer; flex-shrink: 0; transition: background-color var(--dur-2); }
  .toggle::after { content: ''; position: absolute; top: 0.2rem; left: 0.2rem; width: 1.25rem; height: 1.25rem; border-radius: 999px; background: #fff; box-shadow: var(--shadow-sm); transition: transform var(--dur-2) var(--ease-spring); }
  .toggle:checked { background: rgb(var(--c-brand)); }
  .toggle:checked::after { transform: translateX(1.125rem); }
  .danger { border-color: rgb(var(--c-danger) / 0.4); }
</style>
