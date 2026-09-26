/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly TOMTOM_API_KEY: string;
}

/** Versión y commit del build (vite.config.ts). */
declare const __BUILD__: string;
