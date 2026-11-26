#!/usr/bin/env python3
"""Extract in-game specialist kit icons from PR's menu client archive."""

import io
import os
import zipfile
from pathlib import Path

from PIL import Image

PR_ROOT = Path(os.environ.get("PR_ROOT", r"C:\Games\Project Reality BF2\mods\pr"))
ARCHIVE = PR_ROOT / "content" / "menu_client.zip"
OUT = Path(__file__).resolve().parents[2] / "public" / "data" / "icons" / "kits"

KITS = {
    "mg": "hud/texture/ingame/kits/icons/kit_mg.tga",
    "marksman": "hud/texture/ingame/kits/icons/kit_marksman.tga",
    "ap": "hud/texture/ingame/kits/icons/kit_claymore.tga",
    "spotter": "hud/texture/ingame/kits/icons/kit_spotter.tga",
    "engineer": "hud/texture/ingame/kits/icons/kit_engineer.tga",
    "aa": "hud/texture/ingame/kits/icons/kit_aa.tga",
    "sniper": "hud/texture/ingame/kits/icons/kit_sniper.tga",
    "hat": "hud/texture/ingame/kits/icons/kit_ataa.tga",
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ARCHIVE) as archive:
        for name, entry in KITS.items():
            im = Image.open(io.BytesIO(archive.read(entry))).convert("RGBA")
            scale = min(56 / im.width, 56 / im.height)
            im = im.resize(
                (max(1, round(im.width * scale)), max(1, round(im.height * scale))),
                Image.Resampling.NEAREST if scale >= 1 else Image.Resampling.LANCZOS,
            )
            canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
            canvas.alpha_composite(im, ((64 - im.width) // 2, (64 - im.height) // 2))
            canvas.save(OUT / f"{name}.webp", "WEBP", lossless=True)
            print(name, im.size)


if __name__ == "__main__":
    main()
