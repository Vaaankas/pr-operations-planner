# PR Operations Planner

A browser-based mission planning board for **Project Reality: BF2**. Pick any PvP map and layer, lay out the 50-player roster, place every opening vehicle on its real spawn point, draw the scheme of manoeuvre, build a stage timeline, and export a brief as PowerPoint, PDF or map images.

Static site. No accounts, no backend, no tracking. Plans live in the browser.

![Planning board](docs/board.png)

## What it does

- **88 maps / 413 PvP layers** extracted from a local PR install: AAS (`gpm_cq`), Insurgency (`gpm_insurgency`) and Skirmish (`gpm_skirmish`). CNC is deliberately excluded.
- **Accurate 2D map art** — the in-game 2048² minimap with its baked A–M / 1–13 grid, not a stretched screenshot.
- **Opening vehicle manifest** — every spawner present at round start, with its team, object template, spawn rotation and respawn delay, placed on its real world position. Delayed assets are dimmed with their timer. Icons are PR's own white minimap silhouettes, tinted by team or claiming squad.
- **AASv4 routes** — flags are ordered from each layer's SupplyGroupId (`ABC`: order, alternatives, route). Switch routes, show all route lanes, and render real capture radii in translucent route colours.
- **Localised flags** — English control-point names from `prmaps.utxt` and the in-game minimap flag textures.
- **50-player target roster** — commander plus up to ten squads; drag players between squads, drag squad headers to reorder, soft 8-player squad limit, reserve pool. Each player cycles blank → amber `?` unconfirmed → green `✓` confirmed.
- **Tactical drawing** — pen, line, arrow (one or both heads, solid or dashed), rectangle, ellipse, zone polygon with separate fill opacity, labels, in-game markers and commander-order glyphs, NATO unit symbols.
- **Stage timeline** — each stage has a mission clock, commander intent and its own drawings plus vehicle moves. Play through the stages during a briefing.
- **Exports** — 16:9 PPTX with title, roster table and one slide per stage; print-ready PDF; ZIP of stage PNGs at 2048 or 3072 px. PPTX stage notes also go into speaker notes.
- **Autosave + JSON** — the active plan persists in `localStorage`; export/import `.prplan.json` for backups or sharing.

## Quick start

Requirements: Node.js 20+ and pnpm 10/11.

```bash
pnpm install
pnpm dev        # http://127.0.0.1:5173
pnpm build      # production build in dist/
pnpm preview
```

The repository already contains the extracted dataset in `public/data/` (≈60 MB). You do **not** need Project Reality installed to run the site.

![Map picker](docs/picker.png)

![Roster](docs/roster.png)

## Rebuilding the map data

The extractor reads the local PR installation. Default path:

```
C:\Games\Project Reality BF2\mods\pr
```

Run:

```bash
python tools/extract/extract.py
# or point at another install
set PR_ROOT=D:\Games\Project Reality BF2\mods\pr
python tools/extract/extract.py
```

It writes:

- `public/data/index.json` — map/layer index, factions, counts, image names
- `public/data/layers/<map>__<mode>__<players>.json` — flags, vehicle spawns, factions
- `public/data/maps/*.webp` — downscaled in-game minimaps
- `public/data/thumbs/*.webp` — picker thumbnails
- `public/data/vehicle-templates.txt` — classification report

The extractor uses Pillow. On the bundled DSH runtime:

```powershell
& "$env:DSH_PYTHON" tools/extract/extract.py
```

or just `python` if Pillow is installed.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes `dist/` on every push to `main`.

1. Create a GitHub repository and push this folder.
2. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually). The site appears at `https://<user>.github.io/<repo>/`.

`vite.config.ts` uses `base: './'`, so the build works from a project subpath without changes. The dataset is committed, so visitors get every map immediately.

Repository weight: ~58 MB of map data plus normal source and dependencies (dependencies are not committed).

## Using the planner

1. **Pick a map and layer** and choose which side you are planning.
2. **Roster tab** — add players, drag them between squads, assign a commander. The team cap is 50.
3. **Assets tab** — filter by type, click an asset to select and rotate it on the map, claim it for a squad. Drag assets to planned positions; a dashed line keeps the original spawn visible.
4. **Draw** — choose a tool in the left rail. Set colour, width, opacity, dash and (for arrows) both heads. For area tools, toggle "Fill area".
5. **Stages** — add stages in the bottom timeline, set the mission clock and notes in the Stage tab. Drawings and vehicle moves are stored per stage.
6. **Export** — PowerPoint, PDF or stage PNGs.

### Shortcuts

| Key | Action |
| --- | --- |
| `V` | Select / move (drag empty map to pan) |
| `P` `L` `A` `D` | Pen, line, arrow, dashed line |
| `R` `O` `G` | Rectangle, ellipse, zone polygon |
| `T` `M` `U` | Text, marker, unit symbol |
| `E` | Erase |
| Click / drag | Draw lines, arrows and areas either way |
| Wheel | Zoom to cursor (20×) |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Delete` | Remove selection or reset a moved vehicle |
| `Enter` | Finish polygon |
| `Esc` | Cancel drawing / deselect |

## Scope and limitations

- **PvP layers only.** AAS, Insurgency and Skirmish are included; CNC, COOP, gungame and training layers are deliberately excluded. The extractor's `PvP_MODES` map controls this.
- **One planning side.** The roster represents one team; enemy assets are shown as red markers and can be hidden. Switch sides in the Stage tab.
- **Delayed assets** are shown dimmed with their respawn timer. The "Start" filter in Assets shows only what is physically on the map at round start.
- **Map art** comes from Project Reality's own minimap files. It remains the property of the PR team; this is a non-commercial community tool. No game binaries are included.
- **Browser storage** is per-browser. Use *Menu → Export plan JSON* for a durable backup or to move a plan to another machine.
- Exports run entirely client-side; very large plans (many stages at 3072 px) take a few seconds.

## Project layout

```
src/
  components/     editor UI: map canvas, picker, roster, assets, stages, timeline, export dialog
  lib/            projection, canvas renderer, PPTX/PDF/PNG exporters, utilities
  icons.ts        original SVG tactical glyphs
  store.ts        Zustand plan + UI state, undo/redo, autosave
  types.ts        map, plan, roster and drawing schema
tools/extract/    PR data extractor (Python)
public/data/      extracted dataset committed for GitHub Pages
.github/          Pages deployment workflow
```

## Credits

- **Project Reality: BF2** — map imagery, control-point names, vehicle spawn data, vehicle minimap glyphs, flag textures, markers and commander-order icons. Project Reality is the work of its developers and community.
- Interface, NATO unit glyphs, editor and exporters are original to this project.
- Built with React, Konva, PptxGenJS and jsPDF.

Code is MIT licensed; PR-derived assets remain under the Project Reality team's terms.
