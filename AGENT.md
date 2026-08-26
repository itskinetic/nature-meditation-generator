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
  - **Button Typography Rule**: Use clean **`font-medium`** or **`font-semibold`** (NEVER aggressive heavy/black bold).

---

## 3. Global Universal Sizing & Pastel Button System

All interactive controls in ZenHub follow a unified **`h-9`** (36px) baseline height, **`rounded-xl`** (12px) corner radius, and soft pastel aesthetic:

### Button Styling Rules (Pastel & Non-Bold)
- **Primary Action Buttons** (`Analyze & Suggest Themes`, `+ Custom Theme`, `Add to Plan`, `Fetch Footage for Plan`, `Queue for Render`):
  - **Background**: Soft serene pastel yellow `bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200/80 dark:hover:bg-amber-900/80`.
  - **Border**: `border border-amber-300/80 dark:border-amber-800/60`.
  - **Text**: `text-amber-950 dark:text-amber-200 font-medium text-xs`.
  - **Height & Radius**: `h-9 rounded-xl px-3.5` or `px-4`.
  - **Shadow**: Clean `shadow-xs`.
- **Secondary Action Buttons** (`Balance Clips`, `Select All Approved`, `Clear`, `Cancel`):
  - `bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium text-xs h-9 rounded-xl px-3.5`.
- **Square Icon Buttons**: `w-9 h-9 flex items-center justify-center rounded-xl`.
- **Form Inputs & Selects**:
  - `Meditation Title` & `Script` inputs: `h-9 px-3.5 rounded-xl text-xs`.
  - `Target Duration` compact box: `h-9 w-36 max-w-[145px] rounded-xl text-xs`.
  - `Cinematic Shot Cadence` & `Duration Unit`: `h-9 rounded-xl text-xs`.
  - `History Filter` toggle box: `h-9 px-3.5 rounded-xl text-xs`.
- **Active Theme Journey Cards**:
  - Rendered with `flex flex-wrap items-center gap-2` and `whitespace-nowrap` so no text is ever cut off or truncated.

---

## 4. Layout Hierarchy & Stage Flow

1. **Stage 1 (Meditation Concept & AI Script Director)**:
   - Meditation Title + Guidance Script inputs.
   - **`Analyze & Suggest Themes` button is positioned directly below the inputs** (right-aligned).
   - Interactive Suggested Visual Journey card with active themes and clip steppers.
   - Settings row (`Target Duration`, `Format & Quality`, `Cinematic Shot Cadence`, `History Filter`).
   - Bottom footer: Concept summary + `Fetch Footage for Plan` pastel button.
2. **Stage 2 (Footage Review & Sequence Curation)**:
   - Appears once candidate footage is fetched.
   - Candidate cards with preview, approved/rejected badges, scoring breakdown, and `Select for Video` pastel button.
3. **Stage 3 (Render Final Video)**:
   - Hidden until candidate footage is available.
   - Clean single-row bar with video configuration summary and `Queue for Render` pastel button.

---

## 5. Strict NO Emoji Rule (Clean SVG Icons Only)

- **NEVER use raw Unicode emojis** in UI buttons, badges, headings, dropdown options, or status indicators.
- **ALWAYS use clean Lucide SVG icons** (`w-3.5 h-3.5`, `w-4 h-4`) paired with clean Figtree typography.

---

## 6. Mobile-First Responsive Optimization System

- Main container: `max-w-5xl mx-auto px-4 sm:px-6 w-full overflow-x-hidden`.
- Touch targets: standard 36px (`h-9`) controls with `touch-manipulation`.
- Grid cascades: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

---

## 7. Strict Visual Banned Filters (Zero Tolerance)

The search engine, heuristics, and Gemini Vision prompt MUST strictly reject and ban:
1. Boats & Watercraft
2. Docks & Harbors
3. Drone Survey Shots
4. Man-Made Structures
5. People & Tourists
6. Murky / Algae Waters
7. Dull / Overcast / Flat LOG profiles

---

## 8. Cinematic Shot Type Diversity Engine

Five perspectives: `close_up` (Macro), `low_angle` (Low Angle), `wide_vista` (Wide Vista), `still_ambient` (Still), `slow_glide` (Slow Glide).

---

## 9. Single Theme Presets (Zero Ampersands)

All presets use punchy single titles without ampersands (`&`):
- `Sunlit Forest`, `Calm Ocean`, `Wildflower Meadow`, `Mountain Lakes`, `Golden Sunrise`, `Rainforest`, `Waterfalls`, `Grasslands`, `Bamboo`, `Cherry Blossoms`, `Sandy Beach`, `Clouds`, `Autumn Woods`, `Desert Dunes`, `Lotus Ponds`, `Alpine Valleys`, `Tropical Lagoons`, `Riverbed`, `Fern Canyon`, `Sunset Twilight`.

---

## 10. React Portal Rule for Modals

- ALWAYS render floating modals, preview players, and drawers using `createPortal(jsx, document.body)`.
