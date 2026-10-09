"""Gera tokens de cor claro/escuro a partir de um CSS legado.

Substitui cada cor literal por var(--c-<papel>-<hex>) e emite o valor
claro (idêntico ao original) e um valor escuro calculado em OKLCH,
conforme o papel da cor (texto, fundo, borda, destaque).
Uso: python3 tools/theme_tokens.py entrada.css saida.css tokens.css
"""
import re, sys, math

def srgb_to_lin(c):
    return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def lin_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return 12.92*c if c <= 0.0031308 else 1.055*c**(1/2.4)-0.055
def rgb_to_oklch(r, g, b):
    r, g, b = (srgb_to_lin(x/255) for x in (r, g, b))
    l = 0.4122214708*r + 0.5363325363*g + 0.0514459929*b
    m = 0.2119034982*r + 0.6806995451*g + 0.1073969566*b
    s = 0.0883024619*r + 0.2817188376*g + 0.6299787005*b
    l, m, s = (math.copysign(abs(x)**(1/3), x) for x in (l, m, s))
    L = 0.2104542553*l + 0.7936177850*m - 0.0040720468*s
    A = 1.9779984951*l - 2.4285922050*m + 0.4505937099*s
    B = 0.0259040371*l + 0.7827717662*m - 0.8086757660*s
    C = math.hypot(A, B); H = math.degrees(math.atan2(B, A)) % 360
    return L, C, H
def oklch_to_rgb(L, C, H):
    for _ in range(40):  # reduz croma até caber no gamut sRGB
        a = C*math.cos(math.radians(H)); b = C*math.sin(math.radians(H))
        l = L + 0.3963377774*a + 0.2158037573*b
        m = L - 0.1055613458*a - 0.0638541728*b
        s = L - 0.0894841775*a - 1.2914855480*b
        l, m, s = l**3, m**3, s**3
        r = 4.0767416621*l - 3.3077115913*m + 0.2309699292*s
        g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
        bb = -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
        if all(-0.001 <= x <= 1.001 for x in (r, g, bb)):
            break
        C *= 0.92
    return tuple(round(lin_to_srgb(x)*255) for x in (r, g, bb))

def lerp_map(x, pts):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return y0 + (y1-y0)*(x-x0)/(x1-x0) if x1 != x0 else y0
    return pts[0][1] if x < pts[0][0] else pts[-1][1]

NAVY_H = 262  # matiz base dos neutros escuros (azul-ardósia)

def dark_of(rgb, alpha, role):
    L, C, H = rgb_to_oklch(*rgb)
    chromatic = C >= 0.06
    if role == "fg":
        if L > 0.80 and not (chromatic and L < 0.9):
            return rgb, alpha            # texto claro já está sobre fundo escuro
        if chromatic:
            nl = max(0.70, min(0.86, 1.30 - L)); nc = min(C, 0.16)
            return oklch_to_rgb(nl, nc, H), alpha
        nl = lerp_map(L, [(0.0, 0.97), (0.21, 0.94), (0.30, 0.88), (0.38, 0.81), (0.46, 0.74), (0.56, 0.67), (0.71, 0.58), (0.80, 0.52)])
        return oklch_to_rgb(nl, min(C, 0.02) + 0.006, NAVY_H if C < 0.02 else H), alpha
    if role == "bg":
        if alpha < 0.55 and (L > 0.9 or L < 0.35):
            return rgb, alpha            # sobreposições translúcidas
        if alpha < 0.55 and chromatic:
            return rgb, min(1, alpha*1.6)
        if chromatic and L < 0.82:
            return oklch_to_rgb(min(L+0.03, 0.72), C, H), alpha   # botões e barras sólidas
        if L < 0.42:
            return oklch_to_rgb(lerp_map(L, [(0, 0.15), (0.42, 0.26)]), 0.025, NAVY_H), alpha
        if C >= 0.012 and L >= 0.8:     # tons suaves semânticos (azul-50, verde-50...)
            return oklch_to_rgb(0.27 + (1-L)*0.25, min(0.075, C*2.2 + 0.02), H), alpha
        if L >= 0.999:
            return oklch_to_rgb(0.215, 0.03, NAVY_H), alpha        # cartão
        if L >= 0.975:
            return oklch_to_rgb(0.18, 0.028, NAVY_H), alpha         # fundo de página / poço
        nl = lerp_map(L, [(0.42, 0.40), (0.8, 0.33), (0.93, 0.285), (0.975, 0.25)])
        return oklch_to_rgb(nl, 0.03, NAVY_H), alpha
    if role == "bd":
        if alpha < 0.55 and (L > 0.9 or L < 0.35):
            return rgb, alpha
        if chromatic and L < 0.8:
            return oklch_to_rgb(min(L+0.06, 0.74), C, H), alpha
        if C >= 0.02 and L >= 0.8:
            return oklch_to_rgb(0.42, min(0.09, C*2.5), H), alpha
        if L < 0.4:
            return oklch_to_rgb(0.34, 0.02, NAVY_H), alpha
        nl = lerp_map(L, [(0.4, 0.42), (0.75, 0.40), (0.9, 0.33), (1.0, 0.29)])
        return oklch_to_rgb(nl, 0.03, NAVY_H), alpha
    if role == "accent":
        if chromatic:
            return oklch_to_rgb(min(L+0.06, 0.78) if L < 0.72 else L, C, H), alpha
        return dark_of(rgb, alpha, "fg")
    if role == "shadow":
        return (0, 0, 0), min(1, alpha*2.2 + 0.08)
    return rgb, alpha

