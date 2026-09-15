<script lang="ts">
  let { name, size = 36 }: { name: string; size?: number } = $props();
  const hue = $derived([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7));
</script>

<div class="avatar" style:width="{size}px" style:height="{size}px" style:font-size="{size * 0.42}px" style:background="hsl({hue} 55% 45%)" aria-hidden="true">
  {name.slice(0, 1).toUpperCase()}
</div>

<style>
  .avatar { border-radius: 999px; display: grid; place-items: center; color: #fff; font-weight: 700; flex-shrink: 0; user-select: none; letter-spacing: 0; }
</style>
