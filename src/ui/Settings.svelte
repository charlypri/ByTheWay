<script lang="ts">
    import { tick } from 'svelte';
    import type { App } from '../app/app.svelte';
    import type { Lang } from '../lib/kml';
    import type { VoiceOption } from '../lib/narrator';
    import { ICONS } from './icons';

    let { app, onClose }: { app: App; onClose: () => void } = $props();

    let confirming = $state(false);
    let closeBtn = $state<HTMLButtonElement>();
    let cancelBtn = $state<HTMLButtonElement>();
    let startOverBtn = $state<HTMLButtonElement>();
    /** Las voces llegan tarde en algunos navegadores. */
    let voicesVersion = $state(0);

    const LANGS: { lang: Lang; label: string }[] = [
        { lang: 'es', label: 'Español' },
        { lang: 'en', label: 'English' },
    ];

    $effect(() => app.narrator.on('voices', () => voicesVersion++));
    $effect(() => {
        void tick().then(() => closeBtn?.focus({ preventScroll: true }));
    });

    const voices = $derived.by(() => {
        void voicesVersion;
        return app.narrator.voicesFor(app.lang);
    });
    const current = $derived.by(() => {
        void voicesVersion;
        return app.narrator.voiceFor(app.lang)?.id ?? '';
    });

    /** "Microsoft Helena - Spanish (Spain)" → "Microsoft Helena · España". */
    function voiceName(v: VoiceOption) {
        const base = v.name.replace(/\s+[-–]\s+[^-–]*$/, '').trim() || v.name;
        const region = v.lang.replace('_', '-').split('-')[1];
        let place = '';
        try {
            if (region) place = new Intl.DisplayNames([app.lang], { type: 'region' }).of(region.toUpperCase()) ?? '';
        } catch {
            place = region;
        }
        return place && !base.includes(place) ? `${base} · ${place}` : base;
    }

    function openConfirm() {
        confirming = true;
        void tick().then(() => cancelBtn?.focus({ preventScroll: true }));
    }

    function closeConfirm() {
        confirming = false;
        void tick().then(() => startOverBtn?.focus({ preventScroll: true }));
    }

    function confirmStartOver() {
        app.startOver();
        confirming = false;
        onClose();
    }

    function onKey(e: KeyboardEvent) {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        if (confirming) closeConfirm();
        else onClose();
    }
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions: Escape cierra con teclado -->
<div class="scrim" onclick={() => (confirming ? closeConfirm() : onClose())}></div>

<div class="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" inert={confirming}>
    <div class="settings-top">
        <h2 id="settings-title">{app.t('settings')}</h2>
        <button bind:this={closeBtn} class="icon-btn" type="button" aria-label={app.t('close')} onclick={onClose}>{@html ICONS.closeBold}</button>
    </div>
    <div class="set-row">
        <span class="set-label" id="lang-label">{app.t('language')}</span>
        <div class="seg" role="group" aria-labelledby="lang-label">
            {#each LANGS as l (l.lang)}
                <button type="button" lang={l.lang} aria-pressed={app.lang === l.lang} onclick={() => app.setLang(l.lang)}>{l.label}</button>
            {/each}
        </div>
    </div>
    <div class="set-row">
        <label class="set-label" for="voice-select">{app.t('voice')}</label>
        <span class="set-hint" id="voice-hint">{app.t('voiceHint')}</span>
        <div class="select-wrap">
            {#if voices.length}
                <select id="voice-select" aria-describedby="voice-hint" value={current} onchange={(e) => app.setVoice(e.currentTarget.value)}>
                    {#each voices as v, i (v.id)}
                        <option value={v.id}>{i === 0 ? app.t('voiceBest', { v: voiceName(v) }) : voiceName(v)}</option>
                    {/each}
                </select>
            {:else}
                <select id="voice-select" aria-describedby="voice-hint" disabled><option>{app.t('noVoices')}</option></select>
            {/if}
            {@html ICONS.chevronDown}
        </div>
    </div>
    <div class="set-row">
        <span class="set-label">{app.t('pocket')}</span>
        <span class="set-hint">{app.t('pocketHint')}</span>
        <button class="btn-wide" type="button" onclick={() => app.setPocket(true)}>{app.t('pocketOn')}</button>
    </div>
    <div class="set-row">
        <span class="set-label">{app.t('startOver')}</span>
        <span class="set-hint">{app.t('startOverHint')}</span>
        <button bind:this={startOverBtn} class="btn-wide btn-outline" type="button" onclick={openConfirm}>{app.t('startOver')}</button>
    </div>
</div>

{#if confirming}
    <div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
        <h2 id="confirm-title" class="confirm-title">{app.t('startOverAsk')}</h2>
        <p id="confirm-text" class="confirm-text">{app.t('startOverConfirm')}</p>
        <!-- La acción arriba y Cancelar abajo, donde cae el pulgar; el foco empieza en Cancelar. -->
        <div class="confirm-actions">
            <button bind:this={cancelBtn} class="btn-dark" type="button" onclick={closeConfirm}>{app.t('cancel')}</button>
            <button class="btn-wide" type="button" onclick={confirmStartOver}>{app.t('startOver')}</button>
        </div>
    </div>
{/if}
