"use client";

/**
 * AI SAAS DASHBOARD EXAMPLE
 * Demonstrates the full design system in a realistic product context.
 * Stack: Next.js App Router, Framer Motion, Recharts, all DS components.
 *
 * Sections:
 *  - Sidebar nav
 *  - Topbar with command palette trigger
 *  - KPI grid
 *  - Revenue chart (area)
 *  - Activity feed
 *  - AI prompt box
 *  - Data table
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarItem, SidebarToggle, SidebarMobileTrigger,
} from "../components/Sidebar";
import { Topbar, TopbarLeft, TopbarRight, PageHeader, ContentArea } from "../components/Topbar";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Card, KpiCard } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { cn } from "../utils/cn";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const revenueData = [
  { month: "Jan", mrr: 42000, arr: 504000 },
  { month: "Feb", mrr: 47500, arr: 570000 },
  { month: "Mar", mrr: 51200, arr: 614400 },
  { month: "Apr", mrr: 49800, arr: 597600 },
  { month: "May", mrr: 58900, arr: 706800 },
  { month: "Jun", mrr: 63400, arr: 760800 },
  { month: "Jul", mrr: 69200, arr: 830400 },
  { month: "Aug", mrr: 74100, arr: 889200 },
  { month: "Sep", mrr: 71800, arr: 861600 },
  { month: "Oct", mrr: 82300, arr: 987600 },
  { month: "Nov", mrr: 89600, arr: 1075200 },
  { month: "Dec", mrr: 96400, arr: 1156800 },
];

const usageData = [
  { day: "Mon", calls: 12400, tokens: 4200000 },
  { day: "Tue", calls: 15800, tokens: 5100000 },
  { day: "Wed", calls: 14200, tokens: 4800000 },
  { day: "Thu", calls: 18900, tokens: 6200000 },
  { day: "Fri", calls: 21200, tokens: 7100000 },
  { day: "Sat", calls: 9800,  tokens: 3200000 },
  { day: "Sun", calls: 8400,  tokens: 2800000 },
];

const kpis = [
  { title: "MRR",          value: "$96,400",  delta: "+7.6%",  deltaLabel: "vs last month", positive: true,  icon: "💰" },
  { title: "Active Users", value: "24,891",   delta: "+12.3%", deltaLabel: "vs last month", positive: true,  icon: "👥" },
  { title: "API Calls",    value: "21.2M",    delta: "+8.4%",  deltaLabel: "this week",     positive: true,  icon: "⚡" },
  { title: "Churn Rate",   value: "2.1%",     delta: "-0.3%",  deltaLabel: "vs last month", positive: true,  icon: "📉" },
];

const feed = [
  { user: "Sarah Chen",    avatar: undefined, action: "deployed new model",   target: "GPT-4o fine-tune v3", time: "2m ago",  type: "deploy" },
  { user: "Marcus Lee",    avatar: undefined, action: "opened incident",       target: "API latency spike",   time: "14m ago", type: "alert"  },
  { user: "Priya Sharma",  avatar: undefined, action: "merged PR",             target: "#482 — Streaming",   time: "38m ago", type: "merge"  },
  { user: "Jake Torres",   avatar: undefined, action: "upgraded plan",         target: "Enterprise",          time: "1h ago",  type: "upgrade"},
  { user: "Lisa Wang",     avatar: undefined, action: "generated report",      target: "Q4 Analytics",        time: "2h ago",  type: "report" },
];

const feedTypeColors: Record<string, "success" | "error" | "primary" | "warning" | "default"> = {
  deploy:  "success",
  alert:   "error",
  merge:   "primary",
  upgrade: "warning",
  report:  "default",
};

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────

function HomeIcon()      { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>; }
function ChartIcon()     { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13h12M4 10V6m3 4V4m3 6V8m3 5V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function UsersIcon()     { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11 12v-1a3 3 0 00-3-3H4a3 3 0 00-3 3v1M8 4a2 2 0 110 4 2 2 0 010-4zM14 12v-1a3 3 0 00-2-2.83" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function BrainIcon()     { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 6.5c.5-1 3-1 3 0 0 .5-.5 1-1.5 1.5v1.5M8 11v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function SettingsIcon()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.4"/><path d="M13.3 7.2l-.6-1.4 1-1.5-1.5-1.5-1.5 1-.5-.3L9.8 2H7.2L6.8 3.5l-.5.3L4.8 2.8 3.3 4.3l1 1.5-.6 1.4-1.5.6V9.8l1.5.6.6 1.4-1 1.5 1.5 1.5 1.5-1 .5.3.4 1.5h2.6l.4-1.5.5-.3 1.5 1 1.5-1.5-1-1.5.6-1.4 1.5-.6V7.8l-1.5-.6z" stroke="currentColor" strokeWidth="1.4"/></svg>; }
function SearchIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function BellIcon()      { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a4 4 0 00-4 4v3l-1.5 1.5v.5h11v-.5L12 9V6a4 4 0 00-4-4zM6 12a2 2 0 004 0" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>; }
function PlusIcon()      { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }

// ─── CUSTOM CHART TOOLTIP ──────────────────────────────────────────────────────

function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{value: number; name: string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-bg-primary border border-border shadow-floating p-3 text-label-sm">
      <p className="text-text-secondary font-medium mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="text-text-secondary capitalize">{p.name}</span>
          <span className="font-semibold text-text-primary tabular-nums">
            ${(p.value / 1000).toFixed(1)}k
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── STAGGER ANIMATION ────────────────────────────────────────────────────────

const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

// ─── AI PROMPT BOX ────────────────────────────────────────────────────────────

function AIPromptBox() {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [response, setResponse] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResponse(null);
    setTimeout(() => {
      setResponse(`Based on your Q4 data: MRR grew 17% to $96.4K. Top driver was enterprise expansion (↑24%). Churn improved to 2.1%. Recommended action: focus on SMB retention — 3 accounts at risk this month.`);
      setLoading(false);
    }, 1800);
  };

  return (
    <Card variant="default" padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-brand text-white shadow-glow">
          <BrainIcon />
        </div>
        <div>
          <p className="text-label-md font-semibold text-text-primary">AI Analytics Assistant</p>
          <p className="text-caption-sm text-text-tertiary">Ask anything about your data</p>
        </div>
        <Badge variant="success" dot size="sm" className="ml-auto">Live</Badge>
      </div>

      {/* Response area */}
      <div className="px-5 py-4 min-h-[80px]">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Skeleton variant="text" lines={3} />
            </motion.div>
          ) : response ? (
            <motion.p
              key="response"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-body-sm text-text-primary leading-relaxed"
            >
              {response}
            </motion.p>
          ) : (
            <motion.p key="empty" className="text-body-sm text-text-tertiary">
              Ask about metrics, trends, anomalies, or forecasts...
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 pb-4 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. What drove churn last quarter?"
          className="flex-1"
          rightElement={
            <Button
              type="submit"
              size="icon-sm"
              variant="primary"
              loading={loading}
              disabled={!query.trim()}
              className="shrink-0 mr-0.5"
              aria-label="Send"
            >
              {!loading && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </Button>
          }
        />
      </form>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        {["MRR breakdown", "Churn drivers", "Top customers", "API usage"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQuery(s)}
            className="text-caption-md text-text-secondary bg-bg-secondary border border-border rounded-full px-3 py-1 hover:bg-interactive-hover hover:text-text-primary transition-colors duration-100"
          >
            {s}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

export function AIDashboard() {
  const [commandOpen, setCommandOpen] = React.useState(false);

  // Open command palette with ⌘K
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-bg-canvas">

        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-brand shadow-glow shrink-0">
                <BrainIcon />
              </div>
              <span className="font-bold text-label-lg text-text-primary truncate">Hearst AI</span>
            </div>
            <SidebarToggle className="ml-auto" />
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup label="Main">
              <SidebarItem icon={<HomeIcon />}   label="Overview"   active href="#" />
              <SidebarItem icon={<ChartIcon />}  label="Analytics"  href="#" />
              <SidebarItem icon={<BrainIcon />}  label="AI Models"  href="#" badge={<Badge size="xs" variant="primary">3</Badge>} />
              <SidebarItem icon={<UsersIcon />}  label="Customers"  href="#" />
            </SidebarGroup>
            <SidebarGroup label="Config">
              <SidebarItem icon={<SettingsIcon />} label="Settings" href="#" />
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <div className="flex items-center gap-2.5 px-1 py-1">
              <Avatar name="Adrien B" size="sm" status="online" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-label-sm font-medium text-text-primary truncate">Adrien B.</span>
                <span className="text-caption-sm text-text-tertiary truncate">Admin</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Topbar */}
          <Topbar>
            <TopbarLeft>
              <SidebarMobileTrigger />
            </TopbarLeft>
            <TopbarRight>
              <button
                onClick={() => setCommandOpen(true)}
                className={cn(
                  "flex items-center gap-2 h-8 px-3 rounded-lg",
                  "border border-border bg-bg-secondary",
                  "text-label-sm text-text-tertiary",
                  "hover:bg-interactive-hover hover:text-text-primary",
                  "transition-colors duration-150"
                )}
              >
                <SearchIcon />
                <span className="hidden sm:block">Search...</span>
                <kbd className="hidden sm:flex items-center gap-0.5 ml-2 text-caption-sm font-mono text-text-quaternary">
                  <span>⌘K</span>
                </kbd>
              </button>
              <button className="relative flex items-center justify-center h-8 w-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-interactive-hover transition-colors">
                <BellIcon />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error-DEFAULT" aria-label="notifications" />
              </button>
              <Avatar name="Adrien B" size="sm" status="online" className="cursor-pointer" />
            </TopbarRight>
          </Topbar>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <PageHeader
              title="Overview"
              description="Q4 2024 — December snapshot"
              breadcrumb={[{ label: "Hearst AI" }, { label: "Overview" }]}
              actions={
                <>
                  <Button variant="secondary" size="sm" leftIcon={<ChartIcon />}>
                    Export
                  </Button>
                  <Button size="sm" leftIcon={<PlusIcon />}>
                    New Project
                  </Button>
                </>
              }
            />

            <ContentArea padded>
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="flex flex-col gap-6"
              >

                {/* KPI Grid */}
                <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {kpis.map((kpi) => (
                    <motion.div key={kpi.title} variants={staggerItem}>
                      <KpiCard
                        title={kpi.title}
                        value={kpi.value}
                        delta={kpi.delta}
                        deltaLabel={kpi.deltaLabel}
                        deltaPositive={kpi.positive}
                        icon={<span className="text-xl">{kpi.icon}</span>}
                      />
                    </motion.div>
                  ))}
                </motion.div>

                {/* Charts row */}
                <motion.div variants={staggerItem} className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                  {/* Revenue area chart */}
                  <Card variant="default" padding="lg" className="xl:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-heading-sm font-semibold text-text-primary">Revenue</h3>
                        <p className="text-caption-md text-text-tertiary mt-0.5">MRR growth YTD</p>
                      </div>
                      <div className="flex gap-2">
                        {["3M", "6M", "YTD"].map((p, i) => (
                          <button key={p} className={cn(
                            "h-7 px-3 rounded-lg text-label-xs font-medium transition-colors",
                            i === 2
                              ? "bg-brand-subtle text-brand"
                              : "text-text-tertiary hover:bg-interactive-hover hover:text-text-secondary"
                          )}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="var(--color-chart-1)" stopOpacity={0.18}/>
                              <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-gridLine)" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: "var(--color-chart-axisLabel)", fontSize: 11 }}
                            axisLine={false} tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => `$${v/1000}k`}
                            tick={{ fill: "var(--color-chart-axisLabel)", fontSize: 11 }}
                            axisLine={false} tickLine={false} width={44}
                          />
                          <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: "var(--color-border-brand)", strokeWidth: 1 }} />
                          <Area
                            type="monotone" dataKey="mrr"
                            stroke="var(--color-chart-1)" strokeWidth={2}
                            fill="url(#mrrGrad)" dot={false} activeDot={{ r: 4, fill: "var(--color-chart-1)", stroke: "var(--color-bg-primary)", strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* API Usage bar chart */}
                  <Card variant="default" padding="lg">
                    <div className="mb-6">
                      <h3 className="text-heading-sm font-semibold text-text-primary">API Calls</h3>
                      <p className="text-caption-md text-text-tertiary mt-0.5">Last 7 days</p>
                    </div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={usageData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-gridLine)" vertical={false} />
                          <XAxis
                            dataKey="day"
                            tick={{ fill: "var(--color-chart-axisLabel)", fontSize: 11 }}
                            axisLine={false} tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => `${v/1000}k`}
                            tick={{ fill: "var(--color-chart-axisLabel)", fontSize: 11 }}
                            axisLine={false} tickLine={false} width={36}
                          />
                          <Tooltip content={({ active, payload, label }) =>
                            active && payload?.length ? (
                              <div className="rounded-xl bg-bg-primary border border-border shadow-floating p-3 text-label-sm">
                                <p className="text-text-secondary mb-1">{label}</p>
                                <p className="font-semibold text-text-primary">{(payload[0].value as number / 1000).toFixed(1)}k calls</p>
                              </div>
                            ) : null
                          } />
                          <Bar dataKey="calls" fill="var(--color-chart-1)" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </motion.div>

                {/* Bottom row */}
                <motion.div variants={staggerItem} className="grid grid-cols-1 xl:grid-cols-5 gap-4">

                  {/* AI Prompt box */}
                  <div className="xl:col-span-3">
                    <AIPromptBox />
                  </div>

                  {/* Activity feed */}
                  <Card variant="default" padding="none" className="xl:col-span-2 flex flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                      <h3 className="text-heading-sm font-semibold text-text-primary">Activity</h3>
                      <button className="text-label-xs text-text-tertiary hover:text-text-primary transition-colors">
                        See all
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-2">
                      {feed.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-5 py-3 hover:bg-interactive-hover transition-colors"
                        >
                          <Avatar name={item.user} size="sm" status="none" />
                          <div className="flex-1 min-w-0">
                            <p className="text-label-sm text-text-primary">
                              <span className="font-medium">{item.user}</span>{" "}
                              <span className="text-text-secondary">{item.action}</span>{" "}
                              <span className="font-medium">{item.target}</span>
                            </p>
                            <p className="text-caption-sm text-text-tertiary mt-0.5">{item.time}</p>
                          </div>
                          <Badge
                            size="xs"
                            variant={feedTypeColors[item.type] ?? "default"}
                            className="shrink-0 mt-0.5"
                          >
                            {item.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              </motion.div>
            </ContentArea>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default AIDashboard;
