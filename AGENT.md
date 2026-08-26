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

## 3. Universal Button Design System (Strict Specifications)

All interactive buttons in ZenHub follow 4 standardized tiers to guarantee visual cohesion across the entire app:

### Tier 1: Standard Universal Action Buttons
Used for all primary and secondary actions (`Analyze & Suggest Themes`, `Balance Clips`, `+ Custom Theme`, `Add to Plan`, `Select All Approved`, `Clear`, `Select for Video`, `Ban Footage`, `Download MP4`, `Close`).
- **Height**: Strictly **`h-9`** (36px).
- **Border Radius**: Strictly **`rounded-xl`** (12px radius).
- **Padding**: **`px-3.5`**.
- **Typography**: **`text-xs font-semibold`** or **`font-bold`** in Figtree.
- **Primary Accent Style**: `bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950 shadow-xs`.
- **Secondary Neutral Style**: `bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-750`.

### Tier 2: Universal Square Icon Buttons
Used for icon-only action triggers (`Bookmark / Save to Library`, `1-Click Ban`, `Video Preview Eye`, `Theme Mode Toggle`).
- **Dimensions**: Strictly **`w-9 h-9`** (36px × 36px).
- **Border Radius**: Strictly **`rounded-xl`** (12px).
- **Alignment**: `flex items-center justify-center`.
- **Icon Size**: `w-4 h-4`.

### Tier 3: Segmented Controls & Filter Tabs
Used for tab bars (`Studio / Library / History` navigation, candidate filter tabs, category pills, format buttons `16:9` / `1080p`).
- **Container Height**: **`h-9`** or **`h-10`** with `p-1 rounded-xl bg-stone-100 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800`.
- **Item Height**: **`h-7`** to **`h-7.5`** with **`px-3 rounded-lg text-xs font-semibold`**.

### Tier 4: Primary Large CTA Buttons
Used exclusively for major pipeline triggers (`Fetch Footage for Plan`, `Queue for Render`).
- **Height**: **`h-11`** to **`h-12`** (44px–48px).
- **Border Radius**: **`rounded-xl`** (12px).
- **Padding**: **`px-7`** to **`px-8`**.
- **Typography**: **`text-sm font-bold`**.
- **Accent Glow**: `bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-md shadow-amber-500/25`.

---

## 4. Strict NO Emoji Rule (Clean SVG Icons Only)

- **NEVER use raw Unicode emojis** (e.g. `✨`, `🎬`, `🔍`, `🌱`, `🏔️`, `🧘`, `🚫`, `🌲`, `🌊`) in UI buttons, badges, headings, dropdown options, or status indicators.
- **ALWAYS use clean Lucide SVG icons** with explicit dimensions (`w-3.5 h-3.5`, `w-4 h-4`) paired with clean typography.
- Examples:
  - Button: `<Wand2 className="w-3.5 h-3.5" /> Analyze & Suggest Themes` (NOT `✨ Analyze`)
  - Badges: `<Mountain className="w-2.5 h-2.5" /> Wide Vista`, `<Leaf className="w-2.5 h-2.5" /> Low Angle`, `<SearchIcon className="w-2.5 h-2.5" /> Macro`
  - Select options: Plain text (`Balanced Variety`, `Mindful Close-Ups`, `Deep Stillness`, `Expansive Vistas`).

---

## 5. Mobile-First Responsive Optimization System

ZenHub is designed with mobile-first responsiveness across all screen sizes (from 360px phones to 4K monitors):

