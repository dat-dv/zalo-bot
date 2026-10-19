# 5-Level Atomic UI Hierarchy, 4 UI States, & Component Discipline

To guarantee zero component bloat and maintain a scalable UI library, all frontend code adheres to a strict 5-level hierarchy.

## 1. The 5-Level UI Hierarchy

```mermaid
flowchart TD
    L5["Level 5: Route Page (src/app/.../page.tsx)\n- Pure RSC, exports metadata, fetches initial data, renders Level 4 View"]
    L4["Level 4: Screen Controller View (src/modules/<feature>/presentation/views/)\n- 'use client', manages Form lifecycle, coordinates 4 UI States"]
    L3["Level 3: Feature Organism (src/modules/<feature>/presentation/components/)\n- Feature-specific complex blocks: Data Table, Filter Bar, Detail Card"]
    L2["Level 2: Shared Molecule (src/components/molecules/)\n- Generic composed UI: SearchInput, FormField, PaginationControl"]
    L1["Level 1: Shared Primitive Atom (src/components/atoms/)\n- Shadcn UI / Radix primitives: Button, Input, Badge, Dialog, Skeleton"]

    L5 --> L4
    L4 --> L3
    L4 --> L2
    L3 --> L2
    L2 --> L1
```

## 2. Mandatory Handling of 4 UI States

Every Level 4 View or interactive Screen Controller MUST explicitly manage and render 4 UI states:

1. **Loading State**: Render explicit **Skeleton Loading** layouts (`<Skeleton className="..." />`) matching final content geometry to prevent Cumulative Layout Shifts (CLS). Never render raw text `"Loading..."`.
2. **Error State**: Render descriptive error messages with an interactive **Retry Button** (`<Button onClick={() => refetch()}>Retry</Button>`).
3. **Empty State**: When returned data arrays are empty (`data.length === 0`), render an informative empty state illustration, message, and primary CTA.
4. **Success State**: Render the complete, animated data view (tables, lists, cards) with Hallmark visual polish.

## 3. Component Discipline & Coding Constraints

- **RULE-03 (Shadcn UI Atoms First)**: NEVER dump raw HTML interactive tags (`<button>`, `<input>`, `<select>`) directly into views. Always reuse or create shared primitives in `src/components/atoms/`.
- **File Length Limit**: Component files MUST NOT exceed **80-100 lines**. If a component grows beyond this limit, decompose it into sub-components in `presentation/components/`.
- **No Raw Inline SVG Markup**: Do NOT paste raw `<svg>...</svg>` blocks inside component files. Use `lucide-react` icons or separate SVG icon components under `src/components/icons/`.
- **Accessibility (a11y)**: All icon-only buttons MUST include `aria-label` and all form fields MUST pair `<Label htmlFor="...">` with `<Input id="...">`.
