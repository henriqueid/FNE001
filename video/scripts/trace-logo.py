"""Vetoriza public/strato-logo.png em caminhos SVG (contornos externos e furos) para animar a construção da marca.

Segue as arestas entre pixels dentro/fora (crack following), fecha os laços, simplifica com
Ramer-Douglas-Peucker e grava src/novo/logo-paths.json: {width, height, parts:[{id, d, bbox}]}.
"""
import json
import sys

sys.setrecursionlimit(100000)
from collections import defaultdict

import numpy as np
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else "public/strato-logo.png"
out = sys.argv[2] if len(sys.argv) > 2 else "src/novo/logo-paths.json"
alpha = np.array(Image.open(src).split()[3]) > 127
H, W = alpha.shape

# Componentes conectados (4-vizinhança) por varredura.
labels = np.zeros((H, W), dtype=np.int32)
n = 0
for y in range(H):
    for x in range(W):
        if alpha[y, x] and not labels[y, x]:
            n += 1
            stack = [(y, x)]
            labels[y, x] = n
            while stack:
                cy, cx = stack.pop()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and alpha[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = n
                        stack.append((ny, nx))


def loops_for(mask):
    m = np.pad(mask, 1)
    nxt = defaultdict(list)
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        # Arestas orientadas com o interior à direita.
        if not m[y - 1, x]:
            nxt[(x, y)].append((x + 1, y))
        if not m[y, x + 1]:
            nxt[(x + 1, y)].append((x + 1, y + 1))
        if not m[y + 1, x]:
            nxt[(x + 1, y + 1)].append((x, y + 1))
        if not m[y, x - 1]:
            nxt[(x, y + 1)].append((x, y))
    loops = []
    while nxt:
        start = next(iter(nxt))
        loop = [start]
        cur = start
        while True:
            options = nxt[cur]
            p = options.pop()
            if not options:
                del nxt[cur]
            if p == start:
                break
            loop.append(p)
            cur = p
        loops.append([(px - 1, py - 1) for px, py in loop])
    return loops


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float)
    ab = b - a
    L = np.hypot(*ab) or 1e-9
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / L for p in pts[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > eps:
        return rdp(pts[: i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]


def simplify_loop(loop, eps=1.1):
    k = len(loop) // 2
    return rdp(loop[: k + 1], eps)[:-1] + rdp(loop[k:] + [loop[0]], eps)[:-1]


parts = []
for i in range(1, n + 1):
    mask = labels == i
    if mask.sum() < 200:
        continue
    ys, xs = np.nonzero(mask)
    d = ""
    for loop in loops_for(mask):
        pts = simplify_loop(loop)
        if len(pts) < 3:
            continue
        d += "M" + " L".join(f"{x},{y}" for x, y in pts) + "Z"
    parts.append({"d": d, "bbox": [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]})

parts.sort(key=lambda p: p["bbox"][0])
json.dump({"width": W, "height": H, "parts": parts}, open(out, "w"))
print(n, "componentes;", [p["bbox"] for p in parts])
