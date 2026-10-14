"""
Gera a narração do vídeo "Missão STRATO" com a API do ElevenLabs (voz mais natural que o TTS local).

Uso:
  ELEVENLABS_API_KEY=... python scripts/gerar_narracao_elevenlabs.py [voice_id]
Sem voice_id, usa ELEVENLABS_VOICE_ID ou, na falta, lista as vozes da conta e para.
Requer acesso de rede a api.elevenlabs.io. Dependência: só a biblioteca padrão + ffprobe.

Lê narration/missao.json, grava public/missao/narr_<id>.mp3 e src/missao/timing.json.
Cada trecho é pedido com o texto anterior e o seguinte como contexto, para a entonação fluir entre as cenas.
Depois rode scripts/gerar_trilha.py para realinhar a trilha ao novo tempo.
"""
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.elevenlabs.io/v1"
MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")


def request(path: str, body: dict | None = None) -> bytes:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    return round(float(out.stdout.strip()), 3)


def main() -> None:
    voice = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ELEVENLABS_VOICE_ID")
    if not voice:
        voices = json.loads(request("/voices"))["voices"]
        for v in voices:
            labels = v.get("labels") or {}
            print(f"{v['voice_id']}  {v['name']:<24} {labels.get('gender', '')} {labels.get('accent', '')}")
        print("\nEscolha um voice_id e rode de novo: python scripts/gerar_narracao_elevenlabs.py <voice_id>")
        return
    script = json.loads((ROOT / "narration/missao.json").read_text(encoding="utf-8"))
    segments = script["segments"]
    out_dir = ROOT / "public/missao"
    out_dir.mkdir(parents=True, exist_ok=True)
    timing = {}
    for i, seg in enumerate(segments):
        body = {
            "text": seg["text"],
            "model_id": MODEL,
            "previous_text": segments[i - 1]["text"] if i > 0 else None,
            "next_text": segments[i + 1]["text"] if i + 1 < len(segments) else None,
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.25, "use_speaker_boost": True},
        }
        if "v2_5" in MODEL:
            body["language_code"] = "pt"  # só os modelos 2.5 aceitam forçar o idioma
        audio = request(f"/text-to-speech/{voice}?output_format=mp3_44100_128", body)
        mp3 = out_dir / f"narr_{seg['id']}.mp3"
        mp3.write_bytes(audio)
        timing[seg["id"]] = duration(mp3)
        print(f"{seg['id']:<12} {timing[seg['id']]:6.2f}s")
    (ROOT / "src/missao/timing.json").write_text(json.dumps(timing, indent=2) + "\n", encoding="utf-8")
    print(f"total {sum(timing.values()):.1f}s")


if __name__ == "__main__":
    main()
