<script lang="ts">
    import type { App } from '../app/app.svelte';
    import { formatDistance } from '../lib/i18n';
    import type { Poi } from '../lib/kml';

    /** Distancia en vivo para las tarjetas: la cifra grande y la unidad pequeña. */
    let { app, poi }: { app: App; poi: Poi } = $props();

    const parts = $derived.by(() => {
        const d = app.distanceTo(poi);
        if (d == null) return null;
        const txt = formatDistance(d, app.lang);
        const i = txt.lastIndexOf(' ');
        return { value: txt.slice(0, i), unit: txt.slice(i + 1) };
    });
</script>

{#if parts}
    <span class="card-dist"><b>{parts.value}</b><small>{parts.unit}</small></span>
{/if}
