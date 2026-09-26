import { describe, expect, it } from 'vitest';
import { formatDistance, paragraphs, t } from './i18n';

describe('t', () => {
    it('da el texto en cada idioma y rellena sus huecos', () => {
        expect(t('es', 'listen')).toBe('Escuchar');
        expect(t('en', 'listen')).toBe('Listen');
        expect(t('es', 'sentence', { i: 2, n: 9 })).toBe('Frase 2 de 9');
        expect(t('en', 'distance', { d: '120 m' })).toBe('120 m away');
    });

    it('usa los textos de la especificación', () => {
        expect(['start', 'listen', 'pause', 'resume', 'stop', 'recenter', 'next', 'heard', 'onlyInSpanish', 'pocket', 'startOver'].map((k) => t('es', k as never))).toEqual([
            'Empezar',
            'Escuchar',
            'Pausar',
            'Seguir',
            'Parar',
            'Recentrar',
            'A continuación',
            'Escuchado',
            'Solo en castellano',
            'Modo bolsillo',
            'Empezar de cero',
        ]);
    });
});

describe('formatDistance', () => {
    it('redondea a 5 m por debajo de 1 km', () => {
        expect(formatDistance(3, 'es')).toBe('5 m');
        expect(formatDistance(122, 'es')).toBe('120 m');
        expect(formatDistance(998, 'en')).toBe('1 km');
    });

    it('usa un decimal con el separador de cada idioma por encima de 1 km', () => {
        expect(formatDistance(1234, 'es')).toBe('1,2 km');
        expect(formatDistance(1234, 'en')).toBe('1.2 km');
        expect(formatDistance(15000, 'es')).toBe('15 km');
    });
});

describe('paragraphs', () => {
    it('parte la Descripción en párrafos solo para mostrarla', () => {
        expect(paragraphs('Uno.\n\nDos.\nTres.\n\n\nPor cierto, cuatro.')).toEqual(['Uno.', 'Dos.', 'Tres.', 'Por cierto, cuatro.']);
        expect(paragraphs('')).toEqual([]);
    });
});
