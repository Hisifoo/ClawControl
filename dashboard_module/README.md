# Oaken Cloud Dashboards

Dashboard server for all OpenClaw agents. Serves HTML pages with inline styles on port 8000.

## Architecture

- **Single file**: `server.js` (Node.js, no build step, no npm dependencies)
- **Charts**: [Chart.js 4.x](https://www.chartjs.org/) via CDN
- **Theme**: Dark mode with CSS custom properties
- **Data**: Each page fetches from its own `/api/*` endpoint or reads local files

## Running

```bash
# Inside the openclaw container
cd /home/openclaw/.openclaw/workspace/dashboards
./start.sh
```

The server listens on `0.0.0.0:8000`. Nginx proxies it externally.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard index — links to all pages |
| `/directories` | SEO directory submission tracker |
| `/todoist` | Todoist task viewer across all projects |
| `/agnes` | Agnes's pre-rendered PsyFiGPT admin dashboard |
| `/charts` | **Chart examples reference** — 6 chart types with copy-paste code |
| `/api/directories` | JSON API for directory data |
| `/api/todoist` | JSON API for Todoist tasks + comments |

## Shared Template System

All pages use 4 template functions defined at the top of `server.js`:

### `pageHead(title, { includeChartJs })`
Returns the `<head>` block with all shared CSS. Pass `includeChartJs: true` to include the Chart.js CDN script.

### `pageHeader(title, subtitle, activePath)`
Returns the nav bar and page title. `activePath` highlights the current page in the nav (e.g., `'/directories'`).

### `pageFooter({ autoRefresh })`
Returns the footer with timestamp. Pass `autoRefresh: true` to show the "Auto-refreshes every 30s" indicator.

### `chartDefaults()`
Returns a `<script>` block that configures Chart.js global defaults (colors, fonts, tooltips). **Must be included before any chart code** on pages that use Chart.js.

## Adding a New Dashboard Page

1. **Define the route handler** in `server.js`:
```javascript
function myDashboard(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`${pageHead('My Dashboard', { includeChartJs: true })}
${pageHeader('🔧 My Dashboard', 'Description here', '/my-page')}
${chartDefaults()}

<!-- your content here -->

${pageFooter({ autoRefresh: true })}`);
}
```

2. **Register the route** in the `routes` object:
```javascript
const routes = {
  // ... existing routes
  '/my-page': myDashboard,
};
```

3. **Add to the nav bar** — add an entry to the `NAV_ITEMS` array:
```javascript
const NAV_ITEMS = [
  // ... existing items
  { href: '/my-page', icon: '🔧', label: 'My Page' },
];
```

4. **Restart the server** after editing.

## Design System

### Color Palette

| Variable | Hex | Usage |
|----------|-----|-------|
| `--bg` | `#0f172a` | Page background |
| `--surface` | `#1e293b` | Card/component backgrounds |
| `--border` | `#334155` | Borders, dividers |
| `--text` | `#e2e8f0` | Primary text |
| `--muted` | `#94a3b8` | Secondary text, labels |
| `--accent` | `#3b82f6` | Links, active states, primary action |
| `--green` | `#22c55e` | Success, "done" status |
| `--red` | `#ef4444` | Error, "failed" status, P1 priority |
| `--yellow` | `#eab308` | Warning, "pending" status, P3 priority |
| `--purple` | `#a855f7` | Secondary highlight |
| `--orange` | `#f97316` | Tertiary highlight, P2 priority |

In Chart.js code, use the `COLORS` object (`COLORS.accent`, `COLORS.green`, etc.) and `COLOR_PALETTE` array for automatic cycling.

### CSS Classes

**Layout:**
- `.page` — main content wrapper (max-width 1400px, padded)
- `.grid` + `.grid-2` / `.grid-3` / `.grid-4` — responsive grid layouts

**Cards:**
- `.card` — standard card container
- `.card-header` — uppercase muted label inside cards
- `.value` — large stat number
- `.sub` — small muted subtext

**Tables:**
- Standard `<table>` with sortable `<th>` headers
- `.badge` + `.badge-done` / `.badge-pending` / `.badge-failed` / `.badge-skipped`

**Filters:**
- `.filter-bar` + `.filter-btn` / `.filter-btn.active`
- `input.search` — styled search input

**Charts:**
- `.chart-container.wide` — max-height 350px, good for bar/line
- `.chart-container.square` — max 320x320, good for doughnut/pie

**Utilities:**
- `.green`, `.red`, `.yellow`, `.purple`, `.orange`, `.accent` — text color classes
- `.progress-bar` + `.progress-fill.green-bg` / `.accent-bg` / `.purple-bg`

### Chart.js Conventions

The `chartDefaults()` script sets:
- Dark theme: muted axis text, low-opacity grid lines
- Tooltip styled to match `--surface` / `--text`
- Point-style legend labels with 16px padding
- Responsive + maintain aspect ratio

When creating charts:
- Use `borderRadius: 6` and `borderSkipped: false` on bar charts for rounded corners
- Use `tension: 0.35` on line charts for smooth curves
- Use `fill: true` with low-opacity `backgroundColor` for area effects
- Use `cutout: '65%'` for doughnut charts
- Set `borderColor: 'transparent'` on doughnut/pie segments

### Adding a Data API

Follow the existing pattern — create a handler that reads JSON and returns it:

```javascript
function myApi(req, res) {
  try {
    const data = JSON.parse(fs.readFileSync('/path/to/data.json', 'utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}
```

Register it at `/api/my-thing` in the `routes` object. Then fetch from it client-side:

```javascript
const r = await fetch('/api/my-thing');
const data = await r.json();
```

## File Locations

- **Server**: `/home/openclaw/.openclaw/workspace/dashboards/server.js`
- **Start script**: `/home/openclaw/.openclaw/workspace/dashboards/start.sh`
- **Directory data**: `/home/openclaw/.openclaw/workspace/memory/directory-tracking.json`
- **Agnes dashboard**: `/home/openclaw/.openclaw/agnes-workspace/dashboard_output/dashboard.html`
- **Todoist token**: `/home/openclaw/.openclaw/credentials/todoist`
