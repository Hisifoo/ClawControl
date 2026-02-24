const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const TODOIST_TOKEN = fs.readFileSync('/home/openclaw/.openclaw/credentials/todoist', 'utf8').trim();
const TODOIST_API = 'https://api.todoist.com/api/v1';

const DATA_DIR = '/home/openclaw/.openclaw/workspace/dashboards/data';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

async function todoistFetch(endpoint, opts = {}) {
  const url = `${TODOIST_API}${endpoint}`;
  const res = await fetch(url, {
    ...opts,
    headers: { 'Authorization': `Bearer ${TODOIST_TOKEN}`, 'Content-Type': 'application/json', ...opts.headers }
  });
  if (res.status === 204) return null;
  const data = await res.json();
  return data.results || data;
}

// ── Agent Data Helpers ──────────────────────────────────────────────

function readAgentData(agent) {
  const file = path.join(DATA_DIR, `${agent}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function serveAgentApi(agent, req, res) {
  const data = readAgentData(agent);
  if (data) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('null');
  }
}

// ── Shared Template System ──────────────────────────────────────────

const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
const FONT_STACK = "'Inter', system-ui, sans-serif";
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', monospace";

const NAV_ITEMS = [
  { href: '/', icon: '🌳', label: 'Home' },
  { href: '/florence', icon: '🏠', label: 'Florence' },
  { href: '/jerry', icon: '💻', label: 'Jerry' },
  { href: '/clarissa', icon: '📣', label: 'Clarissa' },
  { href: '/agnes', icon: '💰', label: 'Agnes' },
  { href: '/directories', icon: '📂', label: 'Directories' },
  { href: '/todoist', icon: '✅', label: 'Todoist' },
  { href: '/charts', icon: '📈', label: 'Charts Ref' },
];

function pageHead(title, { includeChartJs = false } = {}) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Oaken Cloud</title>
${includeChartJs ? `<script src="${CHART_JS_CDN}"></script>` : ''}
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --surface-hover: #21262d; --border: rgba(240,246,252,0.15); --border-light: rgba(240,246,252,0.08);
    --text: #e6edf3; --muted: #8b949e; --accent: #00d9ff; --accent-hover: #00a3bf;
    --green: #22c55e; --red: #ef4444; --yellow: #f59e0b; --purple: #a855f7; --orange: #f97316;
    --bg-deep: #06080a; --bg-active: #30363d; --text-muted: #484f58; --accent-subtle: rgba(0,217,255,0.1);
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3); --shadow-md: 0 4px 12px rgba(0,0,0,0.4); --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
    --glow-cyan: 0 0 20px rgba(0,217,255,0.25);
    --font: ${FONT_STACK}; --font-display: ${FONT_DISPLAY}; --font-mono: ${FONT_MONO};
    --radius: 10px; --radius-sm: 6px; --radius-pill: 9999px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--font); background: var(--bg); color: var(--text); min-height: 100vh; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ── Nav Bar ── */
  .nav { background: var(--surface); border-bottom: 1px solid var(--border-light); padding: 0 24px; display: flex; align-items: center; height: 52px; gap: 8px; position: sticky; top: 0; z-index: 100; }
  .nav-brand { font-weight: 700; font-size: 1.05rem; margin-right: 16px; white-space: nowrap; color: var(--text); text-decoration: none; }
  .nav-brand:hover { text-decoration: none; color: var(--accent); }
  .nav-links { display: flex; gap: 2px; overflow-x: auto; }
  .nav-link { padding: 6px 14px; border-radius: var(--radius-sm); font-size: 0.82rem; color: var(--muted); transition: all 0.15s; white-space: nowrap; text-decoration: none; }
  .nav-link:hover { background: var(--bg); color: var(--text); text-decoration: none; }
  .nav-link.active { background: var(--bg); color: var(--accent); font-weight: 600; }

  /* ── Layout ── */
  .page { padding: 28px 32px 40px; max-width: 1400px; margin: 0 auto; }
  .page-title { font-size: 1.8rem; font-weight: 700; margin-bottom: 4px; font-family: var(--font-display); }
  .page-subtitle { color: var(--muted); font-size: 0.9rem; margin-bottom: 28px; }

  /* ── Cards ── */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; transition: border-color 0.2s, box-shadow 0.2s; }
  .card:hover { border-color: rgba(0,217,255,0.3); box-shadow: var(--glow-cyan); }
  .card-header { font-size: 0.85rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .card .value { font-size: 2rem; font-weight: 700; line-height: 1.2; font-family: var(--font-mono); }
  .card .sub { font-size: 0.8rem; color: var(--muted); margin-top: 4px; }

  /* ── Grids ── */
  .grid { display: grid; gap: 16px; margin-bottom: 24px; }
  .grid-2 { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); }
  .grid-3 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .grid-4 { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
  .grid-5 { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }

  /* ── Color utility classes ── */
  .green { color: var(--green); } .red { color: var(--red); } .yellow { color: var(--yellow); }
  .purple { color: var(--purple); } .orange { color: var(--orange); } .accent { color: var(--accent); }

  /* ── Progress Bars ── */
  .progress-bar { background: var(--border); border-radius: var(--radius-sm); height: 12px; margin-top: 12px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: var(--radius-sm); transition: width 0.5s; }
  .progress-fill.green-bg { background: var(--green); }
  .progress-fill.accent-bg { background: var(--accent); }
  .progress-fill.purple-bg { background: var(--purple); }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--muted);
       text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; cursor: pointer; user-select: none; }
  th:hover { color: var(--text); }
  td { padding: 8px 12px; border-bottom: 1px solid var(--border-light); }
  tr:hover td { background: rgba(0,217,255,0.04); }

  /* ── Badges ── */
  .badge { display: inline-block; padding: 2px 8px; border-radius: var(--radius-pill); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
  .badge-pending { background: rgba(234,179,8,0.15); color: var(--yellow); }
  .badge-done { background: rgba(34,197,94,0.15); color: var(--green); }
  .badge-failed { background: rgba(239,68,68,0.15); color: var(--red); }
  .badge-skipped { background: rgba(148,163,184,0.15); color: var(--muted); }
  .badge-open { background: var(--accent-subtle); color: var(--accent); }
  .badge-merged { background: rgba(168,85,247,0.15); color: var(--purple); }
  .badge-closed { background: rgba(148,163,184,0.15); color: var(--muted); }
  .badge-active { background: rgba(34,197,94,0.15); color: var(--green); }
  .badge-draft { background: rgba(234,179,8,0.15); color: var(--yellow); }
  .badge-published { background: rgba(34,197,94,0.15); color: var(--green); }
  .badge-scheduled { background: var(--accent-subtle); color: var(--accent); }
  .badge-healthy { background: rgba(34,197,94,0.15); color: var(--green); }
  .badge-warning { background: rgba(234,179,8,0.15); color: var(--yellow); }
  .badge-critical { background: rgba(239,68,68,0.15); color: var(--red); }

  /* ── Filters ── */
  .filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .filter-btn { background: var(--surface); border: 1px solid var(--border); color: var(--muted); padding: 6px 14px;
                border-radius: var(--radius-sm); cursor: pointer; font-size: 0.8rem; transition: all 0.15s; font-family: var(--font); }
  .filter-btn:hover, .filter-btn.active { border-color: var(--accent); color: var(--text); }
  input.search { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 8px 14px;
                 border-radius: var(--radius-sm); font-size: 0.85rem; width: 250px; font-family: var(--font); }
  input.search::placeholder { color: var(--muted); }

  /* ── Product Tabs ── */
  .product-tabs { display: flex; gap: 4px; margin-bottom: 20px; }
  .product-tab { padding: 8px 20px; border-radius: var(--radius-sm) var(--radius-sm) 0 0; cursor: pointer; font-size: 0.85rem; font-weight: 600;
                 background: var(--surface); border: 1px solid var(--border); border-bottom: none; color: var(--muted); }
  .product-tab.active { background: var(--bg); color: var(--accent); border-color: var(--accent); border-bottom: 2px solid var(--bg); }

  /* ── Task Items ── */
  .project-section { margin-bottom: 28px; }
  .project-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
  .project-header h2 { font-size: 1.2rem; }
  .project-count { background: var(--border); color: var(--muted); padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; }
  .task-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-radius: var(--radius-sm);
               border: 1px solid var(--border); margin-bottom: 8px; transition: all 0.15s; }
  .task-item:hover { border-color: rgba(0,217,255,0.3); background: rgba(0,217,255,0.03); }
  .task-check { width: 20px; height: 20px; border: 2px solid var(--border); border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
  .task-check.p1 { border-color: var(--red); } .task-check.p2 { border-color: var(--orange); }
  .task-check.p3 { border-color: var(--yellow); } .task-check.p4 { border-color: var(--muted); }
  .task-content { flex: 1; min-width: 0; }
  .task-title { font-size: 0.95rem; margin-bottom: 4px; }
  .task-meta { font-size: 0.75rem; color: var(--muted); display: flex; gap: 12px; flex-wrap: wrap; }
  .task-labels { display: flex; gap: 4px; flex-wrap: wrap; }
  .label { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 0.7rem;
           background: var(--accent-subtle); color: var(--accent); }
  .task-comments { margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--border); }
  .comment { font-size: 0.8rem; color: var(--muted); margin-bottom: 4px; }
  .comment .comment-date { font-size: 0.7rem; color: rgba(148,163,184,0.6); }

  /* ── Chart Containers ── */
  .chart-container { position: relative; width: 100%; }
  .chart-container.wide { max-height: 350px; }
  .chart-container.square { max-width: 320px; max-height: 320px; margin: 0 auto; }

  /* ── Index Cards ── */
  .index-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-bottom: 32px; }
  a.index-card { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
           padding: 28px 32px; text-decoration: none; color: var(--text); transition: all 0.2s; }
  a.index-card:hover { border-color: rgba(0,217,255,0.3); transform: translateY(-2px); box-shadow: var(--glow-cyan); text-decoration: none; }
  a.index-card h2 { font-size: 1.2rem; margin-bottom: 6px; }
  a.index-card p { color: var(--muted); font-size: 0.85rem; }

  /* ── Collapsible Code Blocks ── */
  details.code-block { margin-top: 12px; }
  details.code-block summary { cursor: pointer; font-size: 0.8rem; color: var(--muted); padding: 6px 0; }
  details.code-block summary:hover { color: var(--accent); }
  details.code-block pre { background: var(--bg-deep); border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: 16px; overflow-x: auto; font-size: 0.78rem; line-height: 1.5; color: var(--text); margin-top: 8px; }
  details.code-block code { font-family: var(--font-mono); }

  /* ── Activity Feed ── */
  .activity-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border-light); }
  .activity-item:last-child { border-bottom: none; }
  .activity-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                   font-size: 0.9rem; flex-shrink: 0; background: var(--bg); }
  .activity-body { flex: 1; min-width: 0; }
  .activity-text { font-size: 0.88rem; line-height: 1.4; }
  .activity-time { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }

  /* ── Metric Row ── */
  .metric-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-light); }
  .metric-row:last-child { border-bottom: none; }
  .metric-label { font-size: 0.85rem; color: var(--muted); }
  .metric-value { font-size: 0.95rem; font-weight: 600; }

  /* ── Empty State ── */
  .empty-state { text-align: center; padding: 48px 24px; color: var(--muted); }
  .empty-state .empty-icon { font-size: 2.5rem; margin-bottom: 12px; }
  .empty-state p { font-size: 0.9rem; line-height: 1.5; }
  .empty-state code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font-size: 0.82rem; }

  /* ── Footer ── */
  .page-footer { color: var(--muted); font-size: 0.75rem; text-align: right; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); }

  .no-tasks { color: var(--muted); font-style: italic; padding: 16px; }
  .loading { text-align: center; padding: 60px; color: var(--muted); }
  .section-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 16px; }

  /* ── Scrollbars (ClawControl) ── */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--accent); }
  * { scrollbar-width: thin; scrollbar-color: var(--text-muted) transparent; }
</style></head>`;
}

function pageHeader(title, subtitle, activePath) {
  const navLinks = NAV_ITEMS.map(n =>
    `<a class="nav-link${n.href === activePath ? ' active' : ''}" href="${n.href}">${n.icon} ${n.label}</a>`
  ).join('');

  return `<body>
<nav class="nav">
  <a class="nav-brand" href="/">🌳 Oaken Cloud</a>
  <div class="nav-links">${navLinks}</div>
</nav>
<div class="page">
  <h1 class="page-title">${title}</h1>
  ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}`;
}

function pageFooter({ autoRefresh = false, dataLastModified = null } = {}) {
  let parts = [`<span id="ts">Rendered: ${new Date().toLocaleString()}</span>`];
  if (autoRefresh) parts.push('Auto-refreshes every 30s');
  return `<div class="page-footer">
  ${parts.join(' · ')}
  ${dataLastModified ? `<br><span id="data-ts">Data last modified: <strong>${dataLastModified}</strong></span>` : ''}
</div>
</div></body></html>`;
}

function chartDefaults() {
  return `<script>
  const COLORS = {
    accent: '#00d9ff', green: '#22c55e', purple: '#a855f7',
    yellow: '#f59e0b', orange: '#f97316', red: '#ef4444',
    muted: '#8b949e', surface: '#161b22', border: 'rgba(240,246,252,0.15)', text: '#e6edf3'
  };
  const COLOR_PALETTE = [COLORS.accent, COLORS.green, COLORS.purple, COLORS.yellow, COLORS.orange, COLORS.red];

  Chart.defaults.color = COLORS.muted;
  Chart.defaults.borderColor = 'rgba(240,246,252,0.08)';
  Chart.defaults.font.family = "${FONT_STACK}";
  Chart.defaults.font.size = 12;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = true;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = '#161b22';
  Chart.defaults.plugins.tooltip.titleColor = '#e6edf3';
  Chart.defaults.plugins.tooltip.bodyColor = '#8b949e';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(240,246,252,0.15)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.scale = Chart.defaults.scale || {};
</script>`;
}

// Helper to render an empty state when no data file exists
function emptyState(agent, dataFile) {
  return `<div class="card"><div class="empty-state">
  <div class="empty-icon">📭</div>
  <p>No dashboard data yet.<br>
  ${agent} needs to create <code>data/${dataFile}.json</code> to populate this dashboard.<br>
  See the update instructions in <code>DASHBOARD_INSTRUCTIONS.md</code>.</p>
</div></div>`;
}


// ── Dashboard Routes ────────────────────────────────────────────────

const routes = {
  '/': indexPage,
  '/florence': florenceDashboard,
  '/api/florence': (req, res) => serveAgentApi('florence', req, res),
  '/jerry': jerryDashboard,
  '/api/jerry': (req, res) => serveAgentApi('jerry', req, res),
  '/clarissa': clarissaDashboard,
  '/api/clarissa': (req, res) => serveAgentApi('clarissa', req, res),
  '/agnes': agnesDashboard,
  '/api/agnes': (req, res) => serveAgentApi('agnes', req, res),
  '/directories': directoryDashboard,
  '/api/directories': directoryApi,
  '/todoist': todoistDashboard,
  '/api/todoist': todoistApi,
  '/charts': chartsPage,
};

// ── Index Page ──────────────────────────────────────────────────────

function indexPage(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`${pageHead('Dashboards')}
${pageHeader('🌳 Oaken Cloud Dashboards', 'Managed by Florence — PsyFi Technologies', '/')}

  <h2 class="section-title" style="margin-bottom: 16px;">Agent Dashboards</h2>
  <div class="index-cards">
    <a class="index-card" href="/florence"><h2>🏠 Florence</h2><p>House Manager — Ops, delegation, system health</p></a>
    <a class="index-card" href="/jerry"><h2>💻 Jerry</h2><p>PsyFi Coder — Deployments, PRs, CI/CD, bugs</p></a>
    <a class="index-card" href="/clarissa"><h2>📣 Clarissa</h2><p>Marketing Lead — Content, SEO, social, competitors</p></a>
    <a class="index-card" href="/agnes"><h2>💰 Agnes</h2><p>Financial Strategist — Revenue, pricing, SaaS metrics</p></a>
  </div>

  <h2 class="section-title" style="margin-bottom: 16px;">Tools</h2>
  <div class="index-cards">
    <a class="index-card" href="/todoist"><h2>✅ Todoist Tasks</h2><p>All tasks across all projects</p></a>
    <a class="index-card" href="/directories"><h2>📂 Directory Submissions</h2><p>SEO directory campaign tracker</p></a>
    <a class="index-card" href="/charts"><h2>📈 Chart Examples</h2><p>Reference charts for agent dashboards</p></a>
  </div>
${pageFooter()}`);
}


