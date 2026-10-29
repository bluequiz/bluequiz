"""data/unreleased.json에 있는 학생(SchaleDB에 없는 학생)의 아이콘을 나무위키 문서 대표 이미지에서 만든다.

이미 있는 아이콘은 건너뛴다. 위쪽 기준 정사각형으로 자른 뒤 120px webp로 저장한다.
대표 이미지가 소개 카드나 단체 사진이면 항목의 "crop": [x, y, 한 변]으로 자를 영역을 정한다(대표 이미지 픽셀 기준).
실행: python scripts/fetch-unreleased-icons.py  (Pillow 필요)
"""
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "img" / "students"
UA = {"User-Agent": "Mozilla/5.0 (bluequiz icon fetch)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as res:
        return res.read()


def og_image(page):
    html = get("https://namu.wiki/w/" + urllib.parse.quote(page)).decode("utf-8", "replace")
    m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    if not m:
        raise RuntimeError("og:image 없음")
    url = m.group(1)
    return "https:" + url if url.startswith("//") else url


def make_icon(data, out, crop=None):
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    if crop:
        x, y, side = crop
    else:
        w, h = img.size
        side = min(w, h)
        x, y = (w - side) // 2, 0
    img.crop((x, y, x + side, y + side)).resize((120, 120), Image.LANCZOS).save(out, "WEBP", quality=82)


def main():
    entries = json.loads((ROOT / "data" / "unreleased.json").read_text(encoding="utf-8"))
    failed = []
    for e in entries:
        out = IMG_DIR / f"{e['id']}.webp"
        if out.exists():
            continue
        try:
            make_icon(get(og_image(e["page"])), out, e.get("crop"))
            print("ok", e["id"], e["page"])
        except Exception as err:  # 문서가 없거나 이미지가 없으면 목록만 남긴다
            failed.append(e["id"])
            print("실패", e["id"], e["page"], err, file=sys.stderr)
        time.sleep(1)
    if failed:
        print("실패:", ", ".join(failed), file=sys.stderr)


if __name__ == "__main__":
    main()
