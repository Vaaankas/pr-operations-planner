import glob
import html
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LAYERS = ROOT / "public" / "data" / "layers"
OUT = ROOT / "public" / "vehicle-audit.html"

assets = json.loads((ROOT / "public" / "data" / "assets.json").read_text(encoding="utf-8"))
icon_paths = assets.get("vehicles", {})
vehicles: dict[str, dict] = {}
for path in glob.glob(str(LAYERS / "*.json")):
    layer = json.loads(Path(path).read_text(encoding="utf-8"))
    for vehicle in layer.get("vehicles", []):
        template = vehicle["template"]
        if "artillery_team" in template.lower():
            continue
        vehicles.setdefault(template, {
            "label": vehicle["label"],
            "category": vehicle["category"],
            "icon": icon_paths.get(vehicle["icon"]) or icon_paths.get(vehicle["category"]) or f"icons/vehicles/{vehicle['category']}.webp",
        })

by_category: dict[str, list[tuple[str, dict]]] = defaultdict(list)
for template, info in vehicles.items():
    by_category[info["category"]].append((template, info))

for items in by_category.values():
    items.sort(key=lambda item: (item[1]["label"].lower(), item[0].lower()))

categories = sorted(by_category)
cards = []
for category in categories:
    items = by_category[category]
    cards.append(
        f'<section class="group" data-group="{html.escape(category)}">'
        f'<h2><img src="data/icons/vehicles/{html.escape(category)}.webp" alt="">'
        f'{html.escape(category.upper())}<span>{len(items)}</span></h2><div class="grid">'
    )
    for template, info in items:
        label = html.escape(info["label"])
        template_safe = html.escape(template)
        search = html.escape(f'{info["label"]} {template} {category}'.lower())
        cards.append(
            f'<article class="card" data-category="{html.escape(category)}" data-search="{search}">'
            f'<img class="icon" src="data/{html.escape(info["icon"])}" alt="" loading="lazy">'
            f'<div class="meta"><div class="name">{label}</div>'
            f'<div class="template">{template_safe}</div></div>'
            f'<label class="review"><input type="checkbox" data-key="{template_safe}"> reviewed</label>'
            f'</article>'
        )
    cards.append("</div></section>")

