<script lang="ts">
    import { onMount } from 'svelte';
    import type { MapMouseEvent, MapTouchEvent } from 'maplibre-gl';
    import type { App } from '../app/app.svelte';
    import { formatDistance, LOCALE } from '../lib/i18n';
    import { TIME_SCALES, type Simulator, type SpeedProfile } from '../lib/simulator';
    import { ICONS } from './icons';

    // Herramienta de pruebas (?sim), separada de la app: chip con borde discontinuo y un panel propio.
    let { app, sim }: { app: App; sim: Simulator } = $props();

    let open = $state(false);
    /** El simulador no es reactivo: cada cambio suyo sube este contador y el panel se vuelve a leer. */
    let version = $state(0);
    const view = $derived.by(() => {
        void version;
        void app.fix;
        return {
            walking: sim.walking,
            gps: sim.source === 'gps',
            profile: sim.profile,
            timeScale: sim.timeScale,
            travelled: sim.travelledM,
            length: sim.length,
        };
    });
    const PROFILES: SpeedProfile[] = ['walk', 'bike', 'car'];
    /** A cuántos píxeles de la flecha empieza un arrastre. */
    const GRAB_PX = 28;

    onMount(() => {
        const off = sim.onChange(() => version++);
        const ml = app.map.ml;
        let dragging = false;

        const down = (e: MapMouseEvent | MapTouchEvent) => {
            const fix = app.fix;
            if (!fix || sim.source === 'gps' || ('points' in e && e.points.length > 1)) return;
            const puck = ml.project([fix.lon, fix.lat]);
            if (Math.hypot(puck.x - e.point.x, puck.y - e.point.y) > GRAB_PX) return;
            // Sin esto, el mapa se arrastraría debajo de la flecha.
            e.preventDefault();
            dragging = true;
            sim.pause();
            ml.getCanvas().style.cursor = 'grabbing';
        };
        const move = (e: MapMouseEvent | MapTouchEvent) => {
            if (!dragging || !app.fix) return;
            app.map.setUser({ ...app.fix, lon: e.lngLat.lng, lat: e.lngLat.lat, heading: null }, false);
        };
        const up = (e: MapMouseEvent | MapTouchEvent) => {
            if (!dragging) return;
            dragging = false;
            ml.getCanvas().style.cursor = '';
            sim.moveTo(e.lngLat.lng, e.lngLat.lat);
        };
        ml.on('mousedown', down);
        ml.on('touchstart', down);
        ml.on('mousemove', move);
        ml.on('touchmove', move);
        ml.on('mouseup', up);
        ml.on('touchend', up);
        return () => {
            off();
            ml.off('mousedown', down);
            ml.off('touchstart', down);
            ml.off('mousemove', move);
            ml.off('touchmove', move);
            ml.off('mouseup', up);
            ml.off('touchend', up);
        };
    });

    const num = (n: number, min: number) => n.toLocaleString(LOCALE[app.lang], { minimumFractionDigits: min, maximumFractionDigits: 1 });

    function setProfile(p: SpeedProfile) {
        sim.profile = p;
        version++;
    }

    function setScale(s: number) {
        sim.timeScale = s;
        version++;
    }
</script>

<div id="top-left" class="map-ctrl">
    <button class="demo-chip" type="button" aria-expanded={open} aria-controls="sim" onclick={() => (open = !open)}>
        {@html ICONS.flask}
        <span>{app.t('simTitle')}</span>
    </button>
</div>

