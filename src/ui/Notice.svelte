<script lang="ts">
    import { FAR_AWAY_M, type App } from '../app/app.svelte';
    import { formatDistance } from '../lib/i18n';

    /** Avisos fijos y discretos en la zona inferior cuando no hay Anuncio ni Narración (sección 4.9). */
    let { app }: { app: App } = $props();

    const location = $derived(
        app.positionError === 'denied'
            ? app.t('locationDenied')
            : app.positionError === 'unsupported'
              ? app.t('locationUnsupported')
              : app.positionError === 'unavailable' && !app.fix
                ? app.t('locationUnavailable')
                : null,
    );
    const far = $derived(app.nearest && app.nearest.distance > FAR_AWAY_M ? app.nearest : null);
</script>

{#if app.panel === 'none'}
    {#if location}
        <p class="notice" role="status">{location}</p>
    {:else if far}
        <div class="notice notice-row" role="status">
            <span>{app.t('farAway', { d: formatDistance(far.distance, app.lang) })}</span>
            <button class="btn-quiet" type="button" onclick={() => app.showNearest()}>{app.t('showNearest')}</button>
        </div>
    {/if}
{/if}
