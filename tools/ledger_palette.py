"""Converte as cores literais dos CSS para a paleta Ledger (v9).

Regra: neutros frios (ardósia/marinho) viram cinza puro com a mesma luminosidade;
o azul de marca vira tinta (preto no claro, cinza no escuro); ciano e azuis de
gráfico viram cinza; verde, âmbar, laranja e vermelho (cores de estado) ficam.
O tema de cada cor vem do contexto: blocos com data-theme="dark" usam o mapa escuro.

Uso: python3 tools/ledger_palette.py app/styles/*.css   (reescreve no lugar; idempotente)
"""
import re
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from theme_tokens import COLOR_RE, fmt, oklch_to_rgb, parse_color, rgb_to_oklch  # noqa: E402

INK_LIGHT = (20, 20, 20)  # #141414
INK_DARK_TEXT = (237, 237, 237)  # #ededed
INK_DARK_FILL = (92, 92, 92)  # #5c5c5c: barra/botão no escuro, texto branco legível


def gray(L):
    return oklch_to_rgb(L, 0, 0)


def convert(tok, prop, dark):
    rgb, a = parse_color(tok)
    if tok.strip().lower() in ("white", "black"):
        return tok
    L, C, H = rgb_to_oklch(*rgb)
    cool = 180 <= H <= 300
    if C < 0.006 or not (cool or C < 0.045):
        return tok  # já neutro, ou cor de estado (verde, âmbar, vermelho...)
    p = prop.lower()
    is_bg = p.startswith("background") or p in ("fill", "stop-color") or "-bg" in p or "soft" in p
    is_bd = p.startswith(("border", "outline")) or "line" in p
    brand = cool and C >= 0.11 and 235 <= H <= 275
    if brand and a >= 0.55:
        if not dark:
            return fmt(INK_LIGHT, a)
        if is_bg:
            return fmt(INK_DARK_FILL, a)
        return fmt(INK_DARK_TEXT if not is_bd else (190, 190, 190), a)
    if brand:  # véus translúcidos de marca
        return fmt((255, 255, 255) if dark else (0, 0, 0), round(a * 0.6, 3))
    return fmt(gray(L), a)


def process(css):
    out, pos = [], 0
    for m in re.finditer(r"([^{}]*)\{([^{}]*)\}", css):
        sel, body = m.group(1), m.group(2)
        dark = 'data-theme="dark"' in sel or "data-theme='dark'" in sel

        def decl(d):
            mm = re.match(r"(\s*(?:/\*.*?\*/\s*)*)([-a-zA-Z0-9_]+)(\s*:)(.*)$", d, re.S)
            if not mm:
                return d
            ws, prop, colon, val = mm.groups()
            return ws + prop + colon + COLOR_RE.sub(lambda c: convert(c.group(1), prop, dark), val)

        out.append(css[pos : m.start()])
        out.append(sel + "{" + ";".join(decl(d) for d in body.split(";")) + "}")
        pos = m.end()
    out.append(css[pos:])
    return "".join(out)


if __name__ == "__main__":
    for path in sys.argv[1:]:
        src = open(path, encoding="utf-8").read()
        open(path, "w", encoding="utf-8").write(process(src))