{#if open}
    <section id="sim" class="demo" aria-labelledby="sim-title">
        <div class="panel-head">
            <h2 id="sim-title">{app.t('simTitle')}</h2>
            <button class="icon-btn quiet" type="button" aria-label={app.t('close')} onclick={() => (open = false)}>
                {@html ICONS.close}
            </button>
        </div>
        <p class="demo-note">{app.t('simNote')}</p>
        <div class="demo-row btn-pair">
            <button class="btn-quiet" type="button" onclick={() => (view.walking ? sim.pause() : sim.play())}>
                {app.t(view.walking ? 'simPause' : 'simPlay')}
            </button>
            <button class="btn-quiet" type="button" onclick={() => sim.restart()}>{app.t('simRestart')}</button>
        </div>
        <div class="demo-row">
            <span class="demo-label" id="sim-profile">{app.t('simProfile')}</span>
            <div class="seg-q" role="group" aria-labelledby="sim-profile">
                {#each PROFILES as p (p)}
                    <button type="button" aria-pressed={view.profile === p} onclick={() => setProfile(p)}>{app.t(p)}</button>
                {/each}
            </div>
        </div>
        <div class="demo-row">
            <span class="demo-label" id="sim-clock">{app.t('simClock')}</span>
            <div class="seg-q" role="group" aria-labelledby="sim-clock">
                {#each TIME_SCALES as s (s)}
                    <button type="button" aria-pressed={view.timeScale === s} onclick={() => setScale(s)}>{s}×</button>
                {/each}
            </div>
        </div>
        <div class="demo-row">
            <button class="btn-quiet wide" type="button" aria-pressed={view.gps} onclick={() => (view.gps ? sim.play() : sim.useGps())}>
                {@html ICONS.gps}
                <span>{app.t('simGps')}</span>
            </button>
        </div>
        <!-- Lo que ve la cámara: sirve para cazar los saltos del GPS real que alejan el zoom. -->
        <p class="demo-readout">
            {#if !view.gps}{formatDistance(view.travelled, app.lang)} / {formatDistance(view.length, app.lang)}<br />{/if}
            {#if app.fix}
                {app.t('simReadout', {
                    accuracy: Math.round(app.fix.accuracy),
                    speed: num((app.fix.speed ?? 0) * 3.6, 1),
                    zoom: num(app.camera.zoom, 0),
                })}
            {/if}
        </p>
    </section>
{/if}

<style>
    .demo-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 44px;
        padding: 0 14px 0 12px;
        border-radius: 22px;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-2);
        background: color-mix(in srgb, var(--surface) 82%, transparent);
        border: 1.5px dashed var(--text-3);
        backdrop-filter: blur(6px);
    }
    .demo-chip :global(svg) {
        width: 16px;
        height: 16px;
    }
    .demo-chip[aria-expanded='true'] {
        color: var(--text);
        border-color: var(--text);
    }
    .demo {
        position: fixed;
        top: calc(var(--sa-top) + var(--gutter) + 54px);
        left: calc(var(--sa-left) + var(--gutter));
        z-index: 8;
        width: min(calc(100vw - 2 * var(--gutter)), 360px);
        max-height: calc(100dvh - var(--sa-top) - var(--sa-bottom) - 90px);
        overflow-y: auto;
        padding: 6px 16px 12px;
        border-radius: 22px;
        background: color-mix(in srgb, var(--surface) 94%, var(--text) 6%);
        border: 1.5px dashed var(--text-3);
        box-shadow: var(--float-shadow);
        transform-origin: top left;
        animation: pop 0.2s var(--ease);
    }
    .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 -8px 0 0;
    }
    .panel-head h2 {
        font-size: 16px;
        font-weight: 600;
    }
    .panel-head .icon-btn {
        width: 44px;
        height: 44px;
        color: var(--text-2);
    }
    .demo-note {
        font-size: 13px;
        color: var(--text-2);
        margin-bottom: 8px;
    }
    .demo-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 0;
    }
    .btn-pair {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        white-space: nowrap;
    }
    .demo .btn-quiet {
        background: var(--surface);
    }
    .demo .btn-quiet[aria-pressed='true'] {
        background: var(--strong);
        color: var(--on-strong);
    }
    .demo-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-2);
    }
    .demo-readout {
        font-size: 13px;
        color: var(--text-2);
        padding-top: 10px;
        border-top: 1px solid var(--line);
        font-variant-numeric: tabular-nums;
    }
</style>
