#!/usr/bin/env python3
"""Extract Project Reality map, layer, flag and vehicle-spawn data.

Reads the local PR installation (server.zip / client.zip / *.desc) and emits
static JSON + WebP minimaps into public/data, ready for the browser planner.

Usage:
  python extract.py            # all PvP layers
  python extract.py --only adak,albasrah_2
  python extract.py --skip-images
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent.parent
PR_ROOT = Path(os.environ.get("PR_ROOT", r"C:\Games\Project Reality BF2\mods\pr"))
LEVELS_DIR = PR_ROOT / "levels"
OUT_DIR = PROJECT / "public" / "data"
MAPS_DIR = OUT_DIR / "maps"
THUMBS_DIR = OUT_DIR / "thumbs"
LAYERS_DIR = OUT_DIR / "layers"

PvP_MODES = {
    "gpm_cq": "AAS",
    "gpm_insurgency": "Insurgency",
    "gpm_cnc": "CNC",
}

FACTIONS = {
    "us": ("United States", "US"),
    "usmc": ("United States", "USMC"),
    "usa": ("United States", "USA"),
    "ch": ("China", "CH"),
    "mec": ("Middle Eastern Coalition", "MEC"),
    "gb": ("United Kingdom", "UK"),
    "rus": ("Russia", "RU"),
    "ins": ("Insurgents", "INS"),
    "tal": ("Taliban", "TAL"),
    "mil": ("Militia", "MIL"),
    "ger": ("Germany", "GER"),
    "fr": ("France", "FR"),
    "nl": ("Netherlands", "NL"),
    "pl": ("Poland", "PL"),
    "tr": ("Turkey", "TR"),
    "ca": ("Canada", "CA"),
    "aus": ("Australia", "AUS"),
    "nz": ("New Zealand", "NZ"),
    "idf": ("Israel", "IDF"),
    "hamas": ("Hamas", "HAM"),
    "arf": ("African Resistance", "ARF"),
    "vmf": ("Vietnam", "VMF"),
    "nva": ("North Vietnam", "NVA"),
    "usa_marines": ("United States", "USMC"),
    "us_iron": ("US Army", "US"),
    "meinsurgent": ("Insurgents", "INS"),
    "insurgent": ("Insurgents", "INS"),
    "taliban": ("Taliban", "TAL"),
    "militia": ("Militia", "MIL"),
    "germany": ("Germany", "GER"),
}

# Ordered classification rules. First match wins.
CATEGORY_RULES = [
    ("carrier", [r"carrier", r"uss_"]),
    ("boat", [r"boat", r"rhib", r"dinghy", r"barge", r"ship", r"frigate", r"sub_"]),
    ("jet", [r"jet", r"_f16", r"f16", r"f18", r"f_18", r"mig", r"su_?2", r"su_?3", r"a10", r"a_10", r"tornado", r"eurofighter", r"j10", r"j_10", r"j20", r"mirage", r"harrier"]),
    ("bomber", [r"bomber", r"b_?52"]),
    ("attack_heli", [r"ah_?1", r"ah1", r"ah_?64", r"apache", r"cobra", r"mi_?24", r"mi24", r"mi_?28", r"mi28", r"ka_?52", r"havoc", r"z_?10", r"z10", r"atkheli", r"attackheli"]),
    ("transport_heli", [r"the_", r"hel", r"uh_?60", r"uh_?1", r"mh_?6", r"mh6", r"mi_?8", r"mi8", r"mi_?17", r"mi17", r"lynx", r"merlin", r"orca", r"z_?8", r"z_?9", r"z8", r"z9", r"huey", r"blackhawk", r"cas_?heli", r"trans"]),
    ("mbt", [r"mbt", r"tank", r"t_?72", r"t72", r"t_?90", r"t90", r"m1a1", r"m1a2", r"challenger", r"leopard", r"leclerc", r"ztz", r"type_?99", r"type99", r"merkava", r"pt_?76", r"t_?62", r"t62"]),
    ("ifv", [r"ifv", r"bmp", r"bradley", r"warrior", r"scimitar", r"sprut", r"cv90", r"puma"]),
    ("apc", [r"apc", r"btr", r"lav", r"m113", r"aav", r"stryker", r"piranha", r"vab", r"mastiff", r"wz551", r"wz_?551"]),
    ("recon", [r"brdm", r"recon", r"scout", r"drone", r"spandrel", r"vodnik_recon"]),
    ("aa", [r"zsu", r"shilka", r"tunguska", r"avenger", r"linebacker", r"aa_", r"_aa", r"aav_?aa", r"stationary_?aa", r"igla", r"stinger", r"oerlikon", r"gaskin", r"roland"]),
    ("artillery", [r"arty", r"artillery", r"howitzer", r"m109", r"d30", r"d_?30", r"2s1", r"gvozdika", r"mortar"]),
    ("crate", [r"crate", r"supply_crate", r"ammo_?cache", r"weapon_?cache"]),
    ("asset", [r"repair", r"commandpost", r"command_post", r"fob_", r"supply_drop"]),
    ("logistics", [r"logi", r"truck", r"ural", r"kamaz", r"m35", r"mtvr", r"hemtt", r"trans_?land", r"transport_?truck"]),
    ("jeep", [r"jep", r"jeep", r"hmmwv", r"humvee", r"landrover", r"land_?rover", r"uaz", r"technical", r"vodnik", r"datsun", r"pickup", r"quad", r"atv", r"dirtbike", r"motorbike", r"tigr", r"gaz"]),
    ("emplacement", [r"tow", r"atgm", r"konkurs", r"kornet", r"h_at", r"hmg", r"mg_", r"stationary", r"deployable_", r"fixed_", r"mortar_", r"aa_?gun"]),
]

VEHICLE_TOKEN_RULES = CATEGORY_RULES


def clean_faction(key: str) -> tuple[str, str]:
    return FACTIONS.get(key, (key.upper(), key.upper()))


def classify(template: str) -> str:
    t = template.lower()
    for cat, pats in CATEGORY_RULES:
        if any(re.search(p, t) for p in pats):
            return cat
    if "supply" in t or "crate" in t:
        return "crate"
    return "other"


def is_vehicle_category(cat: str) -> bool:
    return cat not in {"crate", "other"}


TOKEN_NAMES = {
    "the": "", "jep": "", "veh": "", "main": "", "op": "", "vehicle": "",
    "uparmored": "Up-Armored", "alt": "", "logi": "Logistics", "apc": "APC",
    "ifv": "IFV", "mbt": "MBT", "aa": "AA", "aav": "AAV", "tow": "TOW",
    "hmg": "HMG", "cas": "CAS", "z8": "Z-8", "z9": "Z-9", "z9b": "Z-9B",
    "z9wa": "Z-9WA", "z10": "Z-10", "wz551": "WZ-551", "wz551b": "WZ-551B",
    "m2a2": "M2A2", "m1a1": "M1A1", "m1a2": "M1A2", "bmp2": "BMP-2",
    "bmp3": "BMP-3", "btr60": "BTR-60", "btr80": "BTR-80", "t72": "T-72",
    "t90": "T-90", "t62": "T-62", "mh6": "MH-6", "uh60": "UH-60",
    "mi8": "Mi-8", "mi17": "Mi-17", "mi24": "Mi-24", "mi28": "Mi-28",
    "ka52": "Ka-52", "f16": "F-16", "f18": "F/A-18", "a10": "A-10",
    "su25": "Su-25", "su27": "Su-27", "su34": "Su-34", "j10": "J-10",
    "m109": "M109", "d30": "D-30", "zsu23": "ZSU-23", "brdm2": "BRDM-2",
    "rhib": "RHIB", "lav25": "LAV-25", "lav3": "LAV-3", "m113": "M113",
    "hmmwv": "HMMWV", "humvee": "Humvee", "m35": "M35", "mtvr": "MTVR",
    "hemtt": "HEMTT", "uaz": "UAZ", "ural": "Ural", "kamaz": "KamAZ",
    "technical": "Technical", "vodnik": "Vodnik", "stryker": "Stryker",
    "challenger": "Challenger", "leopard": "Leopard", "leclerc": "Leclerc",
    "warrior": "Warrior", "bradley": "Bradley", "scimitar": "Scimitar",
    "shilka": "Shilka", "tunguska": "Tunguska", "avenger": "Avenger",
    "apache": "Apache", "cobra": "Cobra", "havoc": "Havoc", "lynx": "Lynx",
    "merlin": "Merlin", "blackhawk": "Blackhawk", "huey": "Huey",
    "mtlb": "MT-LB", "acv": "ACV", "trk": "Truck", "gpmg": "GPMG",
    "m240b": "M240B", "m2": "M2", "bik": "Bike", "atv": "ATV",
    "jeep": "Jeep", "rhib": "RHIB", "hmg": "HMG", "spg": "SPG",
    "brdm": "BRDM", "btr": "BTR", "bmp": "BMP", "lav": "LAV",
    "m113": "M113", "m1": "M1", "t62": "T-62", "t72": "T-72",
    "t90": "T-90", "zsu": "ZSU", "aaa": "AAA", "sam": "SAM",
    "mlrs": "MLRS", "uh60": "UH-60", "uh1": "UH-1", "ch47": "CH-47",
    "mi8": "Mi-8", "mi17": "Mi-17", "a10": "A-10", "f16": "F-16",
    "f18": "F/A-18", "su25": "Su-25", "j10": "J-10", "civ": "Civ",
}

FACTION_PREFIX = re.compile(r"^(us|ch|mec|gb|rus|ger|fr|nl|pl|tr|ca|aus|nz|ins|tal|mil|idf|hamas|arf)_")


def prettify_template(template: str) -> str:
    t = FACTION_PREFIX.sub("", template)
    t = re.sub(r"_alt$", "", t)
    parts = [TOKEN_NAMES.get(p, p.upper() if p.isdigit() and len(p) <= 2 else p) for p in t.split("_")]
    parts = [p for p in parts if p]
    if not parts:
        return template
    text = " ".join(parts)
    text = re.sub(r"\b([a-z])", lambda m: m.group(1).upper(), text)
    return text


CP_ABBR = ["us", "ch", "mec", "gb", "uk", "ru", "ins", "tal", "un", "fob", "aa", "tow", "hmg"]


def pretty_label(raw: str) -> str:
    text = raw.replace("_", " ").strip()
    words = []
    for word in text.split(" "):
        low = word.lower()
        split = None
        for abbr in CP_ABBR:
            if low.startswith(abbr) and len(low) > len(abbr) + 1 and low[len(abbr)] not in "aeiou":
                split = (word[:len(abbr)].upper(), word[len(abbr):])
                break
        if split:
            words.extend(split)
        elif low in CP_ABBR:
            words.append(low.upper())
        else:
            words.append(word)
    out = " ".join(w.capitalize() if w.islower() else w for w in words if w)
    return out


def read_zip_text(z: zipfile.ZipFile, name: str) -> str | None:
    try:
        return z.read(name).decode("latin-1")
    except KeyError:
        return None


def parse_desc(level_dir: Path) -> dict:
    desc = level_dir / "info" / f"{level_dir.name}.desc"
    if not desc.exists():
        return {"name": level_dir.name.title(), "modes": {}}
    text = desc.read_text(encoding="utf-8", errors="replace")
    name_m = re.search(r"<name>\s*(.*?)\s*</name>", text, re.S)
    name = re.sub(r"\s+", " ", name_m.group(1)).strip() if name_m else level_dir.name.title()
    modes: dict[str, list[dict]] = {}
    for mm in re.finditer(r"<mode\s+type=\"([^\"]+)\"\s*>(.*?)</mode>", text, re.S):
        mode = mm.group(1)
        body = mm.group(2)
        maptypes = []
        for mt in re.finditer(r"<maptype\s+([^>]*?)/?>", body):
            attrs = dict(re.findall(r"(\w+)=\"([^\"]*)\"", mt.group(1)))
            if "players" in attrs:
                maptypes.append(attrs)
        modes[mode] = maptypes
    return {"name": name, "modes": modes}


def layer_type_label(raw: str) -> str:
    if not raw:
        return ""
    fixes = {"aas": "AAS", "cnc": "CNC", "insurgency": "Insurgency", "coop": "COOP", "skirmish": "Skirmish"}
    words = re.findall(r"aas|cnc|insurgency|coop|skirmish|[a-z]+", raw)
    out = []
    for w in words:
        out.append(fixes.get(w, w.capitalize()))
    return " ".join(out)


def world_size(server: zipfile.ZipFile) -> int:
    hd = read_zip_text(server, "heightdata.con") or ""
    m = re.search(r"heightmapcluster\.setHeightmapSize\s+(\d+)", hd)
    if m:
        return int(m.group(1))
    size = re.search(r"heightmap\.setSize\s+(\d+)\s+(\d+)", hd)
    scale = re.search(r"heightmap\.setScale\s+([\d.]+)/", hd)
    if size and scale:
        return round((int(size.group(1)) - 1) * float(scale.group(1)))
    return 1024


def parse_factions(init_text: str) -> dict[int, dict]:
    result: dict[int, dict] = {}
    for m in re.finditer(r"faction_init\.con\s+(\d+)\s+\"([^\"]+)\"", init_text):
        team = int(m.group(1))
        key = m.group(2)
        full, short = clean_faction(key)
        result[team] = {"key": key, "name": full, "short": short}
    return result


TEMPLATE_CREATE = re.compile(r"ObjectTemplate\.create\s+(\w+)\s+(\S+)")
INSTANCE_CREATE = re.compile(r"^\s*Object\.create\s+(\S+)", re.M)


def parse_gpo(text: str) -> dict:
    template_type: dict[str, str] = {}
    spawners: dict[str, dict] = {}
    control_template: dict[str, dict] = {}
    current = None
    current_type = None
    for line in text.splitlines():
        m = TEMPLATE_CREATE.match(line.strip())
        if m:
            current_type, current = m.group(1), m.group(2)
            template_type[current] = current_type
            if current_type == "ObjectSpawner":
                spawners[current] = {}
            elif current_type == "ControlPoint":
                control_template[current] = {}
            continue
        if current is None:
            continue
        s = line.strip()
        if current_type == "ObjectSpawner":
            mm = re.match(r"ObjectTemplate\.setObjectTemplate\s+\d+\s+(\S+)", s)
            if mm:
                spawners[current]["template"] = mm.group(1)
            mm = re.match(r"ObjectTemplate\.team\s+(\d+)", s)
            if mm:
                spawners[current]["team"] = int(mm.group(1))
            mm = re.match(r"ObjectTemplate\.spawnDelayAtStart\s+(\d+)", s)
            if mm:
                spawners[current]["atStart"] = int(mm.group(1)) == 1
            mm = re.match(r"ObjectTemplate\.minSpawnDelay\s+([\d.]+)", s)
            if mm:
                spawners[current]["minDelay"] = float(mm.group(1))
            mm = re.match(r"ObjectTemplate\.maxSpawnDelay\s+([\d.]+)", s)
            if mm:
                spawners[current]["maxDelay"] = float(mm.group(1))
            mm = re.match(r"ObjectTemplate\.TimeToLive\s+([\d.]+)", s)
            if mm:
                spawners[current]["ttl"] = float(mm.group(1))
        if current_type == "ControlPoint":
            mm = re.match(r"ObjectTemplate\.setControlPointName\s+(\S+)", s)
            if mm:
                control_template[current]["name"] = mm.group(1)

    instances = []
    for m in INSTANCE_CREATE.finditer(text):
        name = m.group(1)
        block = text[m.end():m.end() + 700]
        pos = re.search(r"Object\.absolutePosition\s+([-\d.]+)/([-\d.]+)/([-\d.]+)", block)
        rot = re.search(r"Object\.rotation\s+([-\d.]+)/([-\d.]+)/([-\d.]+)", block)
        cp = re.search(r"Object\.setControlPointId\s+(\d+)", block)
        instances.append({
            "name": name,
            "type": template_type.get(name, "Unknown"),
            "pos": tuple(float(v) for v in pos.groups()) if pos else None,
            "rot": tuple(float(v) for v in rot.groups()) if rot else None,
            "cp": int(cp.group(1)) if cp else None,
        })
    return {"spawners": spawners, "instances": instances, "controlTemplates": control_template}


def pretty_cp_name(raw: str, level: str, mode: str, players: int) -> str:
    name = raw
    if name.startswith("cpname_"):
        name = name[len("cpname_"):]
    if name.lower().startswith(level.lower() + "_"):
        name = name[len(level) + 1:]
    name = re.sub(r"^(aas|insurgency|cnc|skirmish|coop)\d+_", "", name, flags=re.I)
    name = re.sub(r"^\d+_", "", name)
    return pretty_label(name) if name else raw


def build_layer(level: str, level_dir: Path, mode: str, players: int, maptype: dict | None) -> dict | None:
    layer_id = f"{level}__{mode.replace('gpm_', '')}__{players}"
    server_path = level_dir / "server.zip"
    gpo_name = f"gamemodes/{mode}/{players}/gameplayobjects.con"
    try:
        with zipfile.ZipFile(server_path) as server:
            text = read_zip_text(server, gpo_name)
            init_text = read_zip_text(server, "init.con") or ""
            if text is None:
                return None
            parsed = parse_gpo(text)
            world = world_size(server)
            factions = parse_factions(init_text)
    except (zipfile.BadZipFile, FileNotFoundError):
        return None

    vehicles = []
    for inst in parsed["instances"]:
        if inst["type"] != "ObjectSpawner" or not inst["pos"]:
            continue
        tpl = parsed["spawners"].get(inst["name"], {})
        obj = tpl.get("template")
        if not obj:
            continue
        cat = classify(obj)
        if not is_vehicle_category(cat):
            continue
        team = tpl.get("team")
        # In BF2, spawnDelayAtStart=1 marks an asset that is held back at round
        # start for its spawn delay. Default (field absent) is on the pad.
        at_start = not tpl.get("atStart", False)
        vehicles.append({
            "id": f"{inst['name']}",
            "template": obj,
            "label": prettify_template(obj),
            "category": cat,
            "team": team,
            "x": round(inst["pos"][0], 2),
            "z": round(inst["pos"][2], 2),
            "rotation": round((inst["rot"] or (0, 0, 0))[0], 2),
            "atStart": bool(at_start),
            "respawn": tpl.get("minDelay"),
            "cp": inst["cp"],
        })

    cps = []
    for inst in parsed["instances"]:
        if inst["type"] != "ControlPoint" or not inst["pos"]:
            continue
        cps.append({
            "id": len(cps) + 1,
            "raw": inst["name"],
            "name": pretty_cp_name(inst["name"], level, mode, players),
            "x": round(inst["pos"][0], 2),
            "z": round(inst["pos"][2], 2),
        })

    # Some custom levels ship no heightdata.con. Infer their world size from
    # the spread of placed objects (BF2 worlds are 1, 2 or 4 km).
    if world == 1024:
        max_abs = max([abs(cp["x"]) for cp in cps] + [abs(cp["z"]) for cp in cps] +
                      [abs(v["x"]) for v in vehicles] + [abs(v["z"]) for v in vehicles], default=0)
        if max_abs > 1200:
            world = 4096
        elif max_abs > 600:
            world = 2048

    counts = Counter(v["category"] for v in vehicles)
    return {
        "id": layer_id,
        "levelId": level,
        "mode": mode,
        "modeLabel": PvP_MODES[mode],
        "players": players,
        "layerType": (maptype or {}).get("type", ""),
        "layerTypeLabel": layer_type_label((maptype or {}).get("type", "")),
        "name": f"{PvP_MODES[mode]} {players}",
        "world": world,
        "factions": {str(k): v for k, v in factions.items()},
        "controlPoints": cps,
        "vehicles": vehicles,
        "vehicleAtStart": sum(1 for v in vehicles if v["atStart"]),
        "counts": dict(counts),
    }


def find_layers(level_dir: Path, desc: dict) -> list[tuple[str, int, dict | None]]:
    found: list[tuple[str, int, dict | None]] = []
    for mode in PvP_MODES:
        maptypes = desc["modes"].get(mode) or []
        listed = {int(mt["players"]): mt for mt in maptypes if mt.get("players", "").isdigit()}
        for players, mt in sorted(listed.items()):
            gpo = level_dir / "server.zip"
            found.append((mode, players, mt))
        if not listed:
            # No maptypes declared: fall back to actual layer folders.
            with zipfile.ZipFile(level_dir / "server.zip") as server:
                names = server.namelist()
            for name in names:
                m = re.match(rf"gamemodes/{mode}/(\d+)/gameplayobjects\.con$", name)
                if m:
                    found.append((mode, int(m.group(1)), None))
    return found


def extract_minimap(level: str, level_dir: Path, world: int) -> dict | None:
    img = None
    try:
        with zipfile.ZipFile(level_dir / "client.zip") as client:
            data = client.read("hud/minimap/ingamemap.dds")
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except (KeyError, FileNotFoundError, zipfile.BadZipFile):
        # A few custom maps ship no in-game minimap. Fall back to the square
        # top-down area of the loading-screen overview.
        overviews = sorted((level_dir / "info").glob("mapOverview_*.png"))
        if overviews:
            img = Image.open(overviews[0]).convert("RGB")
            side = min(img.width, img.height)
            img = img.crop((0, 0, side, side))
    if img is None:
        return None
    if img.width != img.height:
        side = min(img.width, img.height)
        img = img.crop((0, 0, side, side))
    if img.width > 2048:
        img = img.resize((2048, 2048), Image.LANCZOS)
    elif img.width < 1024:
        img = img.resize((1024, 1024), Image.LANCZOS)
    MAPS_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    webp = MAPS_DIR / f"{level}.webp"
    img.save(webp, "WEBP", quality=82, method=6)
    thumb = THUMBS_DIR / f"{level}.webp"
    img.resize((384, 384), Image.LANCZOS).save(thumb, "WEBP", quality=78, method=6)
    return {"image": webp.name, "thumb": thumb.name, "width": img.width, "height": img.height}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--skip-images", action="store_true")
    ap.add_argument("--skip-layers", action="store_true")
    args = ap.parse_args()

    only = {s.strip() for s in args.only.split(",") if s.strip()}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LAYERS_DIR.mkdir(parents=True, exist_ok=True)

    level_dirs = sorted([d for d in LEVELS_DIR.iterdir() if d.is_dir()])
    if only:
        level_dirs = [d for d in level_dirs if d.name in only]

    index = []
    all_templates = Counter()
    report = []
    for i, level_dir in enumerate(level_dirs, 1):
        level = level_dir.name
        desc = parse_desc(level_dir)
        try:
            with zipfile.ZipFile(level_dir / "server.zip") as server:
                world = world_size(server)
                init_text = read_zip_text(server, "init.con") or ""
                factions = parse_factions(init_text)
        except (FileNotFoundError, zipfile.BadZipFile) as exc:
            print(f"[skip] {level}: {exc}", file=sys.stderr)
            continue

        layers_meta = []
        for mode, players, maptype in find_layers(level_dir, desc):
            if args.skip_layers:
                layers_meta.append({
                    "id": f"{level}__{mode.replace('gpm_', '')}__{players}",
                    "mode": mode, "modeLabel": PvP_MODES[mode], "players": players,
                    "name": f"{PvP_MODES[mode]} {players}", "layerType": (maptype or {}).get("type", ""),
                    "layerTypeLabel": layer_type_label((maptype or {}).get("type", "")),
                    "file": None, "vehicles": 0, "vehiclesAtStart": 0, "controlPoints": 0,
                })
                continue
            layer = build_layer(level, level_dir, mode, players, maptype)
            if not layer:
                continue
            path = LAYERS_DIR / f"{layer['id']}.json"
            path.write_text(json.dumps(layer, separators=(",", ":")), encoding="utf-8")
            for v in layer["vehicles"]:
                all_templates[v["template"]] += 1
            layers_meta.append({
                "id": layer["id"], "mode": mode, "modeLabel": layer["modeLabel"],
                "players": players, "name": layer["name"], "layerType": layer["layerType"],
                "layerTypeLabel": layer["layerTypeLabel"],
                "file": path.name, "vehicles": len(layer["vehicles"]),
                "vehiclesAtStart": layer["vehicleAtStart"],
                "controlPoints": len(layer["controlPoints"]),
                "world": layer["world"],
            })
            report.append((layer["id"], len(layer["vehicles"]), layer["vehicleAtStart"], len(layer["controlPoints"])))

        if not layers_meta:
            continue
        images = None if args.skip_images else extract_minimap(level, level_dir, world)
        map_world = max([l.get("world", world) for l in layers_meta] or [world])
        index.append({
            "id": level,
            "name": desc["name"],
            "world": map_world,
            "factions": {str(k): v for k, v in factions.items()},
            "images": images,
            "layers": layers_meta,
        })
        print(f"[{i}/{len(level_dirs)}] {level}: {len(layers_meta)} layers, {len(desc['name'])} chars", flush=True)

    index.sort(key=lambda m: m["name"].lower())
    (OUT_DIR / "index.json").write_text(json.dumps({
        "generated": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "modes": PvP_MODES,
        "maps": index,
    }, separators=(",", ":")), encoding="utf-8")

    with open(OUT_DIR / "vehicle-templates.txt", "w", encoding="utf-8") as fh:
        for tpl, count in sorted(all_templates.items()):
            fh.write(f"{classify(tpl):16s} {count:4d} {tpl}\n")

    print(f"\nMaps: {len(index)}  Layers: {sum(len(m['layers']) for m in index)}")
    print(f"Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
