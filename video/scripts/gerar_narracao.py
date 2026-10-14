"""
Gera a narração do vídeo "Missão STRATO" com o Kokoro (TTS neural local, voz em português do Brasil).

Uso:
  python scripts/gerar_narracao.py <pasta_do_modelo>
A pasta do modelo precisa conter kokoro-v1.0.onnx e voices-v1.0.bin
(github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0).
Dependências: pip install kokoro-onnx soundfile numpy

Lê narration/missao.json, grava public/missao/narr_<id>.mp3 e src/missao/timing.json (duração de cada trecho).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent


def trim(samples: np.ndarray, sr: int, threshold: float = 0.01) -> np.ndarray:
    """Remove silêncio do início e do fim, preservando 60 ms de respiro."""
    loud = np.where(np.abs(samples) > threshold)[0]
    if not len(loud):
        return samples
    pad = int(sr * 0.06)
    return samples[max(0, loud[0] - pad) : min(len(samples), loud[-1] + pad)]


def main() -> None:
    model_dir = Path(sys.argv[1])
    script = json.loads((ROOT / "narration/missao.json").read_text(encoding="utf-8"))
    voice = sys.argv[2] if len(sys.argv) > 2 else script["voice"]
    kokoro = Kokoro(str(model_dir / "kokoro-v1.0.onnx"), str(model_dir / "voices-v1.0.bin"))
    out_dir = ROOT / "public/missao"
    out_dir.mkdir(parents=True, exist_ok=True)
    timing = {}
    for segment in script["segments"]:
        samples, sr = kokoro.create(segment["text"], voice=voice, speed=script["speed"], lang="pt-br")
        samples = trim(samples, sr)
        wav = out_dir / f"narr_{segment['id']}.wav"
        sf.write(wav, samples, sr)
        mp3 = wav.with_suffix(".mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-b:a", "128k", str(mp3)], check=True
        )
        wav.unlink()
        timing[segment["id"]] = round(len(samples) / sr, 3)
        print(f"{segment['id']:<12} {timing[segment['id']]:6.2f}s")
    (ROOT / "src/missao/timing.json").write_text(json.dumps(timing, indent=2) + "\n", encoding="utf-8")
    print(f"total {sum(timing.values()):.1f}s")


if __name__ == "__main__":
    main()
