<script lang="ts">
    import { onMount } from 'svelte';
    import type { App } from './app/app.svelte';
    import Bubble from './ui/Bubble.svelte';
    import Dock from './ui/Dock.svelte';
    import MapControls from './ui/MapControls.svelte';
    import Sheet from './ui/Sheet.svelte';

    let { app }: { app: App } = $props();
    let container: HTMLElement;

    onMount(() => {
        void app.boot(container).then(() => app.start());
    });

    $effect(() => {
        document.documentElement.lang = app.lang;
    });

    $effect(() => {
        document.documentElement.dataset.theme = app.dark ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', app.dark ? '#111315' : '#eef0f1');
    });

    function onKey(e: KeyboardEvent) {
        if (e.key !== 'Escape') return;
        if (app.sheet) app.closeSheet();
        else if (app.selected) app.select(null);
    }
</script>

<svelte:window onkeydown={onKey} />
<svelte:body class:sheet-open={!!app.sheet} />

<div id="map" bind:this={container} role="application" aria-label={app.t('mapLabel')}></div>

{#if app.mapReady}
    <MapControls {app} />
    <Bubble {app} />
    <Dock {app} inert={!!app.sheet} />
    <Sheet {app} />
{/if}
