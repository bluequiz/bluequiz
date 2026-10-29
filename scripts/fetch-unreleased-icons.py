"""data/unreleased.json에 있는 학생(SchaleDB에 없는 학생)의 아이콘을 만든다.

각 항목의 "icon"은 나무위키의 "<이름>프로필" 이미지(배경이 투명한 얼굴 이미지) 주소다.
가운데 기준 정사각형으로 잘라 120px webp로 저장하고, 이미 있는 아이콘은 건너뛴다.
프로필 이미지가 없어 전신 이미지를 쓸 때는 "crop": [x, y, 한 변]으로 얼굴 부분을 지정한다.
실행: python scripts/fetch-unreleased-icons.py [--force]  (Pillow 필요)
"""
import io
import json
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "img" / "students"
UA = {"User-Agent": "Mozilla/5.0 (bluequiz icon fetch)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as res:
        return res.read()


def make_icon(data, out, crop=None):
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    if crop:
        x, y, side = crop
    else:
        w, h = img.size
        side = min(w, h)
        x, y = (w - side) // 2, 0
    img.crop((x, y, x + side, y + side)).resize((120, 120), Image.LANCZOS).save(out, "WEBP", quality=90)


def main():
    force = "--force" in sys.argv
    entries = json.loads((ROOT / "data" / "unreleased.json").read_text(encoding="utf-8"))
    failed = []
    for e in entries:
        out = IMG_DIR / f"{e['id']}.webp"
        if out.exists() and not force:
            continue
        if "icon" not in e:
            failed.append(e["id"])
            continue
        try:
            make_icon(get(e["icon"]), out, e.get("crop"))
            print("ok", e["id"])
        except Exception as err:
            failed.append(e["id"])
            print("실패", e["id"], err, file=sys.stderr)
        time.sleep(0.5)
    if failed:
        print("아이콘 없음:", ", ".join(failed), file=sys.stderr)


if __name__ == "__main__":
    main()
