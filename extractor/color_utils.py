import math


def hex_to_rgb(hex_str):
    h = hex_str.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def rgb_to_hex(r, g, b):
    return '#' + ''.join(f'{int(round(v)):02X}' for v in (r, g, b))


def rgb_to_hsl(r, g, b):
    r, g, b = r / 255, g / 255, b / 255
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0, l * 100
    d = mx - mn
    s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r:
        h = ((g - b) / d + (6 if g < b else 0)) / 6
    elif mx == g:
        h = ((b - r) / d + 2) / 6
    else:
        h = ((r - g) / d + 4) / 6
    return h * 360, s * 100, l * 100


def color_distance(hex1, hex2):
    r1, g1, b1 = hex_to_rgb(hex1)
    r2, g2, b2 = hex_to_rgb(hex2)
    return math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)


def deduplicate(hexes, threshold=40):
    """Return hexes with near-duplicates removed (keeps first occurrence = highest frequency)."""
    result = []
    for h in hexes:
        if all(color_distance(h, kept) > threshold for kept in result):
            result.append(h)
    return result


def lightness(hex_str):
    r, g, b = hex_to_rgb(hex_str)
    _, _, l = rgb_to_hsl(r, g, b)
    return l
