<script lang="ts">
    import type { App } from '../app/app.svelte';
    import { ICONS } from './icons';

    let { app, onSettings }: { app: App; onSettings?: () => void } = $props();
</script>

<div id="top-right" class="map-ctrl">
    {#if onSettings}
        <button class="map-btn" type="button" aria-label={app.t('settings')} aria-haspopup="dialog" onclick={onSettings}>
            {@html ICONS.settings}
        </button>
    {/if}
    <!-- "Norte arriba" con aria-pressed: pulsado fija el norte; suelto, el mapa gira con el rumbo. -->
    <button
        class="map-btn"
        type="button"
        aria-pressed={app.follow.northLocked}
        aria-label={app.t('north')}
        title={app.t('north')}
        onclick={() => app.camera.toggleNorth()}
    >
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <g class="needle" transform="rotate({-app.bearing} 12 12)">
                <path d="M12 2.8 15.4 12H8.6z" fill="#DF1B12" />
                <path d="M12 21.2 8.6 12h6.8z" fill="currentColor" opacity=".38" />
            </g>
        </svg>
    </button>
    <button
        class="map-btn tilt-btn"
        type="button"
        aria-pressed={app.follow.pitched}
        aria-label={app.t('view3d')}
        title={app.follow.pitched ? app.t('view3dOn') : app.t('view3dOff')}
        onclick={() => app.camera.toggleTilt()}
    >
        <span aria-hidden="true">3D</span>
    </button>
</div>
