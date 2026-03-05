# High-Level Design — G.P. College of Pharmacy ERP

This document describes the application’s visual and structural design so that new features stay consistent.

---

## 1. Layout Shell

The app uses a **fixed shell** that wraps all authenticated pages:

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (brand + user + logout)                              │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  SIDEBAR     │  MAIN CONTENT                                 │
│  (nav by     │  (max-width container, scrollable)            │
│   section)   │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **Header:** Full-width; primary gradient, white text. Contains app title, user info, session expiry, logout.
- **Sidebar:** Fixed width (240px); dark gradient; sections with uppercase labels; links with active state (left border / accent).
- **Main:** Flex-grow; padding; scrollable. Content uses a **content container** (max-width ~1200px) for readability.

On viewports ≤768px the sidebar becomes a horizontal strip (sections wrap); body stacks vertically.

---

## 2. Design Tokens (CSS Variables)

All tokens live in `index.css` under `:root`. Use them everywhere instead of hard-coded values.

### Color

| Token | Purpose |
|-------|--------|
| `--color-primary`, `--color-primary-hover`, `--color-primary-light` | Brand blue; buttons, links, focus |
| `--color-accent` | Highlight (e.g. active nav, accents) |
| `--color-bg`, `--color-bg-subtle` | Page and subtle backgrounds |
| `--color-surface` | Cards, modals, inputs |
| `--color-border`, `--color-border-input` | Borders |
| `--color-text`, `--color-text-muted`, `--color-text-muted-2` | Text hierarchy |
| `--color-success`, `--color-danger`, `--color-warning`, `--color-info` (+ `-bg`) | Status and feedback |

### Spacing

- `--space-1` … `--space-6` (0.25rem → 1.5rem). Use for margins/padding.
- Page content padding: `--space-6` (1.5rem) or more for main area.

### Radius & shadow

- `--radius` (8px), `--radius-lg` (12px), `--radius-xl` (16px).
- `--shadow-sm`, `--shadow-md`, `--shadow-lg` for elevation.

### Motion & focus

- `--transition`, `--transition-smooth` for hover/focus.
- `--focus-ring`, `--focus-ring-offset` for accessible focus outlines.
- Respect `prefers-reduced-motion` (defined in `index.css`).

---

## 3. Typography

- **Font stack:** `'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif`.
- **Scale (semantic):**
  - Page title: ~1.5–1.75rem, font-weight 700.
  - Section title: ~1.1–1.2rem, font-weight 600–700.
  - Card title: 1rem, font-weight 600.
  - Body: 0.9–1rem; line-height 1.55.
  - Small / secondary: 0.85–0.9rem; use `--color-text-muted` or `-muted-2`.
- **Headings:** Prefer a single `h1` per page (e.g. Dashboard); then `h2`/`h3`/`h4` for sections and cards.

---

## 4. Page Structure (Content Area)

Inside `<main class="app-main">`:

1. **Optional breadcrumb** (if needed later).
2. **Page header:** `.page-header` with `.page-title` and actions (e.g. Add, Export, primary button).
3. **Content:** Sections with `.dashboard-section` or equivalent; cards in `.dashboard-cards-row` or custom grids.
4. **Cards:** Use `.dashboard-card` (or shared card class): surface background, border, radius, padding, subtle shadow; hover shadow/border.

Use a **content wrapper** with max-width (e.g. 1200px) for dense pages so long lines don’t stretch too wide on large screens.

---

## 5. Components & Patterns

- **Buttons:** `.btn`, `.btn-primary`, `.btn-secondary`; use design tokens for colors.
- **Tables:** Global `table` styles in `index.css`; wrap in `.table-wrap` for overflow.
- **Forms:** `.form-grid` (two columns where space allows); labels and inputs use tokens; `.form-actions` for submit/cancel.
- **Modals:** `.modal-overlay` + `.modal-content`; content uses `.modal` for padding/radius.
- **Empty states:** Use a single class (e.g. `.dashboard-empty` or `.placeholder-text`) and muted color.
- **Status:** `.status-badge` with modifiers (e.g. `.status-active`, `.status-pending`).

---

## 6. Responsive

- **Breakpoints:** 640px (small), 768px (sidebar collapse / layout shifts), 1024px+ (full layout).
- **Sidebar:** At ≤768px: full width, horizontal nav, section titles full width.
- **Grids:** Use `repeat(auto-fill, minmax(280px, 1fr))` (or similar) for cards so they wrap.
- **Touch:** Adequate tap targets (min ~44px); avoid hover-only critical actions.

---

## 7. Accessibility

- Focus visible on interactive elements (buttons, links, inputs) via `--focus-ring`.
- Semantic HTML: one `h1` per page, proper heading order, `main`, `nav`, `header`.
- Sufficient contrast for text (primary on background, muted for secondary).
- Reduced motion respected globally.

---

## 8. File Map

| File | Role |
|------|------|
| `index.css` | Tokens, reset, global elements (buttons, inputs, tables), scrollbar |
| `App.css` | Layout (wrapper, header, sidebar, main), page common, modals, shared components |
| `Dashboard.css` | Dashboard-specific (hero, KPI strip, cards, sections) |
| Page-level CSS | Page-specific overrides only; prefer tokens and App.css patterns |

New UI should use tokens and the layout shell first; add page-specific classes only when needed.
