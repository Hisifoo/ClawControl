# Dashboard Update Instructions

Each agent maintains a JSON data file at:
```
/home/openclaw/.openclaw/workspace/dashboards/data/<agent>.json
```

The dashboard server reads this file on every page load and renders it. **No server restart needed** — just update the JSON file and the dashboard reflects changes on the next refresh (auto-refreshes every 30s).

**Every time you update your data file, set `last_modified` to the current ISO datetime.**

---

## Florence — House Manager

**Data file:** `data/florence.json`

### When to update
- After delegating a task to another agent
- After completing a coordination task
- When agent status changes (active/idle/blocked)
- After system health checks
- When services go up/down

### Schema

```json
{
  "last_modified": "2026-02-23T14:30:00Z",
  "stats": {
    "tasks_delegated_today": 5,
    "tasks_completed": 42,
    "open_blockers": 1,
    "system_health": "healthy",
    "health_note": "all services running"
  },
  "agent_status": [
    {
      "name": "Jerry",
      "status": "active",
      "current_task": "Fixing PsyFiGPT auth bug",
      "last_active": "2026-02-23T14:20:00Z"
    },
    {
      "name": "Clarissa",
      "status": "active",
      "current_task": "Writing blog post on ADHD tools",
      "last_active": "2026-02-23T14:15:00Z"
    },
    {
      "name": "Agnes",
      "status": "idle",
      "current_task": null,
      "last_active": "2026-02-23T12:00:00Z"
    }
  ],
  "delegations_by_agent": {
    "Jerry": 15,
    "Clarissa": 12,
    "Agnes": 8
  },
  "services": [
    { "name": "Dashboard Server (8000)", "status": "healthy" },
    { "name": "Copilot API (4141)", "status": "healthy" },
    { "name": "OpenClaw Gateway", "status": "healthy" }
  ],
  "activity": [
    {
      "icon": "📋",
      "text": "Delegated SEO keyword research to Clarissa",
      "time": "2026-02-23T14:30:00Z"
    },
    {
      "icon": "🔧",
      "text": "Delegated PsyFiGPT auth fix to Jerry",
      "time": "2026-02-23T14:20:00Z"
    },
    {
      "icon": "✅",
      "text": "Completed system health check — all green",
      "time": "2026-02-23T13:00:00Z"
    }
  ]
}
```

### Update command
```bash
python3 -c "
import json, datetime
f = '/home/openclaw/.openclaw/workspace/dashboards/data/florence.json'
try:
    d = json.load(open(f))
except:
    d = {'stats': {}, 'agent_status': [], 'delegations_by_agent': {}, 'services': [], 'activity': []}
d['last_modified'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
# ... modify d as needed ...
json.dump(d, open(f, 'w'), indent=2)
"
```

---

## Jerry — PsyFi Coder

**Data file:** `data/jerry.json`

### When to update
- After merging or opening a PR
- After deploying to any environment
- After fixing a bug or closing an issue
- After running CI/CD pipeline
- When product health status changes

### Schema

```json
{
  "last_modified": "2026-02-23T14:30:00Z",
  "stats": {
    "open_prs": 3,
    "prs_merged": 8,
    "prs_merged_period": "this week",
    "open_bugs": 2,
    "deployments": 4,
    "deployments_period": "this week",
    "test_pass_rate": 97
  },
  "products": [
    {
      "name": "PsyFiGPT",
      "branch": "main",
      "last_deploy": "2026-02-23T12:00:00Z",
      "ci_status": "healthy",
      "open_issues": 3
    },
    {
      "name": "Ordisio",
      "branch": "main",
      "last_deploy": "2026-02-22T18:00:00Z",
      "ci_status": "healthy",
      "open_issues": 1
    },
    {
      "name": "PsyFi Assistant",
      "branch": "main",
      "last_deploy": "2026-02-21T10:00:00Z",
      "ci_status": "warning",
      "open_issues": 5
    },
    {
      "name": "PsyFi Reports",
      "branch": "main",
      "last_deploy": "never",
      "ci_status": "healthy",
      "open_issues": 0
    }
  ],
  "commits_by_product": {
    "PsyFiGPT": 12,
    "Ordisio": 5,
    "PsyFi Assistant": 8,
    "PsyFi Reports": 0
  },
  "prs_by_status": {
    "open": 3,
    "merged": 8,
    "closed": 1,
    "draft": 2
  },
  "recent_prs": [
    {
      "title": "Fix Cognito SSO token refresh",
      "product": "PsyFiGPT",
      "status": "merged",
      "date": "2026-02-23",
      "url": "https://github.com/..."
    }
  ],
  "recent_deploys": [
    {
      "product": "PsyFiGPT",
      "description": "Deployed auth fix to production",
      "time": "2026-02-23T12:00:00Z",
      "commit": "abc1234"
    }
  ]
}
```

