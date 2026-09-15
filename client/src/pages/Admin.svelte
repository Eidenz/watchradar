<script lang="ts">
  import { Shield, RefreshCw, Trash2, Loader2, Users, Database, Activity } from '@lucide/svelte';
  import { api } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { toast } from '../lib/toast.svelte';
  import { confirm } from '../lib/confirm.svelte';
  import { dateText, relTime } from '../lib/format';
  import StatTile from '../components/StatTile.svelte';
  import Pagination from '../components/Pagination.svelte';

  let overview = $state<any>(null);
  let users = $state<any[]>([]);
  let page = $state(1);
  let pages = $state(1);
  let running = $state(false);

  async function load() {
    try {
      overview = await api.admin.overview();
      const u = await api.admin.users(page);
      users = u.users;
      pages = u.pages;
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  $effect(() => {
    load();
  });
  async function run(force: boolean) {
    running = true;
    try {
      const r = await api.admin.runScheduler(force);
      toast.success(r.skipped ? 'Scheduler is already running' : `Synced ${r.synced} titles, ${r.changed} changed, ${r.notifications} notifications`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      running = false;
    }
  }
  async function toggleAdmin(u: any) {
    try {
      await api.admin.setAdmin(u.id, !u.is_admin);
      u.is_admin = !u.is_admin;
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function del(u: any) {
    if (!(await confirm.ask({ title: `Delete ${u.username}?`, message: 'Removes the account and everything they tracked. This cannot be undone.', confirmLabel: 'Delete user', danger: true }))) return;
    try {
      await api.admin.deleteUser(u.id);
      users = users.filter((x) => x.id !== u.id);
      toast.success('User deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  }
</script>

<div class="page">
  <div class="page-head animate-rise"><div><h1><Shield size={22} /> Admin</h1><p class="sub">Server overview and users.</p></div></div>
  {#if overview}
    <div class="tiles">
      <StatTile label="Users" value={overview.users}>{#snippet icon()}<Users size={18} />{/snippet}</StatTile>
      <StatTile label="Titles cached" value={overview.titles} delay={40}>{#snippet icon()}<Database size={18} />{/snippet}</StatTile>
      <StatTile label="Tracked entries" value={overview.tracked} delay={80}>{#snippet icon()}<Activity size={18} />{/snippet}</StatTile>
      <StatTile label="Viewings recorded" value={overview.events.toLocaleString()} delay={120}>{#snippet icon()}<Activity size={18} />{/snippet}</StatTile>
    </div>
    <section class="card card-pad animate-rise sched">
      <div class="section-head"><h2><RefreshCw size={18} /> TMDB sync</h2>
        <div class="acts">
          <button class="btn btn-sm btn-secondary" onclick={() => run(false)} disabled={running}>{#if running}<Loader2 size={14} class="spin" />{/if} Sync due titles</button>
          <button class="btn btn-sm btn-ghost" onclick={() => run(true)} disabled={running}>Force a batch</button>
        </div>
      </div>
      {#if overview.scheduler}
        <p class="muted">Runs every {overview.scheduler.interval_minutes} min, up to {overview.scheduler.batch} titles per tick · {overview.scheduler.due} due now{overview.scheduler.running ? ' · running…' : ''}</p>
        {#if overview.scheduler.last}
          {@const l = overview.scheduler.last}
          <p class="faint">Last run {relTime(l.finished)}: synced {l.synced}, changed {l.changed}, notifications {l.notifications}, resumed {l.resumed}, errors {l.errors}</p>
        {/if}
      {/if}
      {#if overview.legacy_import}
        <p class="faint">Legacy import on {dateText(overview.legacy_import.at)}: {Object.entries(overview.legacy_import.report).map(([k, v]) => `${k} ${v}`).join(', ')}</p>
      {/if}
    </section>
  {/if}
  <section class="card animate-rise">
    <table>
      <thead><tr><th>User</th><th>Email</th><th>Tracked</th><th>Joined</th><th>Last seen</th><th></th></tr></thead>
      <tbody>
        {#each users as u (u.id)}
          <tr>
            <td><a class="link" href="/u/{encodeURIComponent(u.username)}">{u.username}</a>{#if u.is_admin}<span class="pill pill-brand adm">admin</span>{/if}</td>
            <td class="muted">{u.email}</td>
            <td>{u.tracked}</td>
            <td class="muted">{dateText(u.created_at)}</td>
            <td class="muted">{u.last_seen ? relTime(u.last_seen) : '—'}</td>
            <td class="row-acts">
              {#if u.id !== auth.user?.id}
                <button class="btn btn-xs btn-ghost" onclick={() => toggleAdmin(u)}>{u.is_admin ? 'Revoke admin' : 'Make admin'}</button>
                <button class="icon-btn icon-btn-sm" onclick={() => del(u)} aria-label="Delete"><Trash2 size={14} /></button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="pg"><Pagination {page} {pages} onchange={(p) => { page = p; load(); }} /></div>
  </section>
</div>

<style>
  h1 { display: flex; align-items: center; gap: 0.5rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
  .sched { margin-bottom: 1rem; }
  .acts { display: flex; gap: 0.35rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  th { text-align: left; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; color: rgb(var(--c-text-3)); padding: 0.75rem 1rem; border-bottom: 1px solid rgb(var(--c-border)); }
  td { padding: 0.625rem 1rem; border-bottom: 1px solid rgb(var(--c-border)); }
  .adm { margin-left: 0.4rem; }
  .row-acts { text-align: right; white-space: nowrap; }
  .pg { padding: 0 1rem 1rem; }
  @media (max-width: 700px) { th:nth-child(2), td:nth-child(2), th:nth-child(5), td:nth-child(5) { display: none; } }
</style>