// ═══════════════════════════════════════════════════════════════════
// FLORENCE — House Manager Dashboard
// ═══════════════════════════════════════════════════════════════════

function florenceDashboard(req, res) {
  const data = readAgentData('florence');
  const lastMod = data ? data.last_modified : null;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`${pageHead('Florence — House Manager', { includeChartJs: true })}
${pageHeader('🏠 Florence', 'House Manager — Ops, Delegation, System Health', '/florence')}
${chartDefaults()}

<div id="dashboard">
${data ? '' : emptyState('Florence', 'florence')}
</div>

${pageFooter({ autoRefresh: true, dataLastModified: lastMod })}

<script>
async function load() {
  var r = await fetch('/api/florence');
  var d = await r.json();
  if (!d) return;
  var el = document.getElementById('dashboard');
  var html = '';

  // Stat cards
  var s = d.stats || {};
  html += '<div class="grid grid-4">';
  html += '<div class="card"><h3 class="card-header">Tasks Delegated Today</h3><div class="value accent">' + (s.tasks_delegated_today || 0) + '</div><div class="sub">to Jerry, Clarissa, Agnes</div></div>';
  html += '<div class="card"><h3 class="card-header">Tasks Completed</h3><div class="value green">' + (s.tasks_completed || 0) + '</div><div class="sub">all time</div></div>';
  html += '<div class="card"><h3 class="card-header">Open Blockers</h3><div class="value ' + ((s.open_blockers||0) > 0 ? 'red' : 'green') + '">' + (s.open_blockers || 0) + '</div><div class="sub">needs attention</div></div>';
  html += '<div class="card"><h3 class="card-header">System Health</h3><div class="value ' + (s.system_health === 'healthy' ? 'green' : s.system_health === 'warning' ? 'yellow' : 'red') + '">' + (s.system_health || 'unknown') + '</div><div class="sub">' + (s.health_note || '') + '</div></div>';
  html += '</div>';

  // Agent status table
  var agents = d.agent_status || [];
  if (agents.length) {
    html += '<div class="card" style="margin-bottom:24px"><h3 class="card-header">Agent Status</h3>';
    html += '<table><thead><tr><th>Agent</th><th>Status</th><th>Current Task</th><th>Last Active</th></tr></thead><tbody>';
    for (var i = 0; i < agents.length; i++) {
      var a = agents[i];
      html += '<tr><td><strong>' + a.name + '</strong></td><td><span class="badge badge-' + (a.status||'active') + '">' + (a.status||'idle') + '</span></td><td>' + (a.current_task || '<span style="color:var(--muted)">idle</span>') + '</td><td style="color:var(--muted)">' + (a.last_active || '') + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }

  // Delegation chart
  var delegations = d.delegations_by_agent || {};
  var dNames = Object.keys(delegations);
  if (dNames.length) {
    html += '<div class="grid grid-2">';
    html += '<div class="card"><h3 class="card-header">Delegations by Agent</h3><div class="chart-container wide"><canvas id="delegationChart"></canvas></div></div>';

    // System services
    var services = d.services || [];
    if (services.length) {
      html += '<div class="card"><h3 class="card-header">System Services</h3>';
      for (var j = 0; j < services.length; j++) {
        var sv = services[j];
        html += '<div class="metric-row"><span class="metric-label">' + sv.name + '</span><span class="badge badge-' + (sv.status||'healthy') + '">' + (sv.status||'unknown') + '</span></div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  // Activity feed
  var activity = d.activity || [];
  if (activity.length) {
    html += '<div class="card"><h3 class="card-header">Recent Activity</h3>';
    for (var k = 0; k < activity.length; k++) {
      var act = activity[k];
      html += '<div class="activity-item"><div class="activity-icon">' + (act.icon || '📋') + '</div><div class="activity-body"><div class="activity-text">' + act.text + '</div><div class="activity-time">' + (act.time || '') + '</div></div></div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;

  // Render delegation chart if data exists
  if (dNames.length) {
    var dVals = dNames.map(function(n){return delegations[n];});
    new Chart(document.getElementById('delegationChart'), {
      type: 'bar', data: { labels: dNames, datasets: [{ label: 'Delegations', data: dVals,
        backgroundColor: dNames.map(function(_,i){return COLOR_PALETTE[i%COLOR_PALETTE.length];}), borderRadius: 6, borderSkipped: false }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }

  if (d.last_modified) {
    var dts = document.getElementById('data-ts');
    if (dts) dts.innerHTML = 'Data last modified: <strong>' + d.last_modified + '</strong>';
  }
  document.getElementById('ts').textContent = 'Rendered: ' + new Date().toLocaleString();
}
load();
setInterval(load, 30000);
</script>`);
}


