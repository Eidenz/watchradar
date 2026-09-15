<script lang="ts">
  import { Clock3, Tv, Film, Play, Star, Repeat, Trophy, BarChart3 } from '@lucide/svelte';
  import { api, type Stats } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { minutesToText, hours, TIERS } from '../lib/format';
  import StatTile from '../components/StatTile.svelte';
  import MediaCard from '../components/MediaCard.svelte';
  import AchievementBadge from '../components/AchievementBadge.svelte';
  import Rail from '../components/Rail.svelte';

  let s = $state<Stats | null>(null);
  let all = $state<{ id: string | number; name: string; description: string; icon: string; tier: number }[]>([]);
  $effect(() => {
    api.stats().then((r) => (s = r)).catch((e) => toast.error(e.message));
    api.achievements().then((r) => (all = r.achievements)).catch(() => {});
  });
  const maxMonth = $derived(Math.max(1, ...(s?.activity.map((a) => a.count) ?? [1])));
  const maxDow = $derived(Math.max(1, ...(s?.weekdays ?? [1])));
  const maxRating = $derived(Math.max(1, ...(s?.rating_distribution.map((r) => r.count) ?? [1])));
  const maxDecade = $derived(Math.max(1, ...(s?.decades.map((d) => d.count) ?? [1])));
  const earned = $derived(new Set(s?.achievements.map((a) => a.id) ?? []));
  const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' });
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="page">
  <div class="page-head animate-rise"><div><h1>Stats</h1><p class="sub">Your viewing, in numbers.</p></div></div>
  {#if !s}
    <div class="tiles">{#each [1, 2, 3, 4, 5, 6] as _}<div class="skeleton tsk"></div>{/each}</div>
  {:else}
    <div class="hero card animate-rise">
      <div class="big">
        <span class="lbl">Total time watched</span>
        <span class="v">{minutesToText(s.minutes.total)}</span>
        <span class="faint">{hours(s.minutes.total).toLocaleString()} hours · {hours(s.minutes.tv).toLocaleString()}h series · {hours(s.minutes.movies).toLocaleString()}h movies</span>
      </div>
      <div class="split">
        <div class="seg-bar"><div class="tv" style:width="{s.minutes.total ? (s.minutes.tv / s.minutes.total) * 100 : 50}%"></div></div>
        <div class="legend faint"><span><i class="tv"></i> Series</span><span><i class="mv"></i> Movies</span></div>
      </div>
    </div>

    <div class="tiles">
      <StatTile label="Series completed" value={s.counts.completed_tv} delay={0}>{#snippet icon()}<Tv size={18} />{/snippet}</StatTile>
      <StatTile label="Movies completed" value={s.counts.completed_movies} delay={40}>{#snippet icon()}<Film size={18} />{/snippet}</StatTile>
      <StatTile label="Episodes watched" value={s.episodes_watched.toLocaleString()} delay={80}>{#snippet icon()}<Play size={18} />{/snippet}</StatTile>
      <StatTile label="Currently watching" value={s.counts.watching ?? 0} delay={120}>{#snippet icon()}<Play size={18} />{/snippet}</StatTile>
      <StatTile label="Average rating" value={s.average_rating ? `${(s.average_rating / 2).toFixed(1)}★` : '—'} sub="{s.counts.rated} rated" delay={160}>{#snippet icon()}<Star size={18} />{/snippet}</StatTile>
      <StatTile label="Rewatched" value={s.counts.rewatched} sub="titles seen twice or more" delay={200}>{#snippet icon()}<Repeat size={18} />{/snippet}</StatTile>
    </div>

    <div class="charts">
      <section class="card card-pad animate-rise">
        <div class="section-head"><h2>Viewings per month</h2></div>
        <div class="bars months">
          {#each s.activity as a}
            <div class="col" title="{a.count} viewings">
              <div class="bar" style:height="{(a.count / maxMonth) * 100}%"></div>
              <span class="faint">{monthLabel(a.month)}</span>
            </div>
          {/each}
        </div>
      </section>
      <section class="card card-pad animate-rise">
        <div class="section-head"><h2>Favourite days</h2></div>
        <div class="bars dow">
          {#each s.weekdays as c, i}
            <div class="col" title="{c} viewings"><div class="bar signal" style:height="{(c / maxDow) * 100}%"></div><span class="faint">{DOW[i]}</span></div>
          {/each}
        </div>
      </section>
      <section class="card card-pad animate-rise">
        <div class="section-head"><h2>Rating spread</h2></div>
        <div class="bars ratings">
          {#each s.rating_distribution as r}
            <div class="col" title="{r.count} rated {r.rating / 2}"><div class="bar signal" style:height="{(r.count / maxRating) * 100}%"></div><span class="faint">{r.rating / 2}</span></div>
          {/each}
        </div>
      </section>
      <section class="card card-pad animate-rise">
        <div class="section-head"><h2>By decade</h2></div>
        {#if s.decades.length}
          <div class="bars">
            {#each s.decades as d}<div class="col" title="{d.count} titles"><div class="bar" style:height="{(d.count / maxDecade) * 100}%"></div><span class="faint">{String(d.decade).slice(2)}s</span></div>{/each}
          </div>
        {:else}<p class="faint">Complete some titles to see this.</p>{/if}
      </section>
      <section class="card card-pad animate-rise genres">
        <div class="section-head"><h2>Genres</h2></div>
        {#if s.genres.length}
          {#each s.genres.slice(0, 10) as g, i}
            <div class="grow">
              <span class="gname truncate">{g.name}</span>
              <div class="gbar"><div style:width="{g.percentage}%" style:animation-delay="{i * 40}ms"></div></div>
              <span class="faint gnum">{g.count}</span>
            </div>
          {/each}
        {:else}<p class="faint">Complete some titles to see your genre mix.</p>{/if}
      </section>
    </div>

    {#if s.most_rewatched.length}
      <Rail title="Most rewatched">{#snippet icon()}<Repeat size={18} />{/snippet}
        {#each s.most_rewatched as m, i (m.id)}<div class="slot"><MediaCard media={m as any} tracking={{ watch_count: m.watch_count }} showStatus={false} delay={i * 30} subtitle="Watched {m.watch_count}×" /></div>{/each}
      </Rail>
    {/if}
    {#if s.top_rated.length}
      <Rail title="Top rated">{#snippet icon()}<Star size={18} />{/snippet}
        {#each s.top_rated as m, i (m.id)}<div class="slot"><MediaCard media={m as any} tracking={{ rating: m.rating }} showStatus={false} delay={i * 30} /></div>{/each}
      </Rail>
    {/if}

    <section class="card card-pad animate-rise">
      <div class="section-head"><h2><Trophy size={18} /> Achievements <span class="pill">{s.achievements.length} / {all.length}</span></h2></div>
      {#each [5, 4, 3, 2, 1] as tier}
        {@const items = all.filter((a) => a.tier === tier)}
        {#if items.length}
          <h3 class="tier tier-{tier}">{TIERS[tier]}</h3>
          <div class="agrid">
            {#each items as a (a.id)}
              <div class="arow" class:locked={!earned.has(a.id)}><AchievementBadge {a} size={40} locked={!earned.has(a.id)} /><div><b>{a.name}</b><div class="faint">{a.description}</div></div></div>
            {/each}
          </div>
        {/if}
      {/each}
    </section>
  {/if}
</div>

<style>
  .hero { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; padding: 1.25rem 1.5rem; margin-bottom: 1rem; flex-wrap: wrap; background: linear-gradient(135deg, rgb(var(--c-brand) / 0.12), rgb(var(--c-surface)) 60%); }
  .big { display: flex; flex-direction: column; }
  .lbl { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgb(var(--c-text-3)); }
  .v { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
  .split { flex: 1 1 14rem; max-width: 22rem; }
  .seg-bar { height: 0.625rem; border-radius: 999px; background: rgb(var(--c-signal)); overflow: hidden; }
  .seg-bar .tv { height: 100%; background: rgb(var(--c-brand)); border-radius: 999px; }
  .legend { display: flex; gap: 1rem; font-size: 0.75rem; margin-top: 0.4rem; }
  .legend i { display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 999px; margin-right: 0.3rem; }
  .legend .tv { background: rgb(var(--c-brand)); } .legend .mv { background: rgb(var(--c-signal)); }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
  .tsk { height: 6rem; border-radius: var(--radius-lg); }
  .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
  .genres { grid-column: 1 / -1; }
  .bars { display: flex; align-items: flex-end; gap: 0.35rem; height: 8rem; }
  .col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 0.3rem; font-size: 0.6875rem; }
  .bar { width: 100%; max-width: 2rem; border-radius: 0.35rem 0.35rem 0 0; background: rgb(var(--c-brand)); min-height: 2px; animation: grow var(--dur-4) var(--ease-out) both; transform-origin: bottom; }
  .bar.signal { background: rgb(var(--c-signal)); }
  @keyframes grow { from { transform: scaleY(0); } }
  .grow { display: grid; grid-template-columns: 8rem 1fr 2.5rem; align-items: center; gap: 0.75rem; margin-bottom: 0.45rem; font-size: 0.8125rem; }
  .gname { font-weight: 600; }
  .gbar { height: 0.5rem; background: rgb(var(--c-subtle)); border-radius: 999px; overflow: hidden; }
  .gbar div { height: 100%; background: rgb(var(--c-brand)); border-radius: 999px; animation: growx var(--dur-4) var(--ease-out) both; transform-origin: left; }
  @keyframes growx { from { transform: scaleX(0); } }
  .gnum { text-align: right; }
  .slot { width: 9.5rem; }
  .tier { font-size: 0.8125rem; margin: 0.875rem 0 0.5rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .tier-1 { color: #b87333; } .tier-2 { color: #8a949c; } .tier-3 { color: #d4a017; } .tier-4 { color: #8b5cf6; } .tier-5 { color: #06b6d4; }
  .agrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 0.5rem; }
  .arow { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border-radius: var(--radius-md); background: rgb(var(--c-subtle)); font-size: 0.8125rem; }
  .arow.locked { opacity: 0.6; }
</style>
