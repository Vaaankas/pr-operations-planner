import glob
import io
import json
import re
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public" / "data"
CONTENT = Path(r"C:\Games\Project Reality BF2\mods\pr\content")
MENU = CONTENT / "menu_client.zip"
SERVER_ARCHIVES = [
    "objects_vehicles_server.zip",
    "objects_common_server.zip",
    "objects_statics_server.zip",
]
ICON_SOURCE_DIR = "hud/texture/ingame/vehicles/icons/minimap/"


def save_icon(im: Image.Image, path: Path, size: int = 64) -> None:
    im = im.convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    if im.width > size or im.height > size:
        im.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, "WEBP", quality=92, method=6)


# Exact PlayerControlObject -> miniMapIcon stem from server tweaks.
template_icons: dict[str, str] = {}
with zipfile.ZipFile(MENU) as menu:
    menu_names = menu.namelist()
    minimap_names = {
        Path(name).stem.lower(): name
        for name in menu_names
        if name.startswith(ICON_SOURCE_DIR) and name.lower().endswith((".tga", ".dds"))
    }

    for archive_name in SERVER_ARCHIVES:
        archive_path = CONTENT / archive_name
        if not archive_path.exists():
            continue
        with zipfile.ZipFile(archive_path) as archive:
            for name in archive.namelist():
                if not name.lower().endswith(".tweak"):
                    continue
                text = archive.read(name).decode("latin-1")
                match = re.search(r"ObjectTemplate\.vehicleHud\.miniMapIcon\s+(\S+)", text)
                if not match:
                    continue
                stem = Path(match.group(1).replace("\\", "/")).stem.lower()
                if stem not in minimap_names:
                    continue
                objects = set(re.findall(
                    r"ObjectTemplate\.(?:activeSafe|create)\s+PlayerControlObject\s+(\S+)",
                    text,
                ))
                for obj in objects:
                    template_icons[obj] = stem

# Every vehicle template present in the planner layers.
layer_templates: set[str] = set()
for path in glob.glob(str(DATA / "layers" / "*.json")):
    layer = json.loads(Path(path).read_text(encoding="utf-8"))
    for vehicle in layer.get("vehicles", []):
        if "artillery_team" in vehicle["template"].lower():
            continue
        layer_templates.add(vehicle["template"])

resolved: dict[str, str] = {}
unresolved: list[str] = []
for template in sorted(layer_templates):
    if template in template_icons:
        resolved[template] = template_icons[template]
        continue
    prefixes = [base for base in template_icons if template.startswith(base)]
    if prefixes:
        resolved[template] = template_icons[max(prefixes, key=len)]
        continue
    # Last resort: an explicit model token from a game icon name.
    lowered = template.lower()
    tokens = [
        stem for stem in minimap_names
        if len(stem.replace("mini_", "")) >= 4 and stem.replace("mini_", "") in lowered
    ]
    if tokens:
        resolved[template] = max(tokens, key=len)
        continue
    unresolved.append(template)

# Extract every exact minimap icon referenced by the resolved templates.
used_stems = sorted(set(resolved.values()))
paths: dict[str, str] = {}
with zipfile.ZipFile(MENU) as menu:
    for stem in used_stems:
        source = minimap_names[stem]
        out = DATA / "icons" / "vehicles" / "map" / f"{stem}.webp"
        save_icon(Image.open(io.BytesIO(menu.read(source))), out)
        paths[stem] = f"icons/vehicles/map/{stem}.webp"

assets_path = DATA / "assets.json"
assets = json.loads(assets_path.read_text(encoding="utf-8"))
assets["vehicleTemplates"] = {template: paths[stem] for template, stem in resolved.items()}
assets["vehicleTemplateIcons"] = resolved
assets["unresolvedVehicleTemplates"] = unresolved
assets_path.write_text(json.dumps(assets, separators=(",", ":")), encoding="utf-8")

print(f"Templates: {len(layer_templates)} resolved: {len(resolved)} unresolved: {len(unresolved)}")
print(f"Unique exact map icons: {len(used_stems)}")
print("Unresolved:", ", ".join(unresolved))
