<script lang="ts">
    import type { App } from '../app/app.svelte';
    import { formatDistance } from '../lib/i18n';
    import type { Poi } from '../lib/kml';

    /** Pantalla negra para llevar el móvil en el bolsillo; la guía sigue funcionando. */
    let { app }: { app: App } = $props();

    let el = $state<HTMLElement>();
    let lastTap = 0;

    $effect(() => el?.focus({ preventScroll: true }));

    const line = $derived.by((): { kind: 'playing' | 'announced'; poi: Poi } | null => {
        if (app.narration) return { kind: 'playing', poi: app.narration.poi };
        if (app.card) return { kind: 'announced', poi: app.card.poi };
        return null;
    });

    function tap(e: PointerEvent) {
        if (e.timeStamp - lastTap < 400) {
            lastTap = 0;
            app.setPocket(false);
        } else lastTap = e.timeStamp;
    }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && app.setPocket(false)} />

<div bind:this={el} class="pocket" role="dialog" aria-modal="true" aria-labelledby="pocket-hint" tabindex="-1" onpointerup={tap} ondblclick={() => app.setPocket(false)}>
    <p class="pocket-status" aria-live="polite">
        {#if line}
            {@const d = app.distanceTo(line.poi)}
            <span class="pocket-dot {line.kind}"></span>
            <span>{app.text(line.poi).title}{#if d != null}<span class="pocket-dist"> · {formatDistance(d, app.lang)}</span>{/if}</span>
        {:else}
            {app.t('guideOn')}
        {/if}
    </p>
    <p id="pocket-hint" class="pocket-hint">{app.t('pocketExit')}</p>
</div>
