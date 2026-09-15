<script lang="ts">
  // Episode list for one season: watched toggles, per-episode rewatch counter, bulk actions, cuts.
  import { Check, Repeat, Scissors, ChevronDown, MoreHorizontal, CalendarClock, Undo2, ListChecks, Eraser, Trash2, Plus } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import Modal from './Modal.svelte';
  import { api, type EpisodeState, type SeasonState, type TitleView } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { confirm } from '../lib/confirm.svelte';
  import { dateText, airsIn } from '../lib/format';

  interface Props {
    view: TitleView;
    season: SeasonState;
    onview: (v: TitleView) => void;
  }
  let { view, season, onview }: Props = $props();
  const mediaId = $derived(view.media.id!);
  let episodes = $state<EpisodeState[] | null>(null);
  let part = $state(0); // 0 = all parts
  let expanded = $state<number | null>(null);
  let menuFor = $state<number | null>(null);
  let cutModal = $state(false);
  let cutAfter = $state(1);
  let busy = $state(false);
  let seq = 0;

  async function load() {
    const my = ++seq;
    try {
      const r = await api.media.season(mediaId, season.season_number);
      if (my === seq) episodes = r.episodes;
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  $effect(() => {
    void season.season_number;
    void view.tracking?.active_run;
    void view.tracking?.watch_count;
    part = 0;
    load();
  });
  const tracked = $derived(!!view.tracking);
  const shown = $derived(episodes?.filter((e) => !part || e.part_index === part) ?? []);
  const parts = $derived(season.parts.length > 1 ? season.parts : []);

  async function run(fn: () => Promise<TitleView>, msg?: string) {
    busy = true;
    try {
      const v = await fn();
      onview(v);
      if (v.completed) toast.success('Series completed! 🎉');
      else if (msg) toast.success(msg);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      busy = false;
    }
  }
  const toggle = (ep: EpisodeState) => run(() => api.media.episode(mediaId, ep.season_number, ep.episode_number, !ep.watched));
  const upTo = (ep: EpisodeState) => run(() => api.media.mark(mediaId, { season: ep.season_number, episode: ep.episode_number, mode: 'up_to' }), 'Marked everything up to here');
  const markSeason = () => run(() => api.media.mark(mediaId, { season: season.season_number, mode: 'season' }), 'Season marked as watched');
  const markPart = (p: (typeof parts)[number]) => run(() => api.media.mark(mediaId, { season: season.season_number, episode: p.end, mode: 'season' }), `${p.label} marked as watched`);
  async function unmarkSeason() {
    if (await confirm.ask({ title: `Unmark ${season.name}?`, message: 'Removes this season from your current play-through. Earlier play-throughs are untouched.', confirmLabel: 'Unmark', danger: true }))
      run(() => api.media.unmarkSeason(mediaId, season.season_number), 'Season unmarked');
  }
  async function rewatch(ep: EpisodeState, undo = false) {
    try {
      const r = await api.media.rewatchEpisode(mediaId, ep.season_number, ep.episode_number, undo);
      ep.play_count = r.play_count;
      if (!undo) toast.success(`Logged another viewing of ${ep.title || `episode ${ep.episode_number}`}`, { label: 'Undo', run: () => rewatch(ep, true) });
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function addCut() {
    cutModal = false;
    await run(() => api.media.addCut(mediaId, season.season_number, cutAfter), `Season cut after episode ${cutAfter}`);
  }
  const removeCut = (id: number) => run(() => api.media.removeCut(mediaId, id), 'Cut removed');
</script>

<div class="panel">
  <div class="bar">
    {#if parts.length}
      <div class="seg">
        <button class="seg-item" data-active={part === 0} onclick={() => (part = 0)}>All</button>
        {#each parts as p}<button class="seg-item" data-active={part === p.index} onclick={() => (part = p.index)}>{p.label} <span class="faint">{p.watched}/{p.aired}</span></button>{/each}
      </div>
    {:else}
      <span class="muted count">{season.watched}/{season.aired} watched{season.episode_count > season.aired ? ` · ${season.episode_count - season.aired} upcoming` : ''}</span>
    {/if}
    {#if tracked}
      <div class="acts">
        {#if part && parts.length}
          {@const p = parts.find((x) => x.index === part)}
          {#if p}<button class="btn btn-sm btn-secondary" onclick={() => markPart(p)} disabled={busy}><ListChecks size={14} /> Mark {p.label}</button>{/if}
        {:else}
          <button class="btn btn-sm btn-secondary" onclick={markSeason} disabled={busy || season.watched === season.aired}><ListChecks size={14} /> Mark season</button>
        {/if}
        <button class="btn btn-sm btn-ghost" onclick={unmarkSeason} disabled={busy || !season.watched} title="Unmark season"><Eraser size={14} /></button>
        {#if season.season_number > 0 && season.episode_count > 1}
          <button class="btn btn-sm btn-ghost" onclick={() => { cutAfter = Math.max(1, Math.min(season.episode_count - 1, Math.round(season.episode_count / 2))); cutModal = true; }} title="Cut this season into parts"><Scissors size={14} /> Cut</button>
        {/if}
      </div>
    {/if}
  </div>

  {#if episodes === null}
    <div class="rows">{#each [1, 2, 3, 4] as _}<div class="skeleton sk"></div>{/each}</div>
  {:else}
    <div class="rows">
      {#each shown as ep, i (ep.episode_number)}
        {#if parts.length && !part && ep.display_number === 1 && ep.part_index > 1}
          <div class="part-sep"><Scissors size={12} /> {parts[ep.part_index - 1]?.label}</div>
        {/if}
        <div class="ep" class:watched={ep.watched} class:future={!ep.aired} style:animation-delay="{Math.min(i, 15) * 20}ms">
          {#if tracked}
            <button class="check" data-on={ep.watched} onclick={() => toggle(ep)} disabled={busy || !ep.aired} aria-label={ep.watched ? 'Mark unwatched' : 'Mark watched'} title={!ep.aired ? 'Not aired yet' : ''}>
              {#if ep.watched}<Check size={15} />{/if}
            </button>
          {/if}
          <button class="num" onclick={() => (expanded = expanded === ep.episode_number ? null : ep.episode_number)} title={ep.display_number !== ep.episode_number ? `Episode ${ep.episode_number} overall` : ''}>{ep.display_number}</button>
          <button class="main" onclick={() => (expanded = expanded === ep.episode_number ? null : ep.episode_number)}>
            <span class="title truncate">{ep.title || `Episode ${ep.episode_number}`}</span>
            <span class="meta faint">
              {#if !ep.aired && ep.air_date}<span class="pill pill-brand"><CalendarClock size={11} /> {airsIn(ep.air_date)}</span>{:else if ep.air_date}{dateText(ep.air_date)}{:else}TBA{/if}
              {#if ep.runtime}· {ep.runtime} min{/if}
            </span>
          </button>
          {#if tracked && ep.play_count > 0}
            <button class="plays" title="Watched {ep.play_count} time{ep.play_count === 1 ? '' : 's'} — click to log another viewing" onclick={() => rewatch(ep)}><Repeat size={12} /> {ep.play_count}</button>
          {/if}
          {#if tracked}
            <div class="menuwrap">
              <button class="icon-btn icon-btn-sm" onclick={() => (menuFor = menuFor === ep.episode_number ? null : ep.episode_number)} aria-label="More"><MoreHorizontal size={16} /></button>
              {#if menuFor === ep.episode_number}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="scrim" role="presentation" onclick={() => (menuFor = null)}></div>
                <div class="menu animate-rise">
                  <button class="mi" onclick={() => { menuFor = null; upTo(ep); }} disabled={!ep.aired}><ListChecks size={14} /> Mark up to here</button>
                  <button class="mi" onclick={() => { menuFor = null; rewatch(ep); }}><Plus size={14} /> Log another viewing</button>
                  {#if ep.play_count > (ep.watched ? 1 : 0)}<button class="mi" onclick={() => { menuFor = null; rewatch(ep, true); }}><Undo2 size={14} /> Remove last extra viewing</button>{/if}
                </div>
              {/if}
            </div>
          {/if}
          <span class="chev" class:open={expanded === ep.episode_number}><ChevronDown size={14} /></span>
        </div>
        {#if expanded === ep.episode_number}
          <div class="detail" transition:slide={{ duration: 180 }}>
            <p class="muted">{ep.overview || 'No description for this episode.'}</p>
            {#if ep.last_watched_at}<p class="faint small">Last watched {dateText(ep.last_watched_at)}</p>{/if}
          </div>
        {/if}
      {/each}
      {#if !shown.length}<p class="faint">No episodes listed.</p>{/if}
    </div>
  {/if}
</div>

<Modal bind:open={cutModal} title="Cut {season.name} into parts" size="sm">
  <p class="muted">Split a long season (a two-cour anime, a season released in halves…) into parts. Progress and “next episode” follow the parts; episodes get renumbered inside each part.</p>
  {#if season.cuts.length}
    <div class="cuts">
      {#each season.cuts as c (c.id)}
        <div class="cut"><span>After episode <b>{c.after_episode}</b></span><button class="icon-btn icon-btn-sm" onclick={() => removeCut(c.id)} aria-label="Remove cut"><Trash2 size={14} /></button></div>
      {/each}
    </div>
  {/if}
  <label class="field-label mt" for="cut">New cut after episode</label>
  <div class="cutrow">
    <input id="cut" type="range" min="1" max={season.episode_count - 1} bind:value={cutAfter} />
    <input class="input num-in" type="number" min="1" max={season.episode_count - 1} bind:value={cutAfter} />
  </div>
  <p class="faint small">Episodes 1–{cutAfter} · then {cutAfter + 1}–{season.episode_count}</p>
  {#snippet footer()}
    <button class="btn btn-secondary" onclick={() => (cutModal = false)}>Close</button>
    <button class="btn btn-primary" onclick={addCut} disabled={cutAfter < 1 || cutAfter >= season.episode_count}><Scissors size={15} /> Add cut</button>
  {/snippet}
</Modal>

<style>
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .count { font-size: 0.8125rem; }
  .acts { display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .rows { display: flex; flex-direction: column; gap: 0.25rem; }
  .sk { height: 3.25rem; }
  .part-sep { display: flex; align-items: center; gap: 0.4rem; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgb(var(--c-text-3)); padding: 0.75rem 0.25rem 0.25rem; }
  .ep { position: relative; display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem 0.4rem 0.5rem; border-radius: var(--radius-sm); background: rgb(var(--c-surface)); border: 1px solid rgb(var(--c-border)); animation: rise var(--dur-3) var(--ease-out) both; transition: border-color var(--dur-2), background-color var(--dur-2); }
  .ep:hover { border-color: rgb(var(--c-border-strong)); }
  .ep:has(.menu) { z-index: 30; }
  .ep.watched { background: rgb(var(--c-brand) / 0.05); }
  .ep.future { opacity: 0.7; }
  .check { width: 1.5rem; height: 1.5rem; border-radius: 0.45rem; border: 1.5px solid rgb(var(--c-border-strong)); display: grid; place-items: center; color: rgb(var(--c-on-brand)); flex-shrink: 0; transition: all var(--dur-2) var(--ease-spring); }
  .check:hover:not(:disabled) { border-color: rgb(var(--c-brand)); transform: scale(1.08); }
  .check[data-on='true'] { background: rgb(var(--c-brand)); border-color: rgb(var(--c-brand)); }
  .check:disabled { opacity: 0.4; cursor: not-allowed; }
  .num { width: 2rem; height: 1.75rem; border-radius: 0.4rem; background: rgb(var(--c-subtle)); font-weight: 700; font-size: 0.75rem; color: rgb(var(--c-text-2)); flex-shrink: 0; }
  .watched .num { background: rgb(var(--c-brand) / 0.15); color: rgb(var(--c-brand)); }
  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: left; line-height: 1.25; }
  .title { font-weight: 600; font-size: 0.8438rem; }
  .meta { font-size: 0.6875rem; display: flex; gap: 0.3rem; align-items: center; }
  .meta .pill { padding: 0 0.4rem; font-size: 0.625rem; }
  .plays { display: inline-flex; align-items: center; gap: 0.25rem; height: 1.5rem; padding: 0 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 700; background: rgb(var(--c-signal) / 0.14); color: rgb(var(--c-signal)); transition: transform var(--dur-2) var(--ease-spring); }
  .plays:hover { transform: scale(1.08); }
  .menuwrap { position: relative; }
  .scrim { position: fixed; inset: 0; z-index: 20; }
  .menu { position: absolute; right: 0; top: calc(100% + 0.25rem); z-index: 21; background: rgb(var(--c-raised)); border: 1px solid rgb(var(--c-border)); border-radius: var(--radius-md); box-shadow: var(--shadow-pop); padding: 0.3rem; min-width: 14rem; }
  .mi { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.7rem; border-radius: 0.45rem; font-weight: 600; text-align: left; font-size: 0.8125rem; }
  .mi:hover { background: rgb(var(--c-subtle)); }
  .mi:disabled { opacity: 0.5; }
  .chev { color: rgb(var(--c-text-3)); transition: transform var(--dur-2); }
  .chev.open { transform: rotate(180deg); }
  .detail { padding: 0.25rem 0.75rem 0.75rem 3.75rem; font-size: 0.8125rem; }
  .small { font-size: 0.75rem; margin-top: 0.25rem; }
  .cuts { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.75rem; }
  .cut { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.6rem; background: rgb(var(--c-subtle)); border-radius: var(--radius-sm); font-size: 0.8125rem; }
  .mt { margin-top: 1rem; }
  .cutrow { display: flex; gap: 0.75rem; align-items: center; }
  .cutrow input[type='range'] { flex: 1; accent-color: rgb(var(--c-brand)); }
  .num-in { width: 4.5rem; }
</style>
