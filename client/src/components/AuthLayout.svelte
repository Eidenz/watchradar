<script lang="ts">
  // Split auth layout: animated radar showcase on the left, form card on the right.
  import type { Snippet } from 'svelte';
  import { Radar, Repeat, Scissors, Users, Sun, Moon } from '@lucide/svelte';
  import Logo from './Logo.svelte';
  import { theme } from '../lib/theme.svelte';

  let { title, subtitle, children, footer }: { title: string; subtitle?: string; children: Snippet; footer?: Snippet } = $props();

  const blips = [
    { x: 58, y: 26, d: 0, label: 'S2E4 · tonight' },
    { x: 30, y: 58, d: 1.3, label: 'New season' },
    { x: 54, y: 70, d: 2.4, label: 'Rewatch #3' },
    { x: 44, y: 22, d: 3.1 },
    { x: 78, y: 46, d: 0.7 },
  ];
  const features = [
    { icon: Radar, text: 'Get told when a series you follow comes back.' },
    { icon: Repeat, text: 'Rewatch a show, or a single episode, without losing your history.' },
    { icon: Scissors, text: 'Cut long seasons into parts. Progress follows.' },
    { icon: Users, text: 'See what friends are watching, share what you think.' },
  ];
</script>

<div class="auth">
  <aside class="show" aria-hidden="true">
    <div class="show-top">
      <a class="brand" href="/"><Logo size={34} sweep={false} /><span>Watch<em>Radar</em></span></a>
    </div>

    <div class="radar">
      <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div><div class="ring r4"></div>
      <div class="cross h"></div><div class="cross v"></div>
      <div class="sweep"></div>
      {#each blips as b}
        <div class="blip" style:left="{b.x}%" style:top="{b.y}%" style:animation-delay="{b.d}s">
          <span class="ping" style:animation-delay="{b.d}s"></span>
          {#if b.label}<span class="tag" style:animation-delay="{b.d}s">{b.label}</span>{/if}
        </div>
      {/each}
      <div class="core"></div>
    </div>

    <div class="pitch">
      <h2>Everything you watch,<br />and what's next.</h2>
      <ul>
        {#each features as f}<li><span class="fi"><f.icon size={16} /></span>{f.text}</li>{/each}
      </ul>
    </div>
    <p class="foot">Movies &amp; series data by TMDB · self-hosted, yours.</p>
  </aside>

  <button class="icon-btn theme" onclick={() => theme.toggle()} aria-label="Toggle theme">{#if theme.dark}<Sun size={18} />{:else}<Moon size={18} />{/if}</button>
  <div class="form-wrap"><main class="form-side">
    <div class="panel card animate-rise">
      <div class="mobile-brand"><Logo size={40} /><span>Watch<em>Radar</em></span></div>
      <h1>{title}</h1>
      {#if subtitle}<p class="muted sub">{subtitle}</p>{/if}
      {@render children()}
    </div>
    {#if footer}<div class="under animate-rise">{@render footer()}</div>{/if}
  </main></div>
</div>

<style>
  .auth { position: relative; min-height: 100dvh; display: grid; grid-template-columns: 1fr; }
  @media (min-width: 900px) { .auth { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); } }

  /* ---- showcase ------------------------------------------------------------------- */
  .show { position: relative; overflow: hidden; padding: 2rem 2.5rem; color: #eef7f6;
    background: radial-gradient(120% 90% at 15% 0%, #167a70 0%, #0f4a45 38%, #0b2b2a 72%, #0a1c1c 100%); }
  @media (min-width: 900px) { .show { display: flex; flex-direction: column; justify-content: space-between; } }
  /* Narrow screens: the showcase becomes a compact hero the form card overlaps. */
  @media (max-width: 899px) {
    .show { padding: 1.25rem 1.25rem 4.5rem; min-height: 16rem; }
    .show .pitch h2 { font-size: 1.5rem; margin: 1.25rem 0 0; max-width: 16rem; }
    .show .pitch ul, .show .foot { display: none; }
    .radar { right: -30%; top: 58%; width: 80vw; max-width: 26rem; opacity: 0.8; }
    .tag { display: none; }
  }
  .brand { display: inline-flex; align-items: center; gap: 0.625rem; font-weight: 800; font-size: 1.25rem; letter-spacing: -0.02em; color: #fff; }
  .brand em { font-style: normal; color: #2dd4bf; }

  .radar { position: absolute; right: -14%; top: 50%; width: 46vw; max-width: 44rem; aspect-ratio: 1; transform: translateY(-52%); border-radius: 50%;
    opacity: 0.95; mask-image: radial-gradient(circle, #000 55%, transparent 74%); }
  .ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgb(45 212 191 / 0.22); }
  .r2 { inset: 12.5%; } .r3 { inset: 25%; } .r4 { inset: 37.5%; border-color: rgb(45 212 191 / 0.35); }
  .cross { position: absolute; background: rgb(45 212 191 / 0.14); }
  .cross.h { left: 0; right: 0; top: 50%; height: 1px; } .cross.v { top: 0; bottom: 0; left: 50%; width: 1px; }
  .sweep { position: absolute; inset: 0; border-radius: 50%;
    background: conic-gradient(from 0deg, rgb(45 212 191 / 0) 0deg, rgb(45 212 191 / 0) 250deg, rgb(45 212 191 / 0.06) 300deg, rgb(45 212 191 / 0.45) 360deg);
    animation: sweep 5s linear infinite; }
  @keyframes sweep { to { transform: rotate(360deg); } }
  .core { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; border-radius: 50%; background: #2dd4bf; transform: translate(-50%, -50%); box-shadow: 0 0 18px 4px rgb(45 212 191 / 0.5); }
  .blip { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 10px 2px rgb(251 191 36 / 0.6);
    animation: blink 5s ease-out infinite; }
  .ping { position: absolute; inset: -6px; border-radius: 50%; border: 2px solid rgb(251 191 36 / 0.8); animation: ping 5s ease-out infinite; }
  .tag { position: absolute; left: 14px; top: -10px; white-space: nowrap; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.02em; color: #fff;
    background: rgb(255 255 255 / 0.1); border: 1px solid rgb(255 255 255 / 0.18); backdrop-filter: blur(6px); padding: 0.2rem 0.5rem; border-radius: 999px;
    animation: tag 5s ease-out infinite; }
  @keyframes blink { 0%, 4% { opacity: 1; } 70%, 100% { opacity: 0.35; } }
  @keyframes ping { 0% { transform: scale(0.6); opacity: 0.9; } 40%, 100% { transform: scale(3); opacity: 0; } }
  @keyframes tag { 0% { opacity: 0; transform: translateX(-4px); } 8%, 60% { opacity: 1; transform: none; } 85%, 100% { opacity: 0; } }

  .pitch { position: relative; z-index: 1; max-width: 26rem; }
  .pitch h2 { font-size: 2.125rem; line-height: 1.12; letter-spacing: -0.025em; margin-bottom: 1.5rem; }
  .pitch ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; color: rgb(238 247 246 / 0.82); font-size: 0.9375rem; }
  .pitch li { display: flex; align-items: center; gap: 0.75rem; }
  .fi { width: 2rem; height: 2rem; border-radius: 0.6rem; background: rgb(255 255 255 / 0.08); border: 1px solid rgb(255 255 255 / 0.1); display: grid; place-items: center; color: #2dd4bf; flex-shrink: 0; }
  .foot { position: relative; z-index: 1; font-size: 0.75rem; color: rgb(238 247 246 / 0.45); }

  /* ---- form side ------------------------------------------------------------------ */
  .form-side { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem;
    background: rgb(var(--c-page)); }
  @media (max-width: 899px) {
    .form-side { justify-content: flex-start; padding: 0 1rem 2.5rem; background: transparent; }
    .form-side::before { display: none; }
    .panel { margin-top: -3rem; box-shadow: var(--shadow-lg); }
    .theme { top: 0.875rem; right: 0.875rem; color: #eef7f6; }
    .theme:hover { background: rgb(255 255 255 / 0.12); color: #fff; }
  }
  .form-wrap { display: contents; }
  @media (min-width: 900px) {
    .form-side { min-height: 100dvh; background: rgb(var(--c-surface)); border-left: 1px solid rgb(var(--c-border)); }
    /* The form side bleeds over the seam onto the showcase: a shadow band at the edge, then its neutral tone fading out. */
    .show::after {
      content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
      background: linear-gradient(270deg, rgb(6 24 23 / 0.16) 0, rgb(255 255 255 / 0.14) 2rem, rgb(255 255 255 / 0.05) 10rem, transparent 20rem);
    }
    :global(html.dark) .show::after {
      background: linear-gradient(270deg, rgb(0 0 0 / 0.22) 0, rgb(var(--c-surface) / 0.6) 2rem, rgb(var(--c-surface) / 0.2) 10rem, transparent 20rem);
    }
  }
  :global(html.dark) .form-side .panel { background: rgb(var(--c-page)); }
  .form-side::before { content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(60% 50% at 80% 100%, rgb(var(--c-brand) / 0.08), transparent 70%); }
  .theme { position: absolute; top: 1rem; right: 1rem; z-index: 3; }
  .panel { width: 100%; max-width: 25rem; padding: 2rem; }
  .mobile-brand { display: none; }
  h1 { font-size: 1.5rem; letter-spacing: -0.02em; }
  .sub { margin: 0.35rem 0 1.5rem; }
  .under { margin-top: 1.25rem; font-size: 0.8125rem; color: rgb(var(--c-text-2)); text-align: center; }
  :global(.auth form) { display: flex; flex-direction: column; }
  :global(.auth form .input) { margin-bottom: 0.875rem; }
  :global(.auth form .btn) { margin-top: 0.375rem; }
  :global(.auth .err) { color: rgb(var(--c-danger)); font-size: 0.8125rem; margin: -0.25rem 0 0.75rem; }
  :global(.auth .note) { background: rgb(var(--c-brand) / 0.1); color: rgb(var(--c-brand)); padding: 0.625rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.8125rem; margin-bottom: 1rem; }
  :global(.auth .field) { position: relative; }
  :global(.auth .field .fic) { position: absolute; left: 0.8rem; top: 0.75rem; color: rgb(var(--c-text-3)); pointer-events: none; }
  :global(.auth .field .input) { padding-left: 2.4rem; }
  @media (prefers-reduced-motion: reduce) { .sweep, .blip, .ping, .tag { animation: none; } }
</style>
