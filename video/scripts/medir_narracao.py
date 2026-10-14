"""
Atualiza src/missao/timing.json a partir dos MP3 em public/missao/narr_<id>.mp3 (ex.: gravados no ElevenLabs).
Remove silêncio do início e do fim de cada arquivo antes de medir.

Uso: python scripts/medir_narracao.py   (só precisa do ffmpeg)
Depois: python scripts/gerar_trilha.py && npm run render:missao
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    script = json.loads((ROOT / "narration/missao.json").read_text(encoding="utf-8"))
    timing = {}
    for seg in script["segments"]:
        mp3 = ROOT / f"public/missao/narr_{seg['id']}.mp3"
        tmp = mp3.with_suffix(".trim.mp3")
        trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-af", trim, "-b:a", "192k", str(tmp)], check=True)
        tmp.replace(mp3)
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)],
            capture_output=True, text=True, check=True,
        )
        timing[seg["id"]] = round(float(out.stdout.strip()), 3)
        print(f"{seg['id']:<12} {timing[seg['id']]:6.2f}s")
    (ROOT / "src/missao/timing.json").write_text(json.dumps(timing, indent=2) + "\n", encoding="utf-8")
    print(f"total {sum(timing.values()):.1f}s")


if __name__ == "__main__":
    main()
