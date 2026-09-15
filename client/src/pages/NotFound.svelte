<script lang="ts">
  import { RadarIcon } from '@lucide/svelte';
  import EmptyState from '../components/EmptyState.svelte';
</script>

<div class="page">
  <EmptyState title="Nothing on the radar here" text="That page does not exist.">
    {#snippet icon()}<RadarIcon size={26} />{/snippet}
    <a class="btn btn-primary" href="/">Back home</a>
  </EmptyState>
</div>
