# Собирает витринные кадры для App Store из реальных скриншотов приложения.
#
#   python3 store-screenshots/frames.py
#
# Исходники — снимки с iPhone 14 Pro Max, 1290x2796, лежат в src/ рядом.
# Кадр = тот же скриншот в скруглённой рамке на тёмном фоне с подписью;
# сам экран не дорисовывается — Apple это запрещает (Guideline 2.3.3).
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1290, 2796
FONT = "/usr/share/fonts/inter/InterVariable.ttf"
BASE = os.path.dirname(os.path.abspath(__file__))
SRC, OUT = os.path.join(BASE, "src"), os.path.join(BASE, "out")

SHOT_W = 1046
SHOT_X = (W - SHOT_W) // 2
SHOT_Y = 486
RADIUS = 54

BG = (10, 10, 12)


def font(size, weight="Black"):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight)
    return f


def glow(img, color, cx, cy, r, strength):
    layer = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(r // 2))
    return Image.blend(img, layer, strength)


def rounded(im, rad):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], rad, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def draw_caption(img, lines, accent):
    d = ImageDraw.Draw(img)
    size = 84
    f = font(size)
    while max(d.textlength(l, font=f) for l in lines) > W - 200:
        size -= 4
        f = font(size)
    lh = int(size * 1.14)
    total = lh * len(lines)
    y = 300 - total // 2
    for i, line in enumerate(lines):
        w = d.textlength(line, font=f)
        d.text(((W - w) / 2, y + i * lh), line, font=f, fill=(250, 250, 252))
    # accent underline
    bar_w, bar_h = 96, 8
    d.rounded_rectangle(
        [(W - bar_w) // 2, y + total + 44, (W + bar_w) // 2, y + total + 44 + bar_h],
        bar_h // 2, fill=accent)


def build(src, lines, accent, dest):
    img = Image.new("RGB", (W, H), BG)
    img = glow(img, accent, W // 2, SHOT_Y + 40, 640, 0.17)
    img = glow(img, accent, W // 2, 250, 420, 0.07)

    shot = Image.open(os.path.join(SRC, src)).convert("RGB")
    sh = round(SHOT_W * shot.height / shot.width)
    shot = shot.resize((SHOT_W, sh), Image.LANCZOS)
    shot = rounded(shot, RADIUS)

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [SHOT_X, SHOT_Y + 26, SHOT_X + SHOT_W, SHOT_Y + sh], RADIUS, fill=(0, 0, 0, 190))
    shadow = shadow.filter(ImageFilter.GaussianBlur(38))
    img = Image.alpha_composite(img.convert("RGBA"), shadow)

    img.paste(shot, (SHOT_X, SHOT_Y), shot)

    border = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        [SHOT_X, SHOT_Y, SHOT_X + SHOT_W - 1, SHOT_Y + sh - 1], RADIUS,
        outline=(255, 255, 255, 38), width=3)
    img = Image.alpha_composite(img, border)

    img = img.convert("RGB")
    draw_caption(img, lines, accent)
    img.save(os.path.join(OUT, dest), "PNG")
    print(dest, img.size)


AMBER = (251, 146, 60)
BLUE = (59, 130, 246)
GREEN = (16, 185, 129)

JOBS = [
    ("IMG_0036.PNG", ["Машина", "за пару минут"], BLUE, "01-taxi.png"),
    ("IMG_0037.PNG", ["Такси, курьер,", "еда, межгород"], BLUE, "02-home.png"),
    ("IMG_0038.PNG", ["Посылка доедет", "без тебя"], AMBER, "03-courier.png"),
    ("IMG_0047.PNG", ["Заработай", "на своей машине"], GREEN, "04-driver.png"),
    ("IMG_0041.PNG", ["В город", "и обратно"], BLUE, "05-intercity.png"),
    ("IMG_0054.PNG", ["Еда из", "местных кафе"], AMBER, "06-food.png"),
    ("IMG_0055.PNG", ["Плов, лагман,", "манты"], AMBER, "07-menu.png"),
    ("IMG_0053.PNG", ["Один аккаунт —", "три режима работы"], GREEN, "08-modes.png"),
    ("IMG_0050.PNG", ["Свой рейс", "за минуту"], BLUE, "09-trip.png"),
    ("IMG_0052.PNG", ["Водители", "с документами"], GREEN, "10-profile.png"),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for j in JOBS:
        build(*j)
