"""アイコン生成スクリプト
PWA 用の 192x192 / 512x512 PNG を生成する。
インディゴ基調の角丸グラデーション背景に PFC ロゴを白で配置。
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 角丸マスク
    radius = int(size * 0.22)
    rect = Image.new("L", (size, size), 0)
    rd = ImageDraw.Draw(rect)
    rd.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)

    # 縦方向グラデーション (#312e81 -> #6366f1)
    grad = Image.new("RGBA", (size, size))
    top = (49, 46, 129)
    bot = (99, 102, 241)
    for y in range(size):
        c = lerp(top, bot, y / size)
        for x in range(size):
            grad.putpixel((x, y), (*c, 255))

    img.paste(grad, (0, 0), rect)
    draw = ImageDraw.Draw(img)

    # テキスト "PFC"
    try:
        font = ImageFont.truetype("arialbd.ttf", int(size * 0.34))
    except Exception:
        font = ImageFont.load_default()

    text = "PFC"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1] - int(size * 0.02)
    draw.text((tx, ty), text, fill=(255, 255, 255, 240), font=font)

    # 下部のアクセントライン
    line_y = int(size * 0.7)
    line_w = int(size * 0.32)
    line_h = max(2, int(size * 0.012))
    lx = (size - line_w) // 2
    draw.rounded_rectangle((lx, line_y, lx + line_w, line_y + line_h),
                           radius=line_h // 2, fill=(255, 255, 255, 200))

    return img

for s in (192, 512):
    img = make_icon(s)
    img.save(os.path.join(OUT_DIR, f"icon-{s}.png"), "PNG")
    print(f"icon-{s}.png written")
