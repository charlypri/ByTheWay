<script lang="ts">
    import { LINGER_MS, type App, type AnnounceCard } from '../app/app.svelte';
    import Distance from './Distance.svelte';
    import { ICONS } from './icons';
    import { swipeDown } from './swipe';

    let { app, card, paused = false }: { app: App; card: AnnounceCard; paused?: boolean } = $props();

    const tx = $derived(app.text(card.poi));
    const inside = $derived(card.exitAt == null);
    const heard = $derived(app.stateOf(card.poi) === 'heard');

    // Cuenta atrás: el reloj solo corre si la tarjeta se va a cerrar y se ve.
    let now = $state(Date.now());
    $effect(() => {
        if (inside || paused) return;
        now = Date.now();
        const id = setInterval(() => (now = Date.now()), 1000);
        return () => clearInterval(id);
    });
    const left = $derived(card.exitAt == null ? LINGER_MS : Math.max(0, LINGER_MS - (now - card.exitAt)));

    let el = $state<HTMLElement>();
</script>

<div bind:this={el} class="p-card" use:swipeDown={{ moving: el, onDone: () => app.dismissCard() }}>
    <div class="card-head">
        <span class="card-status" class:is-left={!inside}>
            <span class="pulse" aria-hidden="true"></span>
            <span>{inside ? app.t('nearYou') : app.t('leftBehind')}</span>
        </span>
        <Distance {app} poi={card.poi} />
        <button class="icon-btn" type="button" aria-label={app.t('dismiss')} onclick={() => app.dismissCard()}>
            {@html ICONS.closeBold}
        </button>
    </div>
    <h2 class="card-title" lang={tx.lang}>{tx.title}</h2>
    {#if tx.lang !== app.lang}<span class="badge-es">{app.t('onlyInSpanish')}</span>{/if}
    <div class="card-actions">
        {#if app.narrator.available}
            <button class="btn-listen" type="button" onclick={() => app.listen(card.poi)}>
                {@html ICONS.play}<span>{heard ? app.t('listenAgain') : app.t('listen')}</span>
            </button>
        {/if}
        <button class="btn-dark" class:wide={!app.narrator.available} type="button" onclick={() => app.openSheet(card.poi)}>
            {@html ICONS.text}<span>{app.t('read')}</span>
        </button>
    </div>
    {#if !inside}
        <div class="linger">
            <div class="linger-track" aria-hidden="true"><i style="width: {(left / LINGER_MS) * 100}%"></i></div>
            <span>{app.t('closesIn', { n: Math.ceil(left / 1000) })}</span>
        </div>
    {/if}
</div>