### Update command
```bash
python3 -c "
import json, datetime
f = '/home/openclaw/.openclaw/workspace/dashboards/data/jerry.json'
try:
    d = json.load(open(f))
except:
    d = {'stats': {}, 'products': [], 'commits_by_product': {}, 'prs_by_status': {}, 'recent_prs': [], 'recent_deploys': []}
d['last_modified'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
# ... modify d as needed ...
json.dump(d, open(f, 'w'), indent=2)
"
```

### Specific triggers

| Action | What to update |
|--------|---------------|
| Open a PR | Increment `stats.open_prs`, add to `recent_prs`, update `prs_by_status.open` |
| Merge a PR | Decrement `stats.open_prs`, increment `stats.prs_merged`, update PR status in `recent_prs`, update `prs_by_status` |
| Deploy | Increment `stats.deployments`, add to `recent_deploys`, update product's `last_deploy` |
| Fix a bug | Decrement `stats.open_bugs`, update product's `open_issues` |
| CI failure | Update product's `ci_status` to `"warning"` or `"critical"` |
| CI pass | Update product's `ci_status` to `"healthy"`, update `stats.test_pass_rate` |
| Push commits | Increment `commits_by_product` for the relevant product |

---

## Clarissa — Marketing Lead

**Data file:** `data/clarissa.json`

### When to update
- After publishing or drafting content
- After running SEO analysis (performance_track.py, trend_scan.py, paa_search.py)
- After posting to social media
- After competitor research
- After keyword ranking changes

### Schema

```json
{
  "last_modified": "2026-02-23T14:30:00Z",
  "stats": {
    "content_published": 12,
    "content_period": "this month",
    "content_in_pipeline": 5,
    "organic_clicks": 1840,
    "clicks_period": "last 28 days",
    "avg_position": "18.3",
    "social_followers": 342
  },
  "seo_trend": {
    "labels": ["W1", "W2", "W3", "W4"],
    "clicks": [320, 380, 450, 690]
  },
  "content_by_status": {
    "published": 12,
    "draft": 3,
    "review": 1,
    "scheduled": 1
  },
  "content_pipeline": [
    {
      "title": "5 ADHD Productivity Strategies That Actually Work",
      "type": "blog",
      "product": "Ordisio",
      "status": "published",
      "platform": "WordPress",
      "date": "2026-02-20",
      "url": "https://..."
    },
    {
      "title": "Why AI Documentation Matters in Therapy",
      "type": "blog",
      "product": "PsyFiGPT",
      "status": "draft",
      "platform": "WordPress",
      "date": "2026-02-23"
    }
  ],
  "top_pages": [
    { "page": "/blog/adhd-tips", "clicks": 450, "impressions": 8200, "ctr": "5.5%" },
    { "page": "/pricing", "clicks": 320, "impressions": 4100, "ctr": "7.8%" }
  ],
  "keyword_rankings": [
    { "keyword": "AI therapy documentation", "position": 12, "change": -3, "product": "PsyFiGPT" },
    { "keyword": "ADHD productivity app", "position": 28, "change": -5, "product": "Ordisio" },
    { "keyword": "patient intake automation", "position": 45, "change": 2, "product": "PsyFi Assistant" }
  ],
  "competitor_intel": [
    {
      "competitor": "SimplePractice",
      "note": "Launched AI note-taking feature, pricing unchanged at $69/mo",
      "date": "2026-02-22"
    }
  ],
  "social_performance": [
    {
      "platform": "TikTok",
      "followers": 180,
      "posts": 8,
      "engagement_rate": "4.2%",
      "top_post": "ADHD morning routine tips"
    },
    {
      "platform": "X/Twitter",
      "followers": 95,
      "posts": 15,
      "engagement_rate": "2.1%",
      "top_post": "Thread on AI in therapy"
    }
  ]
}
```

### Update command
```bash
python3 -c "
import json, datetime
f = '/home/openclaw/.openclaw/workspace/dashboards/data/clarissa.json'
try:
    d = json.load(open(f))
except:
    d = {'stats': {}, 'seo_trend': {}, 'content_by_status': {}, 'content_pipeline': [], 'top_pages': [], 'keyword_rankings': [], 'competitor_intel': [], 'social_performance': []}
d['last_modified'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
# ... modify d as needed ...
json.dump(d, open(f, 'w'), indent=2)
"
```

### Specific triggers

| Action | What to update |
|--------|---------------|
| Publish content | Increment `stats.content_published`, add to `content_pipeline` with status `"published"`, update `content_by_status` |
| Draft content | Increment `stats.content_in_pipeline`, add to `content_pipeline` with status `"draft"`, update `content_by_status` |
| Run SEO analysis | Update `stats.organic_clicks`, `stats.avg_position`, `top_pages`, `keyword_rankings`, `seo_trend` |
| Post to social | Update `social_performance` for that platform |
| Competitor research | Add entry to `competitor_intel` |
| Keyword ranking change | Update `keyword_rankings` — negative `change` means improved (lower position = better) |

---

## Agnes — Financial Strategist

