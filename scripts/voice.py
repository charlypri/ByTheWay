"""Genera con edge-tts los audios que pide scripts/voice.mjs.

Uso: python scripts/voice.py <voz> <carpeta> < lista.json
La lista es [{"text": ..., "file": ...}]. Sale con 1 si alguno falla.
"""

import asyncio
import json
import os
import sys

import edge_tts

CONCURRENCY = 6
RETRIES = 3


async def generate(voice: str, out: str, clip: dict, gate: asyncio.Semaphore) -> bool:
    path = os.path.join(out, clip["file"])
    async with gate:
        for attempt in range(RETRIES):
            try:
                # Se escribe aparte y se renombra: un audio a medias nunca queda con su nombre final.
                await edge_tts.Communicate(clip["text"], voice).save(path + ".part")
                os.replace(path + ".part", path)
                return True
            except Exception as error:  # noqa: BLE001 - cualquier fallo del servicio se reintenta
                if attempt == RETRIES - 1:
                    print(f"Falló «{clip['text'][:60]}»: {error}", file=sys.stderr)
                await asyncio.sleep(2 ** attempt)
    return False


async def main() -> int:
    voice, out = sys.argv[1], sys.argv[2]
    clips = json.load(sys.stdin)
    gate = asyncio.Semaphore(CONCURRENCY)
    done = await asyncio.gather(*(generate(voice, out, c, gate) for c in clips))
    print(f"Generados {sum(done)} de {len(clips)}.")
    return 0 if all(done) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