filters = "".join(
    f'<button class="filter" data-filter="{html.escape(category)}">'
    f'{html.escape(category.upper())} <span>{len(by_category[category])}</span></button>'
    for category in categories
)

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vehicle Icon Audit</title>
<style>
:root {{ color-scheme: dark; --bg:#080d0a; --panel:#0d1410; --line:#26352c; --amber:#fbbf24; --muted:#7d8c82; }}
* {{ box-sizing:border-box; }} body {{ margin:0; background:var(--bg); color:#dbe4dd; font:13px/1.4 Inter,Segoe UI,system-ui,sans-serif; }}
header {{ position:sticky; top:0; z-index:3; padding:18px 22px 12px; background:rgba(8,13,10,.96); border-bottom:1px solid var(--line); }}
h1 {{ margin:0; font-size:18px; letter-spacing:.12em; text-transform:uppercase; }}
.sub {{ color:var(--muted); margin-top:4px; font:11px/1.4 ui-monospace,Consolas,monospace; }}
.tools {{ display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }}
input[type=search] {{ width:360px; max-width:100%; padding:8px 11px; background:#050805; color:#e2e8f0; border:1px solid var(--line); border-radius:5px; outline:none; }}
input[type=search]:focus {{ border-color:var(--amber); }}
.filters {{ display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; }}
.filter {{ border:1px solid var(--line); background:#0a100c; color:#aab7ad; border-radius:4px; padding:4px 7px; cursor:pointer; font:10px/1.2 ui-monospace,Consolas,monospace; }}
.filter span {{ color:var(--muted); }} .filter.on {{ border-color:var(--amber); color:var(--amber); }}
main {{ padding:16px 22px 60px; }}
.group {{ margin:0 0 24px; }}
.group h2 {{ display:flex; align-items:center; gap:8px; margin:0 0 9px; padding-bottom:6px; border-bottom:1px solid var(--line); font:11px/1.2 ui-monospace,Consolas,monospace; letter-spacing:.14em; color:#b9c6bc; }}
.group h2 img {{ width:22px; height:22px; object-fit:contain; }} .group h2 span {{ color:var(--muted); }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(310px,1fr)); gap:6px; }}
.card {{ display:flex; align-items:center; gap:9px; min-width:0; padding:6px 7px; background:var(--panel); border:1px solid #17231a; border-radius:4px; }}
.card.hide, .group.hide {{ display:none; }} .card.reviewed {{ border-color:#2d4b35; }}
.icon {{ width:36px; height:36px; object-fit:contain; flex:0 0 36px; image-rendering:auto; }}
.meta {{ min-width:0; flex:1; }} .name {{ font-weight:600; color:#e5ece7; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }}
.template {{ margin-top:2px; color:var(--muted); font:10px/1.3 ui-monospace,Consolas,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }}
.review {{ display:flex; align-items:center; gap:3px; color:#637267; font:9px/1 ui-monospace,Consolas,monospace; white-space:nowrap; }}
.review input {{ accent-color:var(--amber); }}
.empty {{ color:var(--muted); padding:30px 0; }}
a {{ color:var(--amber); text-decoration:none; }}
</style>
</head>
<body>
<header>
  <h1>Vehicle Icon Audit</h1>
  <div class="sub">{len(vehicles)} unique vehicle templates · {len(categories)} icon categories · <span id="reviewed">0</span> marked reviewed · <a href="/">back to planner</a></div>
  <div class="tools"><input id="search" type="search" placeholder="Search label, template or category…"></div>
  <div class="filters"><button class="filter on" data-filter="all">ALL <span>{len(vehicles)}</span></button>{filters}</div>
</header>
<main>{''.join(cards)}<div id="empty" class="empty" style="display:none">No vehicles match.</div></main>
<script>
const cards=[...document.querySelectorAll('.card')], groups=[...document.querySelectorAll('.group')], search=document.querySelector('#search');
let filter='all';
const saved=JSON.parse(localStorage.getItem('vehicle-audit-reviewed')||'{{}}');
function apply(){{
  const q=search.value.trim().toLowerCase(); let shown=0;
  for(const card of cards){{
    const ok=(filter==='all'||card.dataset.category===filter)&&(!q||card.dataset.search.includes(q));
    card.classList.toggle('hide',!ok); if(ok) shown++;
  }}
  for(const group of groups){{
    const visible=[...group.querySelectorAll('.card:not(.hide)')].length;
    group.classList.toggle('hide',visible===0||(filter!=='all'&&group.dataset.group!==filter));
  }}
  document.querySelector('#empty').style.display=shown?'none':'block';
  document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('on',b.dataset.filter===filter));
  let reviewed=0; for(const c of document.querySelectorAll('.review input')) if(c.checked) reviewed++;
  document.querySelector('#reviewed').textContent=reviewed;
}}
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{{filter=b.dataset.filter;apply();}}));
search.addEventListener('input',apply);
for(const input of document.querySelectorAll('.review input')){{
  input.checked=!!saved[input.dataset.key];
  input.closest('.card').classList.toggle('reviewed',input.checked);
  input.addEventListener('change',()=>{{
    saved[input.dataset.key]=input.checked;
    localStorage.setItem('vehicle-audit-reviewed',JSON.stringify(saved));
    input.closest('.card').classList.toggle('reviewed',input.checked);
    apply();
  }});
}}
apply();
</script>
</body>
</html>
"""
OUT.write_text(page, encoding="utf-8")
print(f"Wrote {OUT} with {len(vehicles)} vehicles across {len(categories)} categories")
