# ZenHub - Master Design & Engineering Guide (`AGENT.md`)

This guide serves as the single source of truth for **ZenHub** (Nature Meditation Video Loop Generator). It documents all user requirements, design rules, color palettes, visual guidelines, and architectural patterns.

> **CRITICAL RULE**: Whenever adding features, modifying UI, or touching backend scoring/search, ALWAYS review and strictly adhere to the guidelines in this file. **Zero design drift.**

---

## 1. Product Identity & Architecture

- **Product Name**: **ZenHub**
- **Domain**: `https://zenhub.likhanijo.com`
- **GitHub Repository**: `https://github.com/itskinetic/nature-meditation-generator` (`main` branch)
- **Deployment**: Automatic webhook build & deploy on VPS via Easypanel + Traefik.
- **Backend Stack**: Python FastAPI, SQLite (SQLAlchemy), FFmpeg / FFprobe, Pexels & Pixabay APIs, Gemini Flash Vision & Intent API.
- **Frontend Stack**: React 18 (TypeScript), Vite, TailwindCSS, Lucide Icons, TanStack Query (React Query).

---

## 2. Typography Rules (Strict)

- **Logo Text ONLY (`ZenHub` in Header)**:
  - Font: **`Corben`** (`font-logo`).
  - Never use Corben for any other text, headings, or buttons.
- **All Other UI Text (Headings, Body, Labels, Inputs, Buttons, Badges)**:
  - Font: **`Figtree`** (`font-sans`).
  - Google Fonts import configured in `index.html` and Tailwind `fontFamily`.

---

## 3. Color Palette & Tone (Meditation Calm Yellow)

- **Primary Accent**: **Soft Luminous Meditation Yellow** (`#fef9c3`, `#fde047`, `#facc15`, `#eab308`).
  - **NEVER use harsh amber/orange** (`#f59e0b`, `#d97706`).
  - Accent borders: `border-amber-400/60` or `border-amber-500/20`.
  - Active button background: `bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950`.
- **Backgrounds**:
  - Light mode: `#fbfaf7` (warm serene off-white).
  - Night mode: `#0c0e12` (deep tranquil charcoal-black).
- **Cards**:
  - Light mode: `bg-white` with `border-stone-200/90`.
  - Dark mode: `bg-stone-900/80` with `border-stone-800/80`.

---

## 4. Layout Dimensions & Universal Button Sizing

### Container Width
- **Main Dashboard & Header**: Strictly **`max-w-5xl`** (`w-full mx-auto px-4 sm:px-6`).
- **NEVER use `max-w-7xl`** or unbounded full-width on dashboards (causes overstretched, incohesive UI).

### Universal Button Standards
- **Standard Action Buttons** (`✨ Analyze & Suggest Themes`, `Balance Clips`, `+ Custom Theme`, `Queue`, `Select for Video`, etc.):
  - **Height**: Strictly **`h-9`** (36px).
  - **Border Radius**: Strictly **`rounded-xl`** (12px).
  - **Padding**: `px-3.5`.
  - **Font**: `text-xs font-semibold` or `font-bold`.
- **Primary Large CTA Buttons** (`Fetch Footage for Plan`, `Queue for Render`):
  - **Height**: `h-11` to `h-12` (44px–48px).
  - **Border Radius**: `rounded-xl`.
  - **Padding**: `px-7` to `px-8`.
  - **Font**: `text-sm font-bold`.
- **Standard Inputs & Selects**:
  - Height: `h-10` with `rounded-xl` and `px-3.5`.

---

## 5. Strict Visual Banned Filters (Zero Tolerance)

The search engine, heuristics, and Gemini Vision prompt MUST strictly reject and ban:

1. **Boats & Watercraft**: Boats, ships, yachts, speedboats, motorboats, canoes, kayaks, watercraft, sailing vessels.
2. **Docks & Harbors**: Docks, piers, marinas, harbors, boat slips, jetties, ports.
3. **Drone Survey Shots**: High-altitude fast drone flyovers, high aerial survey maps, top-down distant vistas.
4. **Man-Made Structures**: Buildings, houses, resorts, hotels, cabins, swimming pools, roads, cars, bridges, fences.
5. **People**: Tourists, swimmers, divers, crowds, visible human activities.
6. **Murky Waters**: Algae scum, marsh sludge, stagnant swamp waters, muddy brown water.
7. **Bad Color Profiles**: Flat LOG profiles, unedited washed-out RAW footage, dull grey/gloomy lifeless overcast scenes.

---

## 6. Cinematic Shot Type Diversity Engine

Every clip is classified into one of 5 cinematic perspectives:

| Shot Type | Badge | Description & Meditation Role |
| :--- | :--- | :--- |
| **`close_up`** | `🔍 Macro` | Dew drops, leaf veins, petal flutter, ripples (Mindfulness & Presence) |
| **`low_angle`** | `🌱 Low Angle` | Ground-level looking up through grass/roots/trees (Grounding & Stability) |
| **`wide_vista`** | `🏔️ Wide Vista` | Expansive sunlit valley, lake, horizon (Spaciousness & Calm) |
| **`still_ambient`** | `🧘 Still Ambient` | Locked-off static tripod shot with natural motion (Deep Stillness & Sleep) |
| **`slow_glide`** | `✨ Slow Glide` | Ultra-slow smooth tracking glide or pan (Flow & Transition) |

- **Shot Cadence Options**:
  - `Balanced Variety` (Default — sequences wide, macro, low-angle, still)
  - `Mindful Close-Ups` (Macro & textures)
  - `Deep Stillness` (Static & locked-off tripod)
  - `Expansive Vistas` (Wide horizon landscapes)

---

## 7. AI Script Director & Interactive Theme Review Flow

1. User enters **Meditation Title** or **Script Guidance**.
2. User clicks **`✨ Analyze & Suggest Themes`**.
3. AI analyzes emotional intent, mood, energy level, and visual metaphors.
4. **Suggested Visual Journey Card** renders interactively:
   - Displays Detected Intent & Mood tags.
   - Shows 3–4 suggested nature themes with inline clip steppers (`-` / `+`) and delete buttons (`✕`).
   - Allows adding custom themes or selecting from the compact 20-theme accordion.
   - **DO NOT automatically jump or trigger search without user consent.** User reviews the plan, then clicks **`Fetch Footage for Plan (X clips)`** when ready.

---

## 8. Single Theme Presets (Zero Ampersands)

All nature environment presets use punchy single titles without ampersands (`&`):
- `Sunlit Forest`, `Calm Ocean`, `Wildflower Meadow`, `Mountain Lakes`, `Golden Sunrise`, `Rainforest`, `Waterfalls`, `Grasslands`, `Bamboo`, `Cherry Blossoms`, `Sandy Beach`, `Clouds`, `Autumn Woods`, `Desert Dunes`, `Lotus Ponds`, `Alpine Valleys`, `Tropical Lagoons`, `Riverbed`, `Fern Canyon`, `Sunset Twilight`.

---

## 9. Footage Control: 1-Click Ban & History Filter

1. **1-Click Video Ban (`🚫 Ban`)**:
   - Present on candidate cards and inside the full video preview modal.
   - Banning instantly removes clip from UI and saves record with `is_approved = False` in SQLite so it is **never fetched or recommended again**.
2. **Exclude Past History Filter**:
   - Toggle switch in settings.
   - When enabled, excludes any clip previously rendered in history (`usage_count > 0`) to guarantee 100% fresh footage.

---

## 10. React Portal Rule for Modals

- **ALWAYS** render floating modals, preview players, and drawers using **`createPortal(jsx, document.body)`**.
- Standard modal layout:
  ```tsx
  createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 my-auto">
        ...
      </div>
    </div>,
    document.body
  )
  ```
- This prevents CSS `transform` / `backdrop-blur` in parent containers from breaking `position: fixed` relative to the viewport.