BG_PROPS = {"background", "background-color", "background-image"}
BD_PROPS_PREFIX = ("border", "outline", "column-rule", "text-decoration")
FG_PROPS = {"color", "caret-color", "-webkit-text-fill-color", "accent-color"}

def role_for_prop(prop, rgb):
    p = prop.lower()
    if p.startswith("--"):
        n = p
        if any(k in n for k in ("shadow",)): return "shadow"
        if any(k in n for k in ("-bg", "soft", "canvas", "surface", "mint", "blue-soft")): return "bg"
        if any(k in n for k in ("line", "border", "grid")): return "bd"
        if any(k in n for k in ("ink", "muted", "navy", "slate", "-bad", "-ok", "-warn", "critical", "serious", "watch", "amber", "red", "success", "danger", "warning")): return "fg"
        return "accent"
    if p in BG_PROPS or p.startswith("background"): return "bg"
    if p.startswith(BD_PROPS_PREFIX): return "bd"
    if p in FG_PROPS: return "fg"
    if p in ("box-shadow", "text-shadow", "filter"): return "shadow"
    if p in ("fill", "stroke", "stop-color", "flood-color"):
        L, C, H = rgb_to_oklch(*rgb)
        if C >= 0.06: return "accent"
        if p == "stroke": return "bd"
        return "fg" if L < 0.8 else "bg"
    return "accent"

HEX = r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b"
RGB = r"rgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)"
KW = r"(?<![\w-])(?:white|black)(?![\w-])"
COLOR_RE = re.compile(f"({HEX}|{RGB}|{KW})")

def parse_color(tok):
    t = tok.strip().lower()
    if t == "white": return (255, 255, 255), 1.0
    if t == "black": return (0, 0, 0), 1.0
    if t.startswith("#"):
        h = t[1:]
        if len(h) in (3, 4): h = "".join(c*2 for c in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16)/255 if len(h) == 8 else 1.0
        return (r, g, b), a
    nums = re.findall(r"[\d.]+%?", t)
    vals = []
    for i, n in enumerate(nums):
        if n.endswith("%"):
            v = float(n[:-1]); vals.append(v/100 if i == 3 else v*2.55)
        else:
            vals.append(float(n))
    r, g, b = (round(v) for v in vals[:3])
    a = vals[3] if len(vals) > 3 else 1.0
    return (r, g, b), a

def fmt(rgb, a):
    if a >= 0.999: return "#%02x%02x%02x" % rgb
    return "rgba(%d, %d, %d, %s)" % (*rgb, ("%.3f" % a).rstrip("0").rstrip("."))

tokens = {}  # nome -> (claro, escuro)

def token_for(tok, prop):
    rgb, a = parse_color(tok)
    role = role_for_prop(prop, rgb)
    if role == "shadow":
        return tok   # sombras ficam como estão (tratadas no tema)
    light = fmt(rgb, a)
    drgb, da = dark_of(rgb, a, role)
    dark = fmt(drgb, da)
    if light == dark:
        return tok
    key = "%02x%02x%02x" % rgb + ("" if a >= 0.999 else "a%02d" % round(a*100))
    name = f"--c-{role}-{key}"
    tokens[name] = (light, dark)
    return f"var({name})"

def process_body(body):
    out, i, n = [], 0, len(body)
    # separa declarações respeitando parênteses e aspas
    decls, cur, depth, q = [], "", 0, None
    for ch in body:
        if q:
            cur += ch
            if ch == q: q = None
            continue
        if ch in "\"'": q = ch; cur += ch; continue
        if ch == "(": depth += 1
        if ch == ")": depth -= 1
        if ch == ";" and depth == 0:
            decls.append(cur); cur = ""; continue
        cur += ch
    decls.append(cur)
    res = []
    for d in decls:
        m = re.match(r"(\s*)([-a-zA-Z0-9_]+)(\s*:)(.*)$", d, re.S)
        if not m:
            res.append(d); continue
        ws, prop, colon, val = m.groups()
        val2 = COLOR_RE.sub(lambda mm: token_for(mm.group(1), prop), val)
        res.append(ws + prop + colon + val2)
    return ";".join(res)

def main(src, dst, tok_out):
    css = open(src, encoding="utf-8").read()
    css = re.sub(r"\{([^{}]*)\}", lambda m: "{" + process_body(m.group(1)) + "}", css)
    open(dst, "w", encoding="utf-8").write(css)
    light = "\n".join(f"  {k}: {v[0]};" for k, v in sorted(tokens.items()))
    dark = "\n".join(f"  {k}: {v[1]};" for k, v in sorted(tokens.items()))
    open(tok_out, "w", encoding="utf-8").write(
        "/* Gerado por tools/theme_tokens.py — não editar à mão. */\n"
        ":root {\n" + light + "\n}\n\n:root[data-theme=\"dark\"] {\n" + dark + "\n}\n")
    print(len(tokens), "tokens")

if __name__ == "__main__":
    main(*sys.argv[1:4])
