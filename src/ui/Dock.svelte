<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { App } from '../app/app.svelte';
    import { ICONS } from './icons';

    let { app, children, inert = false }: { app: App; children?: Snippet; inert?: boolean } = $props();

    let stack = $state<HTMLElement>();

    // La altura de la zona inferior se pasa a la cámara como padding: el usuario nunca queda tapado.
    $effect(() => {
        if (!stack) return;
        const measure = () => {
            const h = stack!.offsetHeight;
            const next = h ? Math.max(0, Math.round(window.innerHeight - stack!.getBoundingClientRect().top + 16)) : 0;
            if (next === app.bottomInset) return;
            app.bottomInset = next;
            app.camera.reframe();
        };
        const ro = new ResizeObserver(measure);
        ro.observe(stack);
        return () => ro.disconnect();
    });
</script>

<section class="dock" aria-label={app.t('guide')} {inert}>
    {#if !app.follow.active && app.started && !app.sheet}
        <button type="button" class="recenter" onclick={() => app.camera.recenter()}>
            {@html ICONS.recenter}<span>{app.t('recenter')}</span>
        </button>
    {/if}
    <div bind:this={stack} class="stack">
        {@render children?.()}
    </div>
</section>
