<script lang="ts">
    import type { App } from '../app/app.svelte';
    import { ICONS } from './icons';

    let { app, hidden = false }: { app: App; hidden?: boolean } = $props();

    let el = $state<HTMLButtonElement>();
    const poi = $derived(app.selected);
    const show = $derived(!!poi && !app.sheet && !hidden);
    const poiState = $derived(poi ? app.stateOf(poi) : 'pending');
    const title = $derived(poi ? app.text(poi) : null);
    const meta = $derived(poi ? [app.distanceText(poi), app.stateText(poiState)].filter(Boolean).join(' · ') : '');

    /** La burbuja sigue al POI cuando el mapa se mueve, sin salirse de la pantalla. */
    function place() {
        if (!el || !poi) return;
        const p = app.map.ml.project([poi.lon, poi.lat]);
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const margin = 12;
        const left = Math.min(Math.max(p.x - w / 2, margin), window.innerWidth - w - margin);
        const tip = Math.min(Math.max(p.x - left, 20), w - 20);
        // Medio icono del mapa (icons.ts) más el pico de la burbuja.
        const lift = poiState === 'playing' ? 46 : 36;
        const offscreen = p.x < 0 || p.x > window.innerWidth || p.y < 0 || p.y > window.innerHeight;
        el.style.visibility = offscreen ? 'hidden' : '';
        el.style.setProperty('--tip', `${Math.round(tip)}px`);
        el.style.transform = `translate(${Math.round(left)}px, ${Math.round(p.y - h - lift)}px)`;
    }

    $effect(() => {
        if (!show) return;
        void meta;
        place();
        const off = app.onMapMove(place);
        addEventListener('resize', place);
        return () => {
            off();
            removeEventListener('resize', place);
        };
    });
</script>

{#if show && poi && title}
    <button
        bind:this={el}
        class="bubble"
        type="button"
        data-state={poiState}
        aria-label="{app.t('openPlace', { t: title.title })}. {meta}"
        onclick={() => app.openSheet(poi)}
    >
        <span class="bubble-text">
            <span class="bubble-title" lang={title.lang}>{title.title}</span>
            {#if meta}<span class="bubble-meta">{meta}</span>{/if}
        </span>
        <span class="bubble-chev">{@html ICONS.chevron}</span>
    </button>
{/if}