// ═══════════════════════════════════════════════════════════════════
// JERRY — PsyFi Coder Dashboard
// ═══════════════════════════════════════════════════════════════════

function jerryDashboard(req, res) {
  const data = readAgentData('jerry');
  const lastMod = data ? data.last_modified : null;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`${pageHead('Jerry — PsyFi Coder', { includeChartJs: true })}
${pageHeader('💻 Jerry', 'PsyFi Coder — Lead Engineer, All Products', '/jerry')}
${chartDefaults()}

<div id="dashboard">
${data ? '' : emptyState('Jerry', 'jerry')}
</div>

${pageFooter({ autoRefresh: true, dataLastModified: lastMod })}

<script>
async function load() {
  var r = await fetch('/api/jerry');
  var d = await r.json();
  if (!d) return;
  var el = document.getElementById('dashboard');
  var html = '';

  // Stat cards
  var s = d.stats || {};
  html += '<div class="grid grid-5">';
  html += '<div class="card"><h3 class="card-header">Open PRs</h3><div class="value accent">' + (s.open_prs || 0) + '</div><div class="sub">awaiting review</div></div>';
  html += '<div class="card"><h3 class="card-header">PRs Merged</h3><div class="value green">' + (s.prs_merged || 0) + '</div><div class="sub">' + (s.prs_merged_period || 'this week') + '</div></div>';
  html += '<div class="card"><h3 class="card-header">Open Bugs</h3><div class="value ' + ((s.open_bugs||0)>0?'red':'green') + '">' + (s.open_bugs || 0) + '</div><div class="sub">across all products</div></div>';
  html += '<div class="card"><h3 class="card-header">Deployments</h3><div class="value purple">' + (s.deployments || 0) + '</div><div class="sub">' + (s.deployments_period || 'this week') + '</div></div>';
  html += '<div class="card"><h3 class="card-header">Tests Passing</h3><div class="value ' + ((s.test_pass_rate||0)>=95?'green':'yellow') + '">' + (s.test_pass_rate || 0) + '%</div><div class="sub">latest CI run</div></div>';
  html += '</div>';

  // Product health
  var products = d.products || [];
  if (products.length) {
    html += '<div class="card" style="margin-bottom:24px"><h3 class="card-header">Product Health</h3>';
    html += '<table><thead><tr><th>Product</th><th>Branch</th><th>Last Deploy</th><th>CI Status</th><th>Open Issues</th></tr></thead><tbody>';
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      html += '<tr><td><strong>' + p.name + '</strong></td><td style="font-family:monospace;font-size:0.8rem">' + (p.branch || 'main') + '</td><td style="color:var(--muted)">' + (p.last_deploy || 'never') + '</td><td><span class="badge badge-' + (p.ci_status||'healthy') + '">' + (p.ci_status||'unknown') + '</span></td><td>' + (p.open_issues || 0) + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }

  // Charts row: commits by product + PR status
  html += '<div class="grid grid-2">';

  var commitsByProduct = d.commits_by_product || {};
  var cpNames = Object.keys(commitsByProduct);
  if (cpNames.length) {
    html += '<div class="card"><h3 class="card-header">Commits by Product (This Week)</h3><div class="chart-container wide"><canvas id="commitsChart"></canvas></div></div>';
  }

  var prsByStatus = d.prs_by_status || {};
  var prKeys = Object.keys(prsByStatus);
  if (prKeys.length) {
    html += '<div class="card"><h3 class="card-header">PRs by Status</h3><div class="chart-container square"><canvas id="prChart"></canvas></div></div>';
  }
  html += '</div>';

  // Recent PRs table
  var prs = d.recent_prs || [];
  if (prs.length) {
    html += '<div class="card" style="margin-bottom:24px"><h3 class="card-header">Recent Pull Requests</h3>';
    html += '<table><thead><tr><th>PR</th><th>Product</th><th>Status</th><th>Date</th></tr></thead><tbody>';
    for (var j = 0; j < prs.length; j++) {
      var pr = prs[j];
      html += '<tr><td>' + (pr.url ? '<a href="'+pr.url+'" target="_blank">' : '') + pr.title + (pr.url ? '</a>' : '') + '</td><td>' + (pr.product||'') + '</td><td><span class="badge badge-' + (pr.status||'open') + '">' + (pr.status||'open') + '</span></td><td style="color:var(--muted)">' + (pr.date||'') + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }

  // Recent deploys
  var deploys = d.recent_deploys || [];
  if (deploys.length) {
    html += '<div class="card"><h3 class="card-header">Recent Deployments</h3>';
    for (var k = 0; k < deploys.length; k++) {
      var dep = deploys[k];
      html += '<div class="activity-item"><div class="activity-icon">🚀</div><div class="activity-body"><div class="activity-text"><strong>' + dep.product + '</strong> — ' + dep.description + '</div><div class="activity-time">' + (dep.time || '') + (dep.commit ? ' · ' + dep.commit : '') + '</div></div></div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;

  // Charts
  if (cpNames.length) {
    new Chart(document.getElementById('commitsChart'), {
      type: 'bar', data: { labels: cpNames, datasets: [{ label: 'Commits', data: cpNames.map(function(n){return commitsByProduct[n];}),
        backgroundColor: cpNames.map(function(_,i){return COLOR_PALETTE[i%COLOR_PALETTE.length];}), borderRadius: 6, borderSkipped: false }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }
  if (prKeys.length) {
    var prColors = { open: COLORS.accent, merged: COLORS.purple, closed: COLORS.muted, draft: COLORS.yellow };
    new Chart(document.getElementById('prChart'), {
      type: 'doughnut', data: { labels: prKeys, datasets: [{ data: prKeys.map(function(k){return prsByStatus[k];}),
        backgroundColor: prKeys.map(function(k){return prColors[k]||COLORS.accent;}), borderColor: 'transparent', borderWidth: 2 }] },
      options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
    });
  }

  if (d.last_modified) { var dts = document.getElementById('data-ts'); if (dts) dts.innerHTML = 'Data last modified: <strong>' + d.last_modified + '</strong>'; }
  document.getElementById('ts').textContent = 'Rendered: ' + new Date().toLocaleString();
}
load();
setInterval(load, 30000);
</script>`);
}


