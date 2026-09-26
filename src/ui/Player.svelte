<script lang="ts">
    import type { App, Narration } from '../app/app.svelte';
    import Distance from './Distance.svelte';
    import { ICONS } from './icons';

    let { app, narration }: { app: App; narration: Narration } = $props();

    const tx = $derived(app.text(narration.poi));
    const total = $derived(Math.max(1, narration.progress.total));
    const current = $derived(Math.min(narration.progress.index + 1, total));
</script>

<div class="p-player">
    <div class="bar" aria-hidden="true"><i style="width: {(current / total) * 100}%"></i></div>
    <div class="pl-head">
        <span class="pl-state" class:is-paused={narration.paused}>
            <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>{narration.paused ? app.t('paused') : app.t('narrating')}</span>
        </span>
        <Distance {app} poi={narration.poi} />
    </div>
    <button class="pl-title" type="button" aria-label={app.t('openPlace', { t: tx.title })} onclick={() => app.openSheet(narration.poi)}>
        <span lang={tx.lang}>{tx.title}</span>
    </button>
    <span class="pl-count">{app.t('sentence', { i: current, n: total })}</span>
    <div class="pl-controls">
        <button class="btn-listen" class:is-paused={narration.paused} type="button" onclick={() => app.togglePause()}>
            {@html narration.paused ? ICONS.play : ICONS.pause}<span>{narration.paused ? app.t('resume') : app.t('pause')}</span>
        </button>
        <button class="btn-dark" type="button" onclick={() => app.stopNarration()}>
            {@html ICONS.stop}<span>{app.t('stop')}</span>
        </button>
    </div>
</div>
