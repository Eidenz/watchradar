<!-- Ambient background: two slow-drifting tinted blobs plus faint radar rings. -->
<div class="bg" aria-hidden="true">
  <div class="blob a"></div>
  <div class="blob b"></div>
  <div class="rings"></div>
</div>

<style>
  .bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .blob { position: absolute; width: 46vmax; height: 46vmax; border-radius: 50%; filter: blur(80px); opacity: 0.14; will-change: transform; }
  :global(html.dark) .blob { opacity: 0.11; }
  .a { top: -18vmax; right: -12vmax; background: rgb(var(--c-brand)); animation: drift-a 28s ease-in-out infinite alternate; }
  .b { bottom: -22vmax; left: -14vmax; background: rgb(var(--c-signal)); animation: drift-b 34s ease-in-out infinite alternate; }
  .rings {
    position: absolute; right: -14vmax; top: -14vmax; width: 60vmax; height: 60vmax; border-radius: 50%; opacity: 0.35;
    background: repeating-radial-gradient(circle at center, rgb(var(--c-brand) / 0.08) 0 1px, transparent 1px 7vmax);
    mask-image: radial-gradient(circle at center, #000 0%, transparent 65%);
  }
  @keyframes drift-a { from { transform: translate(0, 0) scale(1); } to { transform: translate(-8vmax, 10vmax) scale(1.15); } }
  @keyframes drift-b { from { transform: translate(0, 0) scale(1.1); } to { transform: translate(10vmax, -8vmax) scale(0.95); } }
</style>
