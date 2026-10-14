"""
Compõe a trilha original do vídeo "Missão STRATO" (sem samples de terceiros) e os efeitos sonoros.

Uso: python scripts/gerar_trilha.py
Dependências: pip install numpy soundfile scipy

Lê src/missao/timing.json para alinhar as seções da música às cenas (mesmas regras de src/missao/timeline.ts)
e grava public/missao/trilha.mp3, click.wav e whoosh.wav.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4

# Mesmas regras de src/missao/timeline.ts
LEAD, TAIL, END_EXTRA = 0.6, 0.9, 3.0
ORDER = ["abertura", "problema", "mercado", "missao", "entrada", "esteira", "excecao", "copiloto", "carteira", "trilha", "fechamento"]


def scene_starts(timing: dict) -> tuple[dict, float]:
    t, starts = 0.0, {}
    for i, key in enumerate(ORDER):
        starts[key] = t
        t += LEAD + timing[key] + TAIL + (END_EXTRA if i == len(ORDER) - 1 else 0)
    return starts, t


def note(n: str) -> float:
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    name, octave = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((names[name] + 12 * (octave + 1) - 69) / 12)


def lowpass(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "low", fs=SR, output="sos"), x)


def highpass(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "high", fs=SR, output="sos"), x)


def adsr(n, a, r):
    env = np.ones(n)
    ai, ri = int(a * SR), int(r * SR)
    if ai:
        env[:ai] = np.linspace(0, 1, ai)
    if ri:
        env[-ri:] *= np.linspace(1, 0, ri)
    return env


def saw(freq, t):
    return 2 * ((freq * t) % 1) - 1


# Progressão em lá menor: Am – F – C – G (2 compassos cada)
CHORDS = [
    ("A2", ["A3", "C4", "E4"], ["A4", "C5", "E5", "C5"]),
    ("F2", ["F3", "A3", "C4"], ["F4", "A4", "C5", "A4"]),
    ("C3", ["C4", "E4", "G4"], ["C5", "E5", "G5", "E5"]),
    ("G2", ["G3", "B3", "D4"], ["G4", "B4", "D5", "B4"]),
]


def main() -> None:
    timing = json.loads((ROOT / "src/missao/timing.json").read_text())
    starts, total = scene_starts(timing)
    n = int(total * SR)
    t_all = np.arange(n) / SR
    pad = np.zeros(n)
    bass = np.zeros(n)
    arp = np.zeros(n)
    drums = np.zeros(n)

    # Seções: tensão (abertura/problema), construção (mercado), virada (missão em diante), respiro final.
    s_build = starts["mercado"]
    s_drop = starts["missao"]
    s_outro = starts["fechamento"]

    chord_len = BAR * 2
    k = 0
    t0 = 0.0
    while t0 < total:
        root, triad, arp_notes = CHORDS[k % 4]
        i0, i1 = int(t0 * SR), min(n, int((t0 + chord_len) * SR))
        seg_t = np.arange(i1 - i0) / SR
        # Pad: três dentes-de-serra levemente desafinados por nota, filtrado
        voice = np.zeros(i1 - i0)
        for nm in triad:
            f = note(nm)
            for det in (-0.12, 0.0, 0.12):
                voice += saw(f * 2 ** (det / 12), seg_t + t0)
        pad[i0:i1] += voice * adsr(i1 - i0, 0.8, 0.9) * 0.05
        # Baixo: colcheias pulsantes a partir da construção
        if t0 >= s_build - 0.01:
            fb = note(root)
            step = BEAT / 2
            for j in range(int(chord_len / step)):
                b0 = i0 + int(j * step * SR)
                b1 = min(n, b0 + int(step * SR))
                bt = np.arange(b1 - b0) / SR
                env = np.exp(-bt * 7)
                bass[b0:b1] += (np.sin(2 * np.pi * fb * bt) + 0.3 * np.sin(2 * np.pi * fb * 2 * bt)) * env * 0.22
        # Arpejo: semicolcheias com decaimento, desde o início, mais brilhante após a virada
        step = BEAT / 4
        for j in range(int(chord_len / step)):
            a0 = i0 + int(j * step * SR)
            a1 = min(n, a0 + int(step * 1.6 * SR))
            at = np.arange(a1 - a0) / SR
            f = note(arp_notes[j % 4]) * (2 if (t0 >= s_drop and j % 8 == 7) else 1)
            tri = 2 * np.abs(2 * ((f * at) % 1) - 1) - 1
            vol = 0.035 if t0 < s_drop else 0.05
            arp[a0:a1] += tri * np.exp(-at * 9) * vol
        t0 += chord_len
        k += 1

    # Bateria: bumbo e chimbal a partir da virada; chimbal leve na construção
    def kick(at):
        f = 120 * np.exp(-at * 18) + 45
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-at * 7)

    rng = np.random.default_rng(7)
    hat_noise = highpass(rng.standard_normal(int(0.08 * SR)), 7000)
    clap_noise = lowpass(highpass(rng.standard_normal(int(0.2 * SR)), 900), 5000)
    beat_t = 0.0
    b = 0
    while beat_t < total:
        i0 = int(beat_t * SR)
        if s_drop <= beat_t < s_outro:
            if b % 4 in (0, 2) or (b % 8 == 7):
                seg = kick(np.arange(int(0.45 * SR)) / SR)
                drums[i0 : i0 + len(seg)] += seg[: max(0, n - i0)] * 0.55
            if b % 4 in (1, 3):
                env = np.exp(-np.arange(len(clap_noise)) / SR * 22)
                drums[i0 : i0 + len(clap_noise)] += (clap_noise * env)[: max(0, n - i0)] * 0.06
        if s_build <= beat_t < s_outro:
            h0 = i0 + int(BEAT / 2 * SR)
            env = np.exp(-np.arange(len(hat_noise)) / SR * 60)
            vol = 0.05 if beat_t >= s_drop else 0.03
            drums[h0 : h0 + len(hat_noise)] += (hat_noise * env)[: max(0, n - h0)] * vol
        beat_t += BEAT
        b += 1

    # Riser antes da virada
    r_len = int(BAR * SR)
    r0 = max(0, int(s_drop * SR) - r_len)
    rt = np.arange(r_len) / SR
    riser = highpass(rng.standard_normal(r_len), 1500) * (rt / rt[-1]) ** 2 * 0.06
    drums[r0 : r0 + r_len] += riser[: n - r0]

    # Abertura do filtro do pad ao longo da música
    pad = lowpass(pad, 1400)
    mix = pad + bass + lowpass(arp, 5200) + drums
    # Fade de entrada e saída
    fade_in = int(1.2 * SR)
    fade_out = int(4.0 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in)
    mix[-fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
    mix = np.tanh(mix * 1.4) / np.tanh(1.4)
    mix /= max(1e-9, np.max(np.abs(mix))) / 0.85
    stereo = np.stack([mix, np.roll(mix, int(0.012 * SR)) * 0.96], axis=1)

    out = ROOT / "public/missao"
    wav = out / "trilha.wav"
    sf.write(wav, stereo, SR)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "192k", str(out / "trilha.mp3")], check=True)
    wav.unlink()

    # Efeitos: clique de mouse e "whoosh" de transição
    ct = np.arange(int(0.05 * SR)) / SR
    click = highpass(rng.standard_normal(len(ct)), 2500) * np.exp(-ct * 160) * 0.5 + np.sin(2 * np.pi * 1800 * ct) * np.exp(
        -ct * 120
    ) * 0.25
    sf.write(out / "click.wav", click, SR)
    wt = np.arange(int(0.7 * SR)) / SR
    noise = rng.standard_normal(len(wt))
    sweep = np.zeros_like(noise)
    for i, cutoff in enumerate(np.linspace(400, 6000, 8)):
        part = slice(i * len(wt) // 8, (i + 1) * len(wt) // 8)
        sweep[part] = lowpass(noise, cutoff)[part]
    whoosh = sweep * np.sin(np.pi * wt / wt[-1]) ** 2 * 0.35
    sf.write(out / "whoosh.wav", whoosh, SR)
    print(f"trilha {total:.1f}s · virada em {s_drop:.1f}s")


if __name__ == "__main__":
    main()