// ═══════════════════════════════════════════════════════════════════
// CLARISSA — Marketing Lead Dashboard
// ═══════════════════════════════════════════════════════════════════

function clarissaDashboard(req, res) {
  const data = readAgentData('clarissa');
  const lastMod = data ? data.last_modified : null;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`${pageHead('Clarissa — Marketing Lead', { includeChartJs: true })}
${pageHeader('📣 Clarissa', 'Marketing Lead — Content, SEO, Social, Competitor Intel', '/clarissa')}
${chartDefaults()}

<div id="dashboard">
${data ? '' : emptyState('Clarissa', 'clarissa')}
</div>

${pageFooter({ autoRefresh: true, dataLastModified: lastMod })}

<script>
async function load() {
  var r = await fetch('/api/clarissa');
  var d = await r.json();
  if (!d) return;
  var el = document.getElementById('dashboard');
  var html = '';

  // Stat cards
  var s = d.stats || {};
  html += '<div class="grid grid-5">';
  html += '<div class="card"><h3 class="card-header">Content Published</h3><div class="value green">' + (s.content_published || 0) + '</div><div class="sub">' + (s.content_period || 'this month') + '</div></div>';
  html += '<div class="card"><h3 class="card-header">Content in Pipeline</h3><div class="value accent">' + (s.content_in_pipeline || 0) + '</div><div class="sub">draft / review / scheduled</div></div>';
  html += '<div class="card"><h3 class="card-header">Organic Clicks</h3><div class="value purple">' + (s.organic_clicks || 0) + '</div><div class="sub">' + (s.clicks_period || 'last 28 days') + '</div></div>';
  html += '<div class="card"><h3 class="card-header">Avg Position</h3><div class="value yellow">' + (s.avg_position || '—') + '</div><div class="sub">Search Console</div></div>';
  html += '<div class="card"><h3 class="card-header">Social Followers</h3><div class="value orange">' + (s.social_followers || 0) + '</div><div class="sub">across platforms</div></div>';
  html += '</div>';

  // Charts: SEO trend + content status
  html += '<div class="grid grid-2">';

  var seoTrend = d.seo_trend || {};
  if (seoTrend.labels && seoTrend.labels.length) {
    html += '<div class="card"><h3 class="card-header">Organic Clicks Trend</h3><div class="chart-container wide"><canvas id="seoChart"></canvas></div></div>';
  }

  var contentStatus = d.content_by_status || {};
  var csKeys = Object.keys(contentStatus);
  if (csKeys.length) {
    html += '<div class="card"><h3 class="card-header">Content by Status</h3><div class="chart-container square"><canvas id="contentChart"></canvas></div></div>';
  }
  html += '</div>';

  // Content pipeline table
  var pipeline = d.content_pipeline || [];
  if (pipeline.length) {
    html += '<div class="card" style="margin-bottom:24px"><h3 class="card-header">Content Pipeline</h3>';
    html += '<table><thead><tr><th>Title</th><th>Type</th><th>Product</th><th>Status</th><th>Platform</th><th>Date</th></tr></thead><tbody>';
    for (var i = 0; i < pipeline.length; i++) {
      var c = pipeline[i];
      html += '<tr><td>' + (c.url ? '<a href="'+c.url+'" target="_blank">' : '') + c.title + (c.url ? '</a>' : '') + '</td><td>' + (c.type||'') + '</td><td>' + (c.product||'') + '</td><td><span class="badge badge-' + (c.status||'draft') + '">' + (c.status||'draft') + '</span></td><td>' + (c.platform||'') + '</td><td style="color:var(--muted)">' + (c.date||'') + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }

  // SEO metrics: top pages + keyword rankings
  html += '<div class="grid grid-2">';

  var topPages = d.top_pages || [];
  if (topPages.length) {
    html += '<div class="card"><h3 class="card-header">Top Pages by Clicks</h3>';
    html += '<table><thead><tr><th>Page</th><th>Clicks</th><th>Impressions</th><th>CTR</th></tr></thead><tbody>';
    for (var j = 0; j < topPages.length; j++) {
      var pg = topPages[j];
      html += '<tr><td style="font-size:0.8rem">' + pg.page + '</td><td>' + pg.clicks + '</td><td>' + pg.impressions + '</td><td>' + pg.ctr + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }

  var keywords = d.keyword_rankings || [];
  if (keywords.length) {
    html += '<div class="card"><h3 class="card-header">Keyword Rankings</h3>';
    html += '<table><thead><tr><th>Keyword</th><th>Position</th><th>Change</th><th>Product</th></tr></thead><tbody>';
    for (var k = 0; k < keywords.length; k++) {
      var kw = keywords[k];
      var chgClass = (kw.change||0) < 0 ? 'green' : (kw.change||0) > 0 ? 'red' : '';
      var chgStr = (kw.change||0) < 0 ? kw.change : (kw.change||0) > 0 ? '+'+kw.change : '—';
      html += '<tr><td>' + kw.keyword + '</td><td>' + kw.position + '</td><td class="' + chgClass + '">' + chgStr + '</td><td>' + (kw.product||'') + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }
  html += '</div>';

  // Competitor intel
  var competitors = d.competitor_intel || [];
  if (competitors.length) {
    html += '<div class="card" style="margin-bottom:24px"><h3 class="card-header">Competitor Intelligence</h3>';
    for (var m = 0; m < competitors.length; m++) {
      var ci = competitors[m];
      html += '<div class="activity-item"><div class="activity-icon">🔍</div><div class="activity-body"><div class="activity-text"><strong>' + ci.competitor + '</strong> — ' + ci.note + '</div><div class="activity-time">' + (ci.date||'') + '</div></div></div>';
    }
    html += '</div>';
  }

  // Social media performance
  var social = d.social_performance || [];
  if (social.length) {
    html += '<div class="card"><h3 class="card-header">Social Media Performance</h3>';
    html += '<table><thead><tr><th>Platform</th><th>Followers</th><th>Posts</th><th>Engagement Rate</th><th>Top Post</th></tr></thead><tbody>';
    for (var n = 0; n < social.length; n++) {
      var sp = social[n];
      html += '<tr><td><strong>' + sp.platform + '</strong></td><td>' + (sp.followers||0) + '</td><td>' + (sp.posts||0) + '</td><td>' + (sp.engagement_rate||'—') + '</td><td style="font-size:0.8rem;color:var(--muted)">' + (sp.top_post||'') + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }

  el.innerHTML = html;

  // Charts
  if (seoTrend.labels && seoTrend.labels.length) {
    new Chart(document.getElementById('seoChart'), {
      type: 'line', data: { labels: seoTrend.labels, datasets: [{
        label: 'Clicks', data: seoTrend.clicks, borderColor: COLORS.accent,
        backgroundColor: 'rgba(0,217,255,0.1)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 6
      }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
  if (csKeys.length) {
    var csColors = { published: COLORS.green, draft: COLORS.yellow, scheduled: COLORS.accent, review: COLORS.purple };
    new Chart(document.getElementById('contentChart'), {
      type: 'doughnut', data: { labels: csKeys, datasets: [{ data: csKeys.map(function(k){return contentStatus[k];}),
        backgroundColor: csKeys.map(function(k){return csColors[k]||COLORS.muted;}), borderColor: 'transparent', borderWidth: 2 }] },
      options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
    });
  }

  if (d.last_modified) { var dts = document.getElementById('data-ts'); if (dts) dts.innerHTML = 'Data last modified: <strong>' + d.last_modified + '</strong>'; }
  document.getElementById('ts').textContent = 'Rendered: ' + new Date().toLocaleString();
}
load();
setInterval(load, 30000);
</script>`);
}