1. **Responsive Grid Cascades**:
   - Form inputs & Theme grids: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` with tight `gap-2.5` / `gap-3.5`.
   - Settings row: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
2. **Touch Target Dimensions**:
   - All interactive controls have at least 36px–44px touch targets (`h-9` buttons, `h-10` inputs/selects).
   - Spacing includes `touch-manipulation` to prevent tap delays on iOS Safari and Android Chrome.
3. **Adaptive Action Bars**:
   - Primary action buttons: `w-full sm:w-auto` so mobile users get full-width thumb-friendly buttons.
   - Header tabs: Compact pill indicators on mobile (`hidden xs:inline` for secondary labels).
4. **Zero Viewport Overflow**:
   - Main container: `w-full overflow-x-hidden max-w-5xl mx-auto px-4 sm:px-6`.
   - Modals and drawers: Max viewport height `max-h-[92vh]` with internal smooth scrolling (`overflow-y-auto`).

---

## 6. Color Palette & Tone (Meditation Calm Yellow)

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

## 7. Strict Visual Banned Filters (Zero Tolerance)

The search engine, heuristics, and Gemini Vision prompt MUST strictly reject and ban:

1. **Boats & Watercraft**: Boats, ships, yachts, speedboats, motorboats, canoes, kayaks, watercraft, sailing vessels.
2. **Docks & Harbors**: Docks, piers, marinas, harbors, boat slips, jetties, ports.
3. **Drone Survey Shots**: High-altitude fast drone flyovers, high aerial survey maps, top-down distant vistas.
4. **Man-Made Structures**: Buildings, houses, resorts, hotels, cabins, swimming pools, roads, cars, bridges, fences.
5. **People**: Tourists, swimmers, divers, crowds, visible human activities.
6. **Murky Waters**: Algae scum, marsh sludge, stagnant swamp waters, muddy brown water.
7. **Bad Color Profiles**: Flat LOG profiles, unedited washed-out RAW footage, dull grey/gloomy lifeless overcast scenes.

---

## 8. Cinematic Shot Type Diversity Engine

Every clip is classified into one of 5 cinematic perspectives:

| Shot Type | Badge Icon + Label | Description & Meditation Role |
| :--- | :--- | :--- |
| **`close_up`** | `<SearchIcon /> Macro` | Dew drops, leaf veins, petal flutter, ripples (Mindfulness & Presence) |
| **`low_angle`** | `<Leaf /> Low Angle` | Ground-level looking up through grass/roots/trees (Grounding & Stability) |
| **`wide_vista`** | `<Mountain /> Wide Vista` | Expansive sunlit valley, lake, horizon (Spaciousness & Calm) |
| **`still_ambient`** | `<Clock /> Still` | Locked-off static tripod shot with natural motion (Deep Stillness & Sleep) |
| **`slow_glide`** | `<Waves /> Slow Glide` | Ultra-slow smooth tracking glide or pan (Flow & Transition) |

- **Shot Cadence Options**:
  - `Balanced Variety` (Default — sequences wide, macro, low-angle, still)
  - `Mindful Close-Ups` (Macro & textures)
  - `Deep Stillness` (Static & locked-off tripod)
  - `Expansive Vistas` (Wide horizon landscapes)

---

## 9. AI Script Director & Interactive Theme Review Flow

1. User enters **Meditation Title** or **Script Guidance**.
2. User clicks **`Analyze & Suggest Themes`**.
3. AI analyzes emotional intent, mood, energy level, and visual metaphors.
4. **Suggested Visual Journey Card** renders interactively:
   - Displays Detected Intent & Mood tags.
   - Shows 3–4 suggested nature themes with inline clip steppers (`-` / `+`) and delete buttons (`✕`).
   - Allows adding custom themes or selecting from the compact 20-theme accordion.
   - **DO NOT automatically jump or trigger search without user consent.** User reviews the plan, then clicks **`Fetch Footage for Plan (X clips)`** when ready.

---

## 10. Single Theme Presets (Zero Ampersands)

All nature environment presets use punchy single titles without ampersands (`&`):
- `Sunlit Forest`, `Calm Ocean`, `Wildflower Meadow`, `Mountain Lakes`, `Golden Sunrise`, `Rainforest`, `Waterfalls`, `Grasslands`, `Bamboo`, `Cherry Blossoms`, `Sandy Beach`, `Clouds`, `Autumn Woods`, `Desert Dunes`, `Lotus Ponds`, `Alpine Valleys`, `Tropical Lagoons`, `Riverbed`, `Fern Canyon`, `Sunset Twilight`.

---

## 11. Footage Control: 1-Click Ban & History Filter

1. **1-Click Video Ban (`<Ban /> Ban`)**:
   - Present on candidate cards and inside the full video preview modal.
   - Banning instantly removes clip from UI and saves record with `is_approved = False` in SQLite so it is **never fetched or recommended again**.
2. **Exclude Past History Filter**:
   - Toggle switch in settings.
   - When enabled, excludes any clip previously rendered in history (`usage_count > 0`) to guarantee 100% fresh footage.

---

## 12. React Portal Rule for Modals

- **ALWAYS** render floating modals, preview players, and drawers using **`createPortal(jsx, document.body)`**.
- Standard modal layout:
  ```tsx
  createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 my-auto">
        ...
      </div>
    </div>,
    document.body
  )
  ```
- This prevents CSS `transform` / `backdrop-blur` in parent containers from breaking `position: fixed` relative to the viewport.
