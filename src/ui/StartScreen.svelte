<script lang="ts">
    import type { App } from '../app/app.svelte';
    import type { Lang } from '../lib/kml';
    import { glyphSvg } from '../map/icons';

    let { app, onStart }: { app: App; onStart: () => void } = $props();

    const LANGS: { lang: Lang; label: string }[] = [
        { lang: 'es', label: 'Español' },
        { lang: 'en', label: 'English' },
    ];
    // Hasta tener los lugares no se puede empezar; si no llegan, se explica y se ofrece reintentar.
    const ready = $derived(app.dataReady && app.mapReady);
</script>

<section class="start" aria-labelledby="wordmark">
    <div class="start-lang seg-q" role="group" aria-label="Idioma / Language">
        {#each LANGS as l (l.lang)}
            <button type="button" lang={l.lang} aria-pressed={app.lang === l.lang} onclick={() => app.setLang(l.lang)}>{l.label}</button>
        {/each}
    </div>
    <div class="start-inner">
        <div class="start-copy">
            <h1 id="wordmark" class="wordmark">Bytheway</h1>
            <p class="tagline">{app.t('tagline')}</p>
        </div>
        <div class="start-legend" aria-hidden="true">
            <span><i class="glyph">{@html glyphSvg('pending')}</i>{app.t('legendNew')}</span>
            <span><i class="glyph">{@html glyphSvg('announced')}</i>{app.t('legendAnnounced')}</span>
            <span><i class="glyph">{@html glyphSvg('heard')}</i>{app.t('heard')}</span>
        </div>
        {#if app.dataError}
            <p class="start-error" role="alert">{app.t('noData')}</p>
            <button class="btn-start" type="button" onclick={() => app.retryData()}>{app.t('retry')}</button>
        {:else}
            <button class="btn-start" type="button" disabled={!ready} onclick={onStart}>
                {ready ? app.t('start') : app.t('loading')}
            </button>
            <p class="start-hint">{app.t('startHint')}</p>
        {/if}
        {#if !app.narrator.available}
            <p class="start-error">{app.t('noVoices')}</p>
        {/if}
    </div>
</section>
