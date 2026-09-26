<script lang="ts">
    const base = import.meta.env.BASE_URL;
</script>

<main>
    <h1>by the way<span>.</span></h1>
    <p class="lede">La guía que te cuenta lo que no ves al pasar. La versión 0.1.0 está en construcción.</p>
    <nav>
        <a href="{base}mocks/">Ver las propuestas de diseño</a>
        <a href="{base}probe/voz/">Probar la voz en este móvil</a>
    </nav>
</main>

<style>
    main {
        max-width: 34rem;
        margin: 0 auto;
        padding: 18vh 24px 48px;
    }
    h1 {
        font: 800 clamp(2.6rem, 11vw, 4rem) / 0.95 var(--font-display);
        letter-spacing: -0.03em;
        margin: 0 0 20px;
    }
    h1 span { color: var(--accent); }
    .lede { color: var(--muted); max-width: 26rem; margin: 0 0 40px; }
    nav { display: grid; gap: 12px; }
    a {
        display: block;
        padding: 16px 18px;
        border: 1px solid var(--line);
        border-radius: 14px;
        color: var(--ink);
        text-decoration: none;
        font: 700 1.05rem var(--font-display);
    }
    a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
</style>
