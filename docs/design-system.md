# Design system

This guide records the visual patterns already used in the app. Extend these patterns when building screens; do not introduce new colors, type scales, control sizes, or table behavior without a product decision.

## Visual foundations

### Color

The app uses Zinc neutrals, with blue for primary actions and red for destructive actions.

| Role | Light mode | Dark mode | Existing use |
| --- | --- | --- | --- |
| Main background | `bg-white` / `bg-zinc-50` | `bg-zinc-950` | Page and toolbar surfaces |
| Raised surface | `bg-white` | `bg-zinc-900` | Menus, selected navigation, table headers |
| Hover surface | `bg-zinc-100` | `bg-zinc-800` or `bg-zinc-900` | Buttons, menu items, table rows |
| Main text | `text-zinc-950` / `text-black` | `text-zinc-100` | Titles and primary content |
| Supporting text | `text-zinc-500` | `text-zinc-400` / `text-zinc-500` | Labels, counts, helper text |
| Border / neutral ring | `zinc-200`–`zinc-300` | `zinc-700`–`zinc-800` | Dividers, outlines, focus rings |
| Primary action | `bg-blue-600`, hover `bg-blue-700` | Same blue, light foreground | Insert, submit, confirm |
| Destructive action | `bg-red-600`, hover `bg-red-700` | Same red, light foreground | Delete and destructive confirmation |
| Pending state | Existing orange accent | `dark:ring-orange-500` | Unsaved changes indicator |

Global semantic colors are defined as HSL variables in `styles/globals.css`; Tailwind maps them in `tailwind.config.js`. App screens also use explicit Zinc and blue classes. Keep these in sync when changing the palette.

### Typography

- The general body defaults to 16px and weight 500 in `styles/globals.css`.
- Compact application controls, table data, dropdown items, and supporting text use `text-xs font-semibold` (use `!text-xs !font-semibold` where the component base styles override them).
- Page and dialog headings use `text-sm font-semibold`.
- The SQL editor uses a monospace font at 14px.
- Keep labels and values compact. Do not increase text size to emphasize a control; use the existing color, weight, or border treatment.

### Spacing and shape

- Main app sidebar: `w-[240px]`; content offset: `ml-[240px]`.
- Main toolbar height: `h-[53px]`.
- Standard page/title row horizontal inset: `px-4` (16px). Table results can remain flush to the content edge; inset only the controls or title row when that is how the surrounding page is laid out.
- Compact buttons: `h-6 p-1 px-2`; compact fields and pagination controls keep their existing component-specific heights and widths.
- Menus and inline content commonly use `p-1`, `px-2`, and `py-1`.
- Use the existing rounded sizes from shadcn components (`rounded-md` for controls, `rounded-lg` for cards/dialogs). Avoid adding extra shadows to compact controls.

## Components and patterns

### Buttons

- **Primary:** blue background and blue ring, white text, `h-6 p-1 px-2`, `text-xs font-semibold`; add a 12px icon when the action has a known icon.
- **Neutral:** white/dark surface, Zinc ring, no shadow, same compact dimensions and typography.
- **Destructive:** red background and ring, same compact dimensions; confirmation dialogs use the same red action style.
- **Icon-only:** use the existing icon button dimensions and provide an accessible label or tooltip.
- Disabled controls retain their layout and use the existing disabled opacity; do not hide or resize them unexpectedly.

### Inputs and dropdowns

- Use the shared components in `components/ui` and follow their existing focus, disabled, and keyboard behavior.
- In compact product forms, explicitly apply `text-xs font-semibold` and the existing Zinc border/ring and padding conventions.
- Keep dropdown text, selected values, icons, and check marks aligned with consistent horizontal padding. Do not add custom spacing to only one item in a list.

### Tables and query results

- `QueryResultsTable` is the canonical results grid for table views, SQL results, and activity history.
- Use a monospace font for table headers, values, and editable cells so database values remain easy to scan; preserve the existing compact text size and weight.
- Keep table cells compact and consistent. Use the existing cell editor for editing; do not create a second input style for inserts or other table actions.
- Enable row selection only when the result supports row actions. Metadata and settings results do not show selection controls.
- Keep the selection and pinned ID columns’ borders visible during horizontal scroll. Apply the existing horizontal-scroll shadow only when content can scroll.
- Keep pagination controls in the toolbar row, using the existing page label, rows-per-page select, and Previous/Next buttons.

### Tabs

- Use the shared Radix-based component in `components/ui/tabs.jsx`.
- Preserve its active/inactive states and focus behavior. For compact filters, use the existing compact dimensions (`h-7 p-0.5` on the list; `h-6 px-2 py-0` on triggers) and `text-xs font-semibold` labels.

### Dialogs

- Use the shared dialog primitives in `components/ui/dialog.jsx` or `components/ui/alert-dialog.jsx`.
- Titles use `text-sm font-semibold`; body and supporting text use `text-xs font-semibold`.
- Use the same neutral and primary/destructive button styles as the rest of the app. Keep the overlay, border, and surface behavior from the shared primitive.

### Feedback and status

- Keep loading, empty, and error messages in the same content alignment as the controls they describe.
- Use Zinc supporting text for neutral states, red for errors, blue for primary actions, and orange only for pending-change emphasis already used by the app.
- Preserve useful date, time, row-count, and status information in data tables.

## Interaction and accessibility

- Keep existing keyboard, focus-visible, disabled, and screen-reader behavior from Radix and shadcn primitives.
- Give icon-only actions an accessible name. Use tooltips for icon buttons whose purpose is otherwise unclear.
- Do not communicate success, error, selection, or pending changes through color alone; retain the existing text, icon, or selected-state indicator.
- Prefer consistent behavior across table pages, SQL results, dialogs, and dropdowns over page-specific variants.

## Source files

- Global palette and base styles: `styles/globals.css`
- Tailwind semantic color mapping: `tailwind.config.js`
- Shared control primitives: `components/ui/`
- Canonical table and cell editor: `components/queryResults/table/index.js`
- Main table/query workspace: `pages/app/playground/play/[id]/index.js`
