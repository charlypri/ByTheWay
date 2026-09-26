<script lang="ts">
    import type { App } from '../app/app.svelte';

    let { app }: { app: App } = $props();
</script>

<div class="toast" class:show={!!app.toast} role="status" aria-live="polite">{app.toast ?? ''}</div>
