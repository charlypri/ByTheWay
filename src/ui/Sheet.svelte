<script lang="ts">
    import { tick } from 'svelte';
    import type { App } from '../app/app.svelte';
    import { paragraphs } from '../lib/i18n';
    import { splitSentences } from '../lib/narrator';
    import { glyphSvg } from '../map/icons';
    import { ICONS } from './icons';
    import { swipeDown } from './swipe';

    let { app, inert = false }: { app: App; inert?: boolean } = $props();

    let sheetEl = $state<HTMLElement>();
    let titleEl = $state<HTMLElement>();
    let bodyEl = $state<HTMLElement>();

    const poi = $derived(app.sheet);
    const tx = $derived(poi ? app.text(poi) : null);
    const paras = $derived(tx ? paragraphs(tx.description) : []);
    const poiState = $derived(poi ? app.stateOf(poi) : 'pending');
    const playing = $derived(!!poi && app.narration?.poi.id === poi.id);
    const canListen = $derived(app.narrator.available);

    /** Párrafo que se está leyendo: la frase 0 es el título, luego las de cada párrafo en orden. */
    const current = $derived.by(() => {
        if (!playing || !app.narration) return -1;
        const idx = app.narration.progress.index;
        let at = 1;
        for (let i = 0; i < paras.length; i++) {
            const n = splitSentences(paras[i]).length || 1;
            if (idx >= at && idx < at + n) return i;
            at += n;
        }
        return -1;
    });

    // Al abrir otra ficha: arriba del todo, foco en el título y el POI centrado en el hueco libre.
    let shownId: string | null = null;
    $effect(() => {
        const id = poi?.id ?? null;
        if (id === shownId) return;
        shownId = id;
        if (!id) return;
        void tick().then(() => {
            if (bodyEl) bodyEl.scrollTop = 0;
            titleEl?.focus({ preventScroll: true });
            requestAnimationFrame(() => sheetEl && app.frameSheet(sheetEl.offsetHeight));
        });
    });
</script>

{#if poi && tx}
    <div bind:this={sheetEl} class="sheet" role="dialog" aria-labelledby="sheet-title" {inert}>
        <div class="sheet-grip" use:swipeDown={{ moving: sheetEl, onDone: () => app.closeSheet() }}>
            <span class="grip" aria-hidden="true"></span>
            <div class="sheet-head">
                <h2 bind:this={titleEl} id="sheet-title" class="sheet-title" tabindex="-1" lang={tx.lang}>{tx.title}</h2>
                <button class="icon-btn quiet" type="button" aria-label={app.t('close')} onclick={() => app.closeSheet()}>
                    {@html ICONS.close}
                </button>
            </div>
            <p class="meta sheet-meta">
                {#if app.distanceText(poi)}<span class="meta-dist">{app.distanceText(poi)}</span>{/if}
                {#if app.stateText(poiState)}<span class="state">{@html glyphSvg(poiState)}{app.stateText(poiState)}</span>{/if}
                {#if tx.lang !== app.lang}<span class="badge">{app.t('onlyInSpanish')}</span>{/if}
            </p>
        </div>
        <!-- Acciones arriba: se ven sin tener que bajar hasta el final del texto. -->
        {#if canListen}
            <div class="sheet-actions">
                {#if playing}
                    <div class="sheet-playing">
                        <button class="btn-quiet" type="button" onclick={() => app.togglePause()}>
                            {@html app.narration?.paused ? ICONS.play : ICONS.pause}
                            <span>{app.narration?.paused ? app.t('resume') : app.t('pause')}</span>
                        </button>
                        <button class="btn-quiet" type="button" onclick={() => app.stopNarration()}>
                            {@html ICONS.stop}<span>{app.t('stop')}</span>
                        </button>
                    </div>
                {:else}
                    <button class="btn-accent wide" type="button" onclick={() => app.listen(poi)}>
                        {@html ICONS.playRound}
                        <span>{poiState === 'heard' ? app.t('listenAgain') : app.t('listen')}</span>
                    </button>
                {/if}
            </div>
        {/if}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex: el texto se desplaza con el teclado -->
        <div bind:this={bodyEl} class="sheet-body" tabindex="0" lang={paras.length ? tx.lang : app.lang}>
            {#each paras as p, i (i)}
                <p class:current={i === current}>{p}</p>
            {:else}
                <p class="empty">{app.t('noDescription')}</p>
            {/each}
        </div>
    </div>
{/if}
