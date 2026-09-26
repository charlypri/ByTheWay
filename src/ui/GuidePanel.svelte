<script lang="ts">
    import type { App } from '../app/app.svelte';
    import { glyphSvg } from '../map/icons';
    import AnnounceCard from './AnnounceCard.svelte';
    import Player from './Player.svelte';

    /** Zona inferior: Anuncio o Narración en paneles grafito; en reposo, nada. */
    let { app, paused = false }: { app: App; paused?: boolean } = $props();

    const next = $derived(app.panel === 'none' ? undefined : app.queue[0]);
    const nextText = $derived(next ? app.text(next) : null);
</script>

{#if next && nextText}
    <!-- "A continuación": carril pegado al panel, como el "luego" de un navegador. -->
    <button class="upnext" type="button" aria-label="{app.t('next')}: {nextText.title}" onclick={() => app.openSheet(next)}>
        <span class="upnext-dot" aria-hidden="true">{@html glyphSvg('announced')}</span>
        <span class="upnext-label">{app.t('next')}</span>
        <span class="upnext-title" lang={nextText.lang}>{nextText.title}</span>
        {#if app.queue.length > 1}<span class="upnext-more">{app.t('more', { n: app.queue.length - 1 })}</span>{/if}
    </button>
{/if}

{#if app.panel !== 'none'}
    <div class="panel" data-mode={app.panel}>
        {#if app.narration}
            <Player {app} narration={app.narration} />
        {:else if app.card}
            {#key app.card.poi.id}
                <AnnounceCard {app} card={app.card} {paused} />
            {/key}
        {/if}
    </div>
{/if}

<!-- Un lector de pantalla también anuncia la tarjeta del Anuncio. -->
<div class="sr-only" aria-live="polite">
    {#if app.card && !app.narration}{app.t('nearYou')}: {app.text(app.card.poi).title}{/if}
</div>