// ═══════════════════════════════════════════════════════════════════
// AGNES — Financial Strategist Dashboard
// ═══════════════════════════════════════════════════════════════════

function agnesDashboard(req, res) {
  // First try the agent data file; fall back to pre-rendered HTML
  const data = readAgentData('agnes');
  if (!data) {
    // Serve pre-rendered dashboard if it exists
    const dashPath = '/home/openclaw/.openclaw/agnes-workspace/dashboard_output/dashboard.html';
    const fallback = '/home/openclaw/.openclaw/agnes-workspace/dashboard_output/index.html';
    const file = fs.existsSync(dashPath) ? dashPath : fallback;
    try {
      const html = fs.readFileSync(file, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    } catch (e) { /* fall through to empty state */ }
  }

  const lastMod = data ? data.last_modified : null;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`${pageHead('Agnes — Financial Strategist', { includeChartJs: true })}
${pageHeader('💰 Agnes', 'Financial Strategist — Revenue, Pricing, SaaS Metrics', '/agnes')}
${chartDefaults()}

<div id="dashboard">
${data ? '' : emptyState('Agnes', 'agnes')}
</div>

${pageFooter({ autoRefresh: true, dataLastModified: lastMod })}

<script>
async function load() {
  var r = await fetch('/api/agnes');
  var d = await r.json();
  if (!d) return;
  var el = document.getElementById('dashboard');
  var html = '';

  // KPI cards
  var s = d.stats || {};
  html += '<div class="grid grid-5">';
  html += '<div class="card"><h3 class="card-header">MRR</h3><div class="value green">$' + (s.mrr || 0) + '</div><div class="sub">' + (s.mrr_change || '') + ' vs last month</div></div>';
  html += '<div class="card"><h3 class="card-header">ARR</h3><div class="value accent">$' + (s.arr || 0) + '</div><div class="sub">annualized</div></div>';
  html += '<div class="card"><h3 class="card-header">Churn Rate</h3><div class="value ' + ((parseFloat(s.churn_rate)||0)>3.5?'red':'green') + '">' + (s.churn_rate || 0) + '%</div><div class="sub">monthly · target &lt;3.5%</div></div>';
  html += '<div class="card"><h3 class="card-header">LTV:CAC</h3><div class="value ' + ((parseFloat(s.ltv_cac)||0)>=3?'green':'yellow') + '">' + (s.ltv_cac || '—') + '</div><div class="sub">target &ge;3:1</div></div>';
  html += '<div class="card"><h3 class="card-header">Quick Ratio</h3><div class="value ' + ((parseFloat(s.quick_ratio)||0)>=4?'green':(parseFloat(s.quick_ratio)||0)>=1?'yellow':'red') + '">' + (s.quick_ratio || '—') + '</div><div class="sub">target &ge;4</div></div>';
  html += '</div>';

  // Charts: MRR trend + revenue by product
  html += '<div class="grid grid-2">';

  var mrrTrend = d.mrr_trend || {};
  if (mrrTrend.labels && mrrTrend.labels.length) {
    html += '<div class="card"><h3 class="card-header">MRR Trend</h3><div class="chart-container wide"><canvas id="mrrChart"></canvas></div></div>';
  }

  var revByProduct = d.revenue_by_product || {};
  var rpKeys = Object.keys(revByProduct);
  if (rpKeys.length) {
    html += '<div class="card"><h3 class="card-header">Revenue by Product</h3><div class="chart-container square"><canvas id="revenueChart"></canvas></div></div>';
  }
  html += '</div>';

  // Product financials table
  var products = d.product_financials || [];
  if (products.length) {
    html += '<div class="card" style="margin-bottom:24px"><h3 class="card-header">Product Financials</h3>';
    html += '<table><thead><tr><th>Product</th><th>MRR</th><th>Subscribers</th><th>Churn</th><th>ARPU</th><th>Status</th></tr></thead><tbody>';
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      html += '<tr><td><strong>' + p.name + '</strong></td><td>$' + (p.mrr||0) + '</td><td>' + (p.subscribers||0) + '</td><td>' + (p.churn||0) + '%</td><td>$' + (p.arpu||0) + '</td><td><span class="badge badge-' + (p.status||'healthy') + '">' + (p.status||'—') + '</span></td></tr>';
    }
    html += '</tbody></table></div>';
  }

  // Alerts
  var alerts = d.alerts || [];
  if (alerts.length) {
    html += '<div class="card" style="margin-bottom:24px"><h3 class="card-header">Alerts &amp; Thresholds</h3>';
    for (var j = 0; j < alerts.length; j++) {
      var al = alerts[j];
      html += '<div class="activity-item"><div class="activity-icon">' + (al.severity === 'critical' ? '🔴' : al.severity === 'warning' ? '🟡' : '🟢') + '</div><div class="activity-body"><div class="activity-text">' + al.message + '</div><div class="activity-time">' + (al.date||'') + '</div></div></div>';
    }
    html += '</div>';
  }

  // Cost breakdown + pricing tiers
  html += '<div class="grid grid-2">';

  var costs = d.cost_breakdown || [];
  if (costs.length) {
    html += '<div class="card"><h3 class="card-header">Monthly Cost Breakdown</h3>';
    var costTotal = 0;
    for (var k = 0; k < costs.length; k++) costTotal += costs[k].amount || 0;
    for (var m = 0; m < costs.length; m++) {
      var ct = costs[m];
      html += '<div class="metric-row"><span class="metric-label">' + ct.category + '</span><span class="metric-value">$' + ct.amount + '</span></div>';
    }
    html += '<div class="metric-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:12px"><span class="metric-label"><strong>Total</strong></span><span class="metric-value"><strong>$' + costTotal + '</strong></span></div>';
    html += '</div>';
  }

  var pricing = d.pricing_tiers || [];
  if (pricing.length) {
    html += '<div class="card"><h3 class="card-header">Pricing Tiers</h3>';
    html += '<table><thead><tr><th>Tier</th><th>Price</th><th>Subscribers</th><th>% of Total</th></tr></thead><tbody>';
    for (var n = 0; n < pricing.length; n++) {
      var pt = pricing[n];
      html += '<tr><td><strong>' + pt.name + '</strong></td><td>$' + pt.price + '/mo</td><td>' + pt.subscribers + '</td><td>' + pt.percent + '%</td></tr>';
    }
    html += '</tbody></table></div>';
  }
  html += '</div>';

  // Cash runway
  if (s.cash_runway) {
    html += '<div class="card"><h3 class="card-header">Cash Runway</h3><div class="metric-row"><span class="metric-label">Months Remaining</span><span class="metric-value ' + ((parseFloat(s.cash_runway)||0)<6?'red':'green') + '">' + s.cash_runway + ' months</span></div>';
    if (s.burn_rate) html += '<div class="metric-row"><span class="metric-label">Monthly Burn Rate</span><span class="metric-value">$' + s.burn_rate + '</span></div>';
    html += '</div>';
  }

  el.innerHTML = html;

  // Charts
  if (mrrTrend.labels && mrrTrend.labels.length) {
    new Chart(document.getElementById('mrrChart'), {
      type: 'line', data: { labels: mrrTrend.labels, datasets: [{
        label: 'MRR ($)', data: mrrTrend.values, borderColor: COLORS.green,
        backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 6
      }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, ticks: { callback: function(v){return '$'+v;} } } } }
    });
  }
  if (rpKeys.length) {
    new Chart(document.getElementById('revenueChart'), {
      type: 'doughnut', data: { labels: rpKeys, datasets: [{ data: rpKeys.map(function(k){return revByProduct[k];}),
        backgroundColor: rpKeys.map(function(_,i){return COLOR_PALETTE[i%COLOR_PALETTE.length];}), borderColor: 'transparent', borderWidth: 2 }] },
      options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
    });
  }

  if (d.last_modified) { var dts = document.getElementById('data-ts'); if (dts) dts.innerHTML = 'Data last modified: <strong>' + d.last_modified + '</strong>'; }
  document.getElementById('ts').textContent = 'Rendered: ' + new Date().toLocaleString();
}
load();
setInterval(load, 30000);
</script>`);
}