**Data file:** `data/agnes.json`

**Note:** If `data/agnes.json` does not exist, the `/agnes` route falls back to the pre-rendered HTML dashboard in `agnes-workspace/dashboard_output/`. Once you create the JSON file, the new dashboard takes over.

### When to update
- After Stripe revenue check or billing event
- After calculating SaaS metrics (MRR, churn, LTV, CAC)
- After pricing changes or analysis
- When alert thresholds are triggered
- After cost/burn analysis

### Schema

```json
{
  "last_modified": "2026-02-23T14:30:00Z",
  "stats": {
    "mrr": 2450,
    "arr": 29400,
    "churn_rate": "2.1",
    "ltv_cac": "4.2:1",
    "quick_ratio": "5.8",
    "cash_runway": "14",
    "burn_rate": "1200",
    "mrr_change": "+$320"
  },
  "mrr_trend": {
    "labels": ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"],
    "values": [1800, 1950, 2100, 2130, 2280, 2450]
  },
  "revenue_by_product": {
    "PsyFiGPT": 1800,
    "Ordisio": 450,
    "PsyFi Assistant": 200
  },
  "product_financials": [
    {
      "name": "PsyFiGPT",
      "mrr": 1800,
      "subscribers": 24,
      "churn": "1.5",
      "arpu": 75,
      "status": "healthy"
    },
    {
      "name": "Ordisio",
      "mrr": 450,
      "subscribers": 30,
      "churn": "3.2",
      "arpu": 15,
      "status": "warning"
    },
    {
      "name": "PsyFi Assistant",
      "mrr": 200,
      "subscribers": 8,
      "churn": "0",
      "arpu": 25,
      "status": "healthy"
    }
  ],
  "alerts": [
    {
      "severity": "warning",
      "message": "Ordisio monthly churn approaching 3.5% threshold (currently 3.2%)",
      "date": "2026-02-23"
    },
    {
      "severity": "healthy",
      "message": "PsyFiGPT LTV:CAC ratio above target at 5.1:1",
      "date": "2026-02-22"
    }
  ],
  "cost_breakdown": [
    { "category": "AWS (EC2, RDS, S3, SQS)", "amount": 580 },
    { "category": "Azure OpenAI", "amount": 320 },
    { "category": "Render.com (Ordisio)", "amount": 45 },
    { "category": "Stripe Fees", "amount": 72 },
    { "category": "Domain/DNS", "amount": 25 },
    { "category": "Misc (Sentry, etc)", "amount": 38 }
  ],
  "pricing_tiers": [
    { "name": "PsyFiGPT Basic", "price": 49, "subscribers": 10, "percent": 42 },
    { "name": "PsyFiGPT Pro", "price": 99, "subscribers": 12, "percent": 50 },
    { "name": "PsyFiGPT Enterprise", "price": 199, "subscribers": 2, "percent": 8 }
  ]
}
```

### Update command
```bash
python3 -c "
import json, datetime
f = '/home/openclaw/.openclaw/workspace/dashboards/data/agnes.json'
try:
    d = json.load(open(f))
except:
    d = {'stats': {}, 'mrr_trend': {}, 'revenue_by_product': {}, 'product_financials': [], 'alerts': [], 'cost_breakdown': [], 'pricing_tiers': []}
d['last_modified'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
# ... modify d as needed ...
json.dump(d, open(f, 'w'), indent=2)
"
```

### Specific triggers

| Action | What to update |
|--------|---------------|
| Stripe revenue check | Update `stats.mrr`, `stats.arr`, `mrr_trend`, `revenue_by_product` |
| Churn event | Update `stats.churn_rate`, product's `churn`, check alert thresholds |
| New subscriber | Update product's `subscribers`, `mrr`, recalculate `arpu` |
| Pricing change | Update `pricing_tiers`, add alert noting the change |
| Cost analysis | Update `cost_breakdown`, `stats.burn_rate`, `stats.cash_runway` |
| Alert triggered | Add to `alerts` with appropriate severity (`"critical"`, `"warning"`, `"healthy"`) |
| LTV/CAC calculation | Update `stats.ltv_cac`, `stats.quick_ratio` |

---

## General Notes

- **File location:** All data files live in `/home/openclaw/.openclaw/workspace/dashboards/data/`
- **Format:** Standard JSON, pretty-printed with 2-space indent
- **Timestamps:** Use ISO 8601 format (`2026-02-23T14:30:00Z`)
- **last_modified:** Always update this field — it's displayed on the dashboard footer
- **No restart needed:** The server reads the file fresh on each request
- **Keep arrays bounded:** For `activity`, `recent_prs`, `recent_deploys`, etc., keep the last ~20 entries. Trim older ones.
- **Badge statuses:** Use these strings for proper styling: `done`, `pending`, `failed`, `skipped`, `open`, `merged`, `closed`, `active`, `draft`, `published`, `scheduled`, `healthy`, `warning`, `critical`
