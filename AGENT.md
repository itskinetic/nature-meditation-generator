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

## 3. Global Universal Sizing System (Buttons, Boxes, Inputs, Selects)

All interactive elements and form controls in ZenHub share a strict **`h-9`** (36px) baseline height and **`rounded-xl`** (12px) corner radius to ensure mathematical harmony and visual alignment across every row and column:

### Standard Universal Controls (`h-9 rounded-xl`)
- **Action Buttons**: `h-9 px-3.5 rounded-xl text-xs font-semibold` / `font-bold`
  - Examples: `Analyze & Suggest Themes`, `Balance Clips`, `+ Custom Theme`, `Add to Plan`, `Select All Approved`, `Clear`, `Select for Video`, `Ban Footage`, `Download MP4`, `Close`.
- **Text & Number Inputs**: `h-9 px-3.5 rounded-xl text-xs`
  - Examples: `Meditation Title`, `Script or Spoken Guidance`, `Target Duration` number input, `Library Search` input (`pl-9 pr-3.5`).
- **Select Dropdowns**: `h-9 px-3 rounded-xl text-xs`
  - Examples: `Duration Unit` select (`Mins` / `Hours`), `Cinematic Shot Cadence` select.
- **Toggle / Checkbox Boxes**: `h-9 px-3.5 rounded-xl text-xs`
  - Examples: `Exclude Past History` toggle container, `Approved Only` library filter container.
- **Segmented Control Buttons**: `h-9 rounded-xl text-xs font-semibold`
  - Examples: `16:9`, `9:16`, `1:1` aspect ratio pills; `1080p`, `4K` quality pills.
- **Square Icon Buttons**: `w-9 h-9 flex items-center justify-center rounded-xl`
  - Examples: `Bookmark / Library Save`, `1-Click Ban`, `Preview Eye`, `Theme Mode Toggle`.
- **Active Theme Journey Cards**: `h-9 px-3 rounded-xl text-xs`
  - Clean pill cards with icon, theme title, clip stepper (`- 4 +`), and delete button.

### Primary Large CTA Buttons (`h-11` to `h-12`)
Used exclusively for major pipeline launch actions:
- **`Fetch Footage for Plan`**: `h-12 px-8 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-md shadow-amber-500/25`.
- **`Queue for Render`**: `h-12 px-8 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-md shadow-amber-500/25`.

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
   - All interactive controls have at least 36px–44px touch targets (`h-9` buttons, `h-9` inputs/selects).
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