// ── Directory API ───────────────────────────────────────────────────

function directoryApi(req, res) {
  try {
    const data = JSON.parse(fs.readFileSync('/home/openclaw/.openclaw/workspace/memory/directory-tracking.json', 'utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// ── Directory Dashboard ─────────────────────────────────────────────

function directoryDashboard(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`${pageHead('Directory Submissions', { includeChartJs: true })}
${pageHeader('📂 Directory Submissions', 'SEO campaign tracker — Ordísio & PsyFi Assistant', '/directories')}
${chartDefaults()}

<div class="grid grid-4" id="stats"></div>

<div class="grid grid-2" id="progress-cards"></div>

<div class="grid grid-2" id="chart-row" style="margin-bottom: 24px;">
  <div class="card">
    <h3 class="card-header">Ordísio Status Breakdown</h3>
    <div class="chart-container square"><canvas id="ordisioChart"></canvas></div>
  </div>
  <div class="card">
    <h3 class="card-header">PsyFi Assistant Status Breakdown</h3>
    <div class="chart-container square"><canvas id="psyfiChart"></canvas></div>
  </div>
</div>

<div class="card" style="margin-bottom: 24px;">
  <h3 class="card-header">Directory List</h3>
  <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
    <input class="search" id="search" placeholder="Search directories...">
    <div class="filter-bar" id="filters" style="margin-bottom: 0;"></div>
  </div>
  <div style="max-height: 600px; overflow-y: auto;">
    <table><thead><tr>
      <th onclick="sortBy('domain')">Directory</th>
      <th onclick="sortBy('ordisio')">Ordísio</th>
      <th onclick="sortBy('psyfiassist')">PsyFi Assistant</th>
    </tr></thead><tbody id="tbody"></tbody></table>
  </div>
</div>

${pageFooter({ autoRefresh: true })}

<script>
let data = null, activeFilter = 'all', searchTerm = '', sortCol = 'domain', sortAsc = true;
let ordisioChart = null, psyfiChart = null;

async function load() {
  const r = await fetch('/api/directories');
  data = await r.json();
  render();
}

function countStatus(dirs, product, status) {
  return dirs.filter(d => d[product] === status).length;
}

function buildDoughnut(ctx, done, pending, failed, skipped) {
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Done', 'Pending', 'Failed', 'Skipped'],
      datasets: [{
        data: [done, pending, failed, skipped],
        backgroundColor: [COLORS.green, COLORS.yellow, COLORS.red, COLORS.muted],
        borderColor: 'transparent', borderWidth: 2
      }]
    },
    options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
  });
}

function render() {
  if (!data) return;
  const dirs = data.directories;
  const total = dirs.length;
  const oComp = countStatus(dirs, 'ordisio', 'done');
  const oFail = countStatus(dirs, 'ordisio', 'failed');
  const oSkip = countStatus(dirs, 'ordisio', 'skipped');
  const oPend = total - oComp - oFail - oSkip;
  const pComp = countStatus(dirs, 'psyfiassist', 'done');
  const pFail = countStatus(dirs, 'psyfiassist', 'failed');
  const pSkip = countStatus(dirs, 'psyfiassist', 'skipped');
  const pPend = total - pComp - pFail - pSkip;

  document.getElementById('stats').innerHTML =
    '<div class="card"><h3 class="card-header">Total Directories</h3><div class="value">' + total + '</div><div class="sub">unique sites to submit</div></div>' +
    '<div class="card"><h3 class="card-header">Ordísio Progress</h3><div class="value green">' + oComp + '</div><div class="sub">' + oPend + ' pending · ' + oFail + ' failed · ' + oSkip + ' skipped</div></div>' +
    '<div class="card"><h3 class="card-header">PsyFi Assist Progress</h3><div class="value purple">' + pComp + '</div><div class="sub">' + pPend + ' pending · ' + pFail + ' failed · ' + pSkip + ' skipped</div></div>' +
    '<div class="card"><h3 class="card-header">Overall Completion</h3><div class="value">' + Math.round(((oComp+pComp)/(total*2))*100) + '%</div><div class="sub">' + (oComp+pComp) + ' / ' + (total*2) + ' submissions</div></div>';

  const oPct = Math.round((oComp/total)*100);
  const pPct = Math.round((pComp/total)*100);
  document.getElementById('progress-cards').innerHTML =
    '<div class="card"><h3 class="card-header">Ordísio — ' + oPct + '%</h3><div class="progress-bar"><div class="progress-fill green-bg" style="width:' + oPct + '%"></div></div><div class="sub" style="margin-top:8px">' + oComp + ' done · ' + oPend + ' pending · ' + oFail + ' failed · ' + oSkip + ' skipped</div></div>' +
    '<div class="card"><h3 class="card-header">PsyFi Assistant — ' + pPct + '%</h3><div class="progress-bar"><div class="progress-fill accent-bg" style="width:' + pPct + '%"></div></div><div class="sub" style="margin-top:8px">' + pComp + ' done · ' + pPend + ' pending · ' + pFail + ' failed · ' + pSkip + ' skipped</div></div>';

  if (ordisioChart) ordisioChart.destroy();
  if (psyfiChart) psyfiChart.destroy();
  ordisioChart = buildDoughnut(document.getElementById('ordisioChart'), oComp, oPend, oFail, oSkip);
  psyfiChart = buildDoughnut(document.getElementById('psyfiChart'), pComp, pPend, pFail, pSkip);

  document.getElementById('filters').innerHTML = ['all','pending','done','failed','skipped'].map(function(s) {
    return '<button class="filter-btn ' + (activeFilter===s?'active':'') + '" onclick="setFilter(\\'' + s + '\\')">' + s + '</button>';
  }).join('');

  var filtered = dirs;
  if (activeFilter !== 'all') {
    filtered = dirs.filter(function(d) { return d.ordisio === activeFilter || d.psyfiassist === activeFilter; });
  }
  if (searchTerm) {
    var q = searchTerm.toLowerCase();
    filtered = filtered.filter(function(d) { return d.domain.toLowerCase().includes(q); });
  }
  filtered.sort(function(a,b) {
    var va = a[sortCol] || '', vb = b[sortCol] || '';
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  document.getElementById('tbody').innerHTML = filtered.map(function(d) {
    return '<tr><td><a href="' + d.url + '" target="_blank">' + d.domain + '</a></td>' +
      '<td><span class="badge badge-' + d.ordisio + '">' + d.ordisio + '</span></td>' +
      '<td><span class="badge badge-' + d.psyfiassist + '">' + d.psyfiassist + '</span></td></tr>';
  }).join('');

  document.getElementById('ts').textContent = 'Rendered: ' + new Date().toLocaleString();
}

function setFilter(f) { activeFilter = f; render(); }
function sortBy(col) { if (sortCol === col) sortAsc = !sortAsc; else { sortCol = col; sortAsc = true; } render(); }
document.getElementById('search').addEventListener('input', function(e) { searchTerm = e.target.value; render(); });

load();
setInterval(load, 30000);
</script>`);
}

// ── Todoist API ─────────────────────────────────────────────────────

async function todoistApi(req, res) {
  try {
    const [projects, tasks] = await Promise.all([
      todoistFetch('/projects'),
      todoistFetch('/tasks')
    ]);
    const taskComments = {};
    for (const t of tasks) {
      try {
        const comments = await todoistFetch(`/comments?task_id=${t.id}`);
        taskComments[t.id] = Array.isArray(comments) ? comments : [];
      } catch(e) { taskComments[t.id] = []; }
    }
    const projectMap = {};
    for (const p of projects) projectMap[p.id] = p.name;
    const enriched = tasks.map(t => ({
      ...t,
      project_name: projectMap[t.project_id] || 'Unknown',
      comments: taskComments[t.id] || []
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ projects, tasks: enriched }));
  } catch(e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// ── Todoist Dashboard ───────────────────────────────────────────────

function todoistDashboard(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`${pageHead('Todoist Tasks', { includeChartJs: true })}
${pageHeader('✅ Todoist Tasks', 'All tasks across all OpenClaw projects', '/todoist')}
${chartDefaults()}

<div class="grid grid-4" id="stats"><div class="loading">Loading...</div></div>

<div class="grid grid-2" id="chart-row" style="margin-bottom: 24px;">
  <div class="card">
    <h3 class="card-header">Tasks by Project</h3>
    <div class="chart-container wide"><canvas id="projectChart"></canvas></div>
  </div>
  <div class="card">
    <h3 class="card-header">Priority Distribution</h3>
    <div class="chart-container square"><canvas id="priorityChart"></canvas></div>
  </div>
</div>

<div class="filter-bar" id="project-filters"></div>

<div id="content"><div class="loading">Loading tasks...</div></div>

${pageFooter({ autoRefresh: true })}

<script>
let data = null, activeProject = 'all';
let projectChart = null, priorityChart = null;

async function load() {
  try {
    const r = await fetch('/api/todoist');
    data = await r.json();
    render();
  } catch(e) {
    document.getElementById('content').innerHTML = '<div class="loading red">Error loading: ' + e.message + '</div>';
  }
}

function priorityClass(p) { return 'p' + (p || 4); }
function priorityLabel(p) { return p === 4 ? 'P1' : p === 3 ? 'P2' : p === 2 ? 'P3' : 'P4'; }

function render() {
  if (!data) return;
  var projects = data.projects, tasks = data.tasks;

  var total = tasks.length;
  var byProject = {};
  for (var i = 0; i < tasks.length; i++) {
    var pn = tasks[i].project_name;
    byProject[pn] = (byProject[pn] || 0) + 1;
  }
  var overdue = tasks.filter(function(t) { return t.due && new Date(t.due.date || t.due.datetime) < new Date(); }).length;
  var withDue = tasks.filter(function(t) { return t.due; }).length;

  document.getElementById('stats').innerHTML =
    '<div class="card"><h3 class="card-header">Total Tasks</h3><div class="value">' + total + '</div><div class="sub">across ' + projects.length + ' projects</div></div>' +
    '<div class="card"><h3 class="card-header">Projects</h3><div class="value purple">' + projects.length + '</div><div class="sub">' + projects.map(function(p){return p.name;}).join(', ') + '</div></div>' +
    '<div class="card"><h3 class="card-header">With Due Date</h3><div class="value yellow">' + withDue + '</div><div class="sub">' + overdue + ' overdue</div></div>' +
    '<div class="card"><h3 class="card-header">No Due Date</h3><div class="value">' + (total - withDue) + '</div><div class="sub">unscheduled</div></div>';

  var projNames = projects.map(function(p){return p.name;});
  var projCounts = projNames.map(function(n){return byProject[n]||0;});
  if (projectChart) projectChart.destroy();
  projectChart = new Chart(document.getElementById('projectChart'), {
    type: 'bar',
    data: {
      labels: projNames,
      datasets: [{ label: 'Tasks', data: projCounts,
        backgroundColor: projNames.map(function(_,i){return COLOR_PALETTE[i % COLOR_PALETTE.length];}),
        borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });

  var priCounts = [0,0,0,0];
  for (var j = 0; j < tasks.length; j++) {
    var pri = tasks[j].priority || 1;
    if (pri === 4) priCounts[0]++;
    else if (pri === 3) priCounts[1]++;
    else if (pri === 2) priCounts[2]++;
    else priCounts[3]++;
  }
  if (priorityChart) priorityChart.destroy();
  priorityChart = new Chart(document.getElementById('priorityChart'), {
    type: 'doughnut',
    data: {
      labels: ['P1 (Urgent)', 'P2 (High)', 'P3 (Medium)', 'P4 (Normal)'],
      datasets: [{
        data: priCounts,
        backgroundColor: [COLORS.red, COLORS.orange, COLORS.yellow, COLORS.muted],
        borderColor: 'transparent', borderWidth: 2
      }]
    },
    options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
  });

  var allProjNames = ['all'].concat(projNames);
  document.getElementById('project-filters').innerHTML = allProjNames.map(function(p) {
    return '<button class="filter-btn ' + (activeProject === p ? 'active' : '') + '" onclick="setProject(\\'' + p.replace(/'/g,"\\\\'") + '\\')">' +
    (p === 'all' ? 'All Projects' : p) + ' (' + (p === 'all' ? total : (byProject[p]||0)) + ')</button>';
  }).join('');

  var filtered = activeProject === 'all' ? tasks : tasks.filter(function(t){return t.project_name === activeProject;});
  var grouped = {};
  for (var k = 0; k < filtered.length; k++) {
    var t = filtered[k];
    if (!grouped[t.project_name]) grouped[t.project_name] = [];
    grouped[t.project_name].push(t);
  }

  var html = '';
  var entries = Object.entries(grouped);
  for (var m = 0; m < entries.length; m++) {
    var projName = entries[m][0], projTasks = entries[m][1];
    html += '<div class="project-section"><div class="project-header"><h2>' + projName + '</h2><span class="project-count">' + projTasks.length + ' tasks</span></div>';
    if (projTasks.length === 0) {
      html += '<div class="no-tasks">No tasks</div>';
    } else {
      for (var n = 0; n < projTasks.length; n++) {
        var tk = projTasks[n];
        var prio = tk.priority || 1;
        var dueStr = tk.due ? (tk.due.datetime || tk.due.date) : '';
        html += '<div class="task-item"><div class="task-check ' + priorityClass(prio) + '"></div><div class="task-content"><div class="task-title">' + tk.content + '</div><div class="task-meta">';
        if (dueStr) {
          var isOverdue = new Date(dueStr) < new Date();
          html += '<span class="' + (isOverdue ? 'red' : '') + '">📅 ' + dueStr + '</span>';
        }
        if (tk.labels && tk.labels.length) {
          html += '<div class="task-labels">' + tk.labels.map(function(l){return '<span class="label">' + l + '</span>';}).join('') + '</div>';
        }
        html += '</div>';
        if (tk.comments && tk.comments.length) {
          html += '<div class="task-comments">';
          var showComments = tk.comments.slice(-3);
          for (var c = 0; c < showComments.length; c++) {
            html += '<div class="comment">' + showComments[c].content + ' <span class="comment-date">' + (showComments[c].posted_at || '') + '</span></div>';
          }
          if (tk.comments.length > 3) html += '<div class="comment" style="font-style:italic">... and ' + (tk.comments.length-3) + ' more</div>';
          html += '</div>';
        }
        html += '</div></div>';
      }
    }
    html += '</div>';
  }

  if (!html) html = '<div class="no-tasks">No tasks found</div>';
  document.getElementById('content').innerHTML = html;
  document.getElementById('ts').textContent = 'Rendered: ' + new Date().toLocaleString();
}

function setProject(p) { activeProject = p; render(); }

load();
setInterval(load, 30000);
</script>`);
}

// ── Chart Examples Page ─────────────────────────────────────────────

function chartsPage(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`${pageHead('Chart Examples', { includeChartJs: true })}
${pageHeader('📈 Chart Examples', 'Reference charts for building agent dashboards — copy these patterns', '/charts')}
${chartDefaults()}

<div class="grid grid-2">

  <!-- 1. Line Chart -->
  <div class="card">
    <h3 class="card-header">Line Chart — Monthly Revenue Trend</h3>
    <div class="chart-container wide"><canvas id="lineChart"></canvas></div>
    <details class="code-block"><summary>View code</summary><pre><code>new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    datasets: [{
      label: 'Revenue ($)',
      data: [4200, 4800, 5100, 4900, 5600, 6200, 5800, 6800, 7200, 7800, 8100, 8900],
      borderColor: COLORS.accent,
      backgroundColor: 'rgba(0,217,255,0.1)',
      fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 6
    }]
  },
  options: {
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { callback: v =&gt; '$' + v } } }
  }
});</code></pre></details>
  </div>

  <!-- 2. Bar Chart -->
  <div class="card">
    <h3 class="card-header">Bar Chart — Tasks by Project</h3>
    <div class="chart-container wide"><canvas id="barChart"></canvas></div>
    <details class="code-block"><summary>View code</summary><pre><code>new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['PsyFiGPT', 'Ordisio', 'PsyFi Assist', 'Reports', 'Infrastructure'],
    datasets: [
      { label: 'Completed', data: [12, 8, 15, 3, 6], backgroundColor: COLORS.green, borderRadius: 6, borderSkipped: false },
      { label: 'In Progress', data: [5, 3, 7, 2, 4], backgroundColor: COLORS.yellow, borderRadius: 6, borderSkipped: false },
      { label: 'Blocked', data: [2, 1, 3, 0, 1], backgroundColor: COLORS.red, borderRadius: 6, borderSkipped: false }
    ]
  },
  options: {
    plugins: { legend: { position: 'top' } },
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
  }
});</code></pre></details>
  </div>

  <!-- 3. Doughnut Chart -->
  <div class="card">
    <h3 class="card-header">Doughnut Chart — Submissions by Status</h3>
    <div class="chart-container square"><canvas id="doughnutChart"></canvas></div>
    <details class="code-block"><summary>View code</summary><pre><code>new Chart(ctx, {
  type: 'doughnut',
  data: {
    labels: ['Done', 'Pending', 'Failed', 'Skipped'],
    datasets: [{
      data: [42, 18, 7, 3],
      backgroundColor: [COLORS.green, COLORS.yellow, COLORS.red, COLORS.muted],
      borderColor: 'transparent', borderWidth: 2
    }]
  },
  options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
});</code></pre></details>
  </div>

  <!-- 4. Area Chart -->
  <div class="card">
    <h3 class="card-header">Area Chart — Weekly Active Users</h3>
    <div class="chart-container wide"><canvas id="areaChart"></canvas></div>
    <details class="code-block"><summary>View code</summary><pre><code>new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12'],
    datasets: [
      { label: 'PsyFiGPT', data: [120,135,142,138,155,168,172,180,195,210,225,240],
        borderColor: COLORS.accent, backgroundColor: 'rgba(0,217,255,0.15)', fill: true, tension: 0.35 },
      { label: 'Ordisio', data: [45,52,48,55,62,58,65,72,68,75,82,88],
        borderColor: COLORS.purple, backgroundColor: 'rgba(168,85,247,0.15)', fill: true, tension: 0.35 }
    ]
  },
  options: {
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true, stacked: true } }
  }
});</code></pre></details>
  </div>

  <!-- 5. Horizontal Bar Chart -->
  <div class="card">
    <h3 class="card-header">Horizontal Bar — Top Pages by Traffic</h3>
    <div class="chart-container wide"><canvas id="hbarChart"></canvas></div>
    <details class="code-block"><summary>View code</summary><pre><code>new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['/pricing', '/features', '/blog/adhd-tips', '/signup', '/about', '/docs'],
    datasets: [{
      label: 'Page Views', data: [3420, 2850, 2210, 1890, 1340, 980],
      backgroundColor: COLOR_PALETTE, borderRadius: 6, borderSkipped: false
    }]
  },
  options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
});</code></pre></details>
  </div>

  <!-- 6. Mixed Chart -->
  <div class="card">
    <h3 class="card-header">Mixed Chart — Cost vs Requests</h3>
    <div class="chart-container wide"><canvas id="mixedChart"></canvas></div>
    <details class="code-block"><summary>View code</summary><pre><code>new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Jan','Feb','Mar','Apr','May','Jun'],
    datasets: [
      { type: 'bar', label: 'API Requests (k)', data: [12, 15, 18, 22, 28, 35],
        backgroundColor: 'rgba(0,217,255,0.6)', borderRadius: 6, borderSkipped: false, yAxisID: 'y' },
      { type: 'line', label: 'Cost ($)', data: [45, 52, 68, 82, 105, 130],
        borderColor: COLORS.orange, backgroundColor: 'transparent',
        tension: 0.35, pointRadius: 5, pointHoverRadius: 7, yAxisID: 'y1' }
    ]
  },
  options: {
    plugins: { legend: { position: 'top' } },
    scales: {
      y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Requests (k)' } },
      y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Cost ($)' } }
    }
  }
});</code></pre></details>
  </div>

</div>

<div class="card" style="margin-top: 24px;">
  <h3 class="card-header">Usage Notes</h3>
  <div style="color: var(--muted); font-size: 0.88rem; line-height: 1.6;">
    <p><strong style="color: var(--text);">CDN:</strong> <code>&lt;script src="${CHART_JS_CDN}"&gt;&lt;/script&gt;</code></p>
    <p style="margin-top: 8px;"><strong style="color: var(--text);">Global defaults</strong> are set by <code>chartDefaults()</code> — colors, fonts, and tooltips are pre-configured.</p>
    <p style="margin-top: 8px;"><strong style="color: var(--text);">Color palette:</strong> <code>COLOR_PALETTE</code> cycles through accent, green, purple, yellow, orange, red.</p>
    <p style="margin-top: 8px;"><strong style="color: var(--text);">Individual colors:</strong> <code>COLORS.accent</code>, <code>COLORS.green</code>, <code>COLORS.purple</code>, <code>COLORS.yellow</code>, <code>COLORS.orange</code>, <code>COLORS.red</code>, <code>COLORS.muted</code></p>
  </div>
</div>

${pageFooter()}

<script>
new Chart(document.getElementById('lineChart'), {
  type: 'line', data: { labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    datasets: [{ label: 'Revenue ($)', data: [4200,4800,5100,4900,5600,6200,5800,6800,7200,7800,8100,8900],
      borderColor: COLORS.accent, backgroundColor: 'rgba(0,217,255,0.1)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 6 }] },
  options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: function(v){return '$'+v;} } } } }
});
new Chart(document.getElementById('barChart'), {
  type: 'bar', data: { labels: ['PsyFiGPT','Ordisio','PsyFi Assist','Reports','Infrastructure'],
    datasets: [
      { label: 'Completed', data: [12,8,15,3,6], backgroundColor: COLORS.green, borderRadius: 6, borderSkipped: false },
      { label: 'In Progress', data: [5,3,7,2,4], backgroundColor: COLORS.yellow, borderRadius: 6, borderSkipped: false },
      { label: 'Blocked', data: [2,1,3,0,1], backgroundColor: COLORS.red, borderRadius: 6, borderSkipped: false }
    ] },
  options: { plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
});
new Chart(document.getElementById('doughnutChart'), {
  type: 'doughnut', data: { labels: ['Done','Pending','Failed','Skipped'],
    datasets: [{ data: [42,18,7,3], backgroundColor: [COLORS.green,COLORS.yellow,COLORS.red,COLORS.muted], borderColor: 'transparent', borderWidth: 2 }] },
  options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
});
new Chart(document.getElementById('areaChart'), {
  type: 'line', data: { labels: ['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12'],
    datasets: [
      { label: 'PsyFiGPT', data: [120,135,142,138,155,168,172,180,195,210,225,240], borderColor: COLORS.accent, backgroundColor: 'rgba(0,217,255,0.15)', fill: true, tension: 0.35 },
      { label: 'Ordisio', data: [45,52,48,55,62,58,65,72,68,75,82,88], borderColor: COLORS.purple, backgroundColor: 'rgba(168,85,247,0.15)', fill: true, tension: 0.35 }
    ] },
  options: { plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, stacked: true } } }
});
new Chart(document.getElementById('hbarChart'), {
  type: 'bar', data: { labels: ['/pricing','/features','/blog/adhd-tips','/signup','/about','/docs'],
    datasets: [{ label: 'Page Views', data: [3420,2850,2210,1890,1340,980], backgroundColor: COLOR_PALETTE, borderRadius: 6, borderSkipped: false }] },
  options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
});
new Chart(document.getElementById('mixedChart'), {
  type: 'bar', data: { labels: ['Jan','Feb','Mar','Apr','May','Jun'],
    datasets: [
      { type: 'bar', label: 'API Requests (k)', data: [12,15,18,22,28,35], backgroundColor: 'rgba(0,217,255,0.6)', borderRadius: 6, borderSkipped: false, yAxisID: 'y' },
      { type: 'line', label: 'Cost ($)', data: [45,52,68,82,105,130], borderColor: COLORS.orange, backgroundColor: 'transparent', tension: 0.35, pointRadius: 5, pointHoverRadius: 7, yAxisID: 'y1' }
    ] },
  options: { plugins: { legend: { position: 'top' } }, scales: {
    y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Requests (k)' } },
    y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Cost ($)' } } } }
});
</script>`);
}

// ── HTTP Server ─────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const handler = routes[url];
  if (handler) {
    handler(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard server running on http://0.0.0.0:${PORT}`);
  console.log('Routes:');
  for (const route of Object.keys(routes)) {
    console.log(`  ${route}`);
  }
});
