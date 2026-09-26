<script lang="ts">
    import { onMount, tick } from 'svelte';
    import type { App } from './app/app.svelte';
    import Bubble from './ui/Bubble.svelte';
    import Dock from './ui/Dock.svelte';
    import GuidePanel from './ui/GuidePanel.svelte';
    import MapControls from './ui/MapControls.svelte';
    import Notice from './ui/Notice.svelte';
    import StartScreen from './ui/StartScreen.svelte';
    import Toast from './ui/Toast.svelte';

    let { app }: { app: App } = $props();
    let container: HTMLElement;

    let settingsOpen = $state(false);
    let showStart = $state(true);
    let leaving = $state(false);
    /** Dónde estaba el foco al abrir los ajustes, para devolverlo al cerrar. */
    let settingsReturn: HTMLElement | null = null;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

    // Los ajustes no hacen falta para la primera pintura: se cargan al abrirlos.
    const loadSettings = () => import('./ui/Settings.svelte');
    let Settings = $state<Awaited<ReturnType<typeof loadSettings>>['default'] | null>(null);

    onMount(() => {
        void app.boot(container);
    });

    $effect(() => {
        document.documentElement.lang = app.lang;
    });

    $effect(() => {
        document.documentElement.dataset.theme = app.dark ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', app.dark ? '#111315' : '#eef0f1');
    });

    /** Empezar, dentro del mismo toque: ubicación, voz, audio y pantalla encendida. */
    function start() {
        app.start();
        leaving = true;
        setTimeout(() => (showStart = false), reduceMotion.matches ? 0 : 320);
    }

    async function openSettings() {
        settingsReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        Settings ??= (await loadSettings()).default;
        settingsOpen = true;
    }

    function closeSettings() {
        settingsOpen = false;
        void tick().then(() => settingsReturn?.focus({ preventScroll: true }));
    }

    // El Modo bolsillo se abre desde los ajustes y los cierra.
    $effect(() => {
        if (app.pocket) settingsOpen = false;
    });

    /** Con un diálogo modal abierto, el resto no recibe foco ni lectores de pantalla. */
    const modal = $derived(settingsOpen || app.pocket);
    const pre = $derived(showStart);

    $effect(() => {
        document.body.classList.toggle('pre', pre);
        document.body.classList.toggle('sheet-open', !!app.sheet);
    });

    function onKey(e: KeyboardEvent) {
        if (e.key !== 'Escape' || modal) return;
        if (app.sheet) app.closeSheet();
        else if (app.selected) app.select(null);
    }
</script>

<!-- El audio necesita un toque del usuario para sonar. -->
<svelte:window onkeydown={onKey} onpointerdown={() => app.started && app.deps.chime.unlock()} />

<div id="map" bind:this={container} role="application" aria-label={app.t('mapLabel')} inert={modal || pre}></div>

{#if app.mapReady}
    <div inert={modal || pre}>
        <MapControls {app} onSettings={openSettings} />
        <Bubble {app} hidden={pre} />
    </div>
    <Dock {app} inert={modal || pre || !!app.sheet}>
        <Notice {app} />
        <GuidePanel {app} paused={app.pocket} />
    </Dock>
    <!-- La ficha y el Modo bolsillo tampoco hacen falta para la primera pintura. -->
    {#if app.sheet}
        {#await import('./ui/Sheet.svelte') then { default: Sheet }}
            <Sheet {app} inert={modal} />
        {/await}
    {/if}
{/if}

{#if settingsOpen && Settings}
    <Settings {app} onClose={closeSettings} />
{/if}

{#if showStart}
    <div class:leaving class="start-wrap">
        <StartScreen {app} onStart={start} />
    </div>
{/if}

{#if app.pocket}
    {#await import('./ui/Pocket.svelte') then { default: Pocket }}
        <Pocket {app} />
    {/await}
{/if}

<Toast {app} />
