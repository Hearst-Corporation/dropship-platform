'use client';

import React, { useState } from 'react';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from '@heroicons/react/20/solid';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatGrid, AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminCard } from '@/components/admin/AdminCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'google' | 'meta' | 'tiktok' | 'amazon';
type Period = '7d' | '30d' | 'mtd';

interface Campaign {
  id: string;
  name: string;
  channel: Channel;
  status: 'active' | 'paused' | 'ended';
  budget_eur: number;
  spent_eur: number;
  revenue_eur: number;
  clicks: number;
  impressions: number;
  conversions: number;
  store: string;
}

interface ChannelSummary {
  channel: Channel;
  label: string;
  spent_eur: number;
  revenue_eur: number;
  clicks: number;
  impressions: number;
  conversions: number;
  campaigns_active: number;
  connected: boolean;
}

// ─── Channel SVG logos ────────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MetaLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none">
      <path d="M12 2.5C6.753 2.5 2.5 6.753 2.5 12S6.753 21.5 12 21.5 21.5 17.247 21.5 12 17.247 2.5 12 2.5z" fill="url(#meta-grad)"/>
      <path d="M8.08 14.93c.44.72 1.1 1.2 1.9 1.2.73 0 1.28-.28 1.73-.97l2.39-3.77 1.33 2.12c.16.26.23.55.18.83-.06.33-.26.6-.54.77-.28.18-.62.22-.94.12-.32-.1-.57-.33-.7-.64l-.3-.72-.87 1.4c.35.56.82.96 1.38 1.17.56.2 1.17.18 1.71-.06.54-.24.97-.67 1.2-1.22.23-.55.22-1.17-.04-1.7l-1.54-2.47 1.16-1.82c.28-.44.72-.7 1.18-.7s.9.26 1.18.7c.27.44.3.97.08 1.43l-.88 1.82.93 1.5c.42-.88.55-1.88.36-2.85-.19-.97-.73-1.84-1.53-2.44-.8-.6-1.79-.88-2.78-.8-.99.09-1.91.54-2.58 1.27L12 10.73l-.42-.67c-.67-.73-1.59-1.18-2.58-1.27-.99-.08-1.98.2-2.78.8-.8.6-1.34 1.47-1.53 2.44-.19.97-.06 1.97.36 2.85l.93-1.5-.88-1.82c-.22-.46-.19-.99.08-1.43.27-.44.72-.7 1.18-.7s.9.26 1.18.7l3.24 5.13c-.25.38-.58.6-.97.6-.46 0-.87-.28-1.13-.76l-.9 1.13z" fill="white"/>
      <defs>
        <linearGradient id="meta-grad" x1="12" y1="2.5" x2="12" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18ACFE"/>
          <stop offset="1" stopColor="#0163E0"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function TikTokLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.2 8.2 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/>
    </svg>
  );
}

function AmazonLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path d="M13.958 10.09c0 1.232.03 2.257-.591 3.347-.502.891-1.301 1.44-2.186 1.44-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.687zm3.186 7.705a.66.66 0 01-.76.074c-1.068-.887-1.258-1.299-1.845-2.144-1.76 1.795-3.008 2.332-5.291 2.332-2.703 0-4.806-1.668-4.806-5.005 0-2.607 1.414-4.382 3.425-5.252 1.743-.77 4.176-.907 6.038-1.117v-.417c0-.768.06-1.675-.392-2.337-.392-.591-1.144-.835-1.807-.835-1.227 0-2.319.63-2.588 1.937-.054.293-.267.582-.56.596l-3.147-.339c-.264-.059-.556-.273-.482-.678C5.947 2.015 8.793 1 11.35 1c1.31 0 3.022.349 4.056 1.341C16.738 3.555 16.62 5.17 16.62 6.91v4.666c0 1.402.581 2.018 1.129 2.775.193.271.235.595-.01.796l-2.595 2.648zm3.675 1.49c-2.958 2.187-7.253 3.35-10.95 3.35-5.18 0-9.843-1.913-13.373-5.098-.277-.25-.03-.592.303-.397 3.808 2.217 8.513 3.55 13.37 3.55 3.278 0 6.88-.679 10.198-2.088.5-.213.92.329.452.683zm1.287-1.47c-.378-.485-2.496-.229-3.449-.115-.29.035-.334-.217-.073-.4 1.689-1.187 4.459-.845 4.783-.447.324.4-.085 3.176-1.668 4.502-.243.204-.474.095-.366-.174.356-.89 1.152-2.882.773-3.366z" fill="#FF9900"/>
    </svg>
  );
}

// ─── Mock data (remplacé par vraies APIs — Google Ads, Meta Graph, TikTok Business, Amazon Ads) ──

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: 'c1', name: 'Yoga Mat Pro — Search', channel: 'google', status: 'active', budget_eur: 30, spent_eur: 22.4, revenue_eur: 187, clicks: 412, impressions: 8200, conversions: 14, store: 'YogaMat Store' },
  { id: 'c2', name: 'Yoga Mat — Remarketing', channel: 'google', status: 'active', budget_eur: 15, spent_eur: 11.8, revenue_eur: 94, clicks: 230, impressions: 12400, conversions: 7, store: 'YogaMat Store' },
  { id: 'c3', name: 'Collagen Boost — IG Feed', channel: 'meta', status: 'active', budget_eur: 50, spent_eur: 48.1, revenue_eur: 312, clicks: 1840, impressions: 54000, conversions: 24, store: 'Beauty Lab' },
  { id: 'c4', name: 'Collagen Boost — Reels', channel: 'meta', status: 'active', budget_eur: 40, spent_eur: 39.5, revenue_eur: 276, clicks: 2100, impressions: 89000, conversions: 19, store: 'Beauty Lab' },
  { id: 'c5', name: 'Drone FPV — Spark', channel: 'tiktok', status: 'active', budget_eur: 60, spent_eur: 54.2, revenue_eur: 410, clicks: 3200, impressions: 210000, conversions: 31, store: 'TechDrone' },
  { id: 'c6', name: 'Drone FPV — TopView', channel: 'tiktok', status: 'paused', budget_eur: 80, spent_eur: 12.0, revenue_eur: 48, clicks: 520, impressions: 45000, conversions: 4, store: 'TechDrone' },
  { id: 'c7', name: 'Camping Kit — Sponsored', channel: 'amazon', status: 'active', budget_eur: 25, spent_eur: 24.9, revenue_eur: 318, clicks: 890, impressions: 22000, conversions: 28, store: 'OutdoorKit' },
  { id: 'c8', name: 'Camping Kit — Display', channel: 'amazon', status: 'active', budget_eur: 20, spent_eur: 18.3, revenue_eur: 198, clicks: 430, impressions: 18000, conversions: 15, store: 'OutdoorKit' },
];

const CHANNEL_META: Record<Channel, { label: string; Logo: () => React.ReactElement }> = {
  google:  { label: 'Google Ads',   Logo: GoogleLogo },
  meta:    { label: 'Meta (FB/IG)', Logo: MetaLogo },
  tiktok:  { label: 'TikTok Ads',  Logo: TikTokLogo },
  amazon:  { label: 'Amazon Ads',  Logo: AmazonLogo },
};

function buildChannelSummaries(campaigns: Campaign[]): ChannelSummary[] {
  return (['google', 'meta', 'tiktok', 'amazon'] as Channel[]).map((channel) => {
    const m = CHANNEL_META[channel];
    const cc = campaigns.filter((c) => c.channel === channel);
    return {
      channel,
      label: m.label,
      spent_eur: cc.reduce((s, c) => s + c.spent_eur, 0),
      revenue_eur: cc.reduce((s, c) => s + c.revenue_eur, 0),
      clicks: cc.reduce((s, c) => s + c.clicks, 0),
      impressions: cc.reduce((s, c) => s + c.impressions, 0),
      conversions: cc.reduce((s, c) => s + c.conversions, 0),
      campaigns_active: cc.filter((c) => c.status === 'active').length,
      connected: true,
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function fmtNum(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n);
}
function roas(revenue: number, spent: number) {
  if (spent === 0) return '—';
  return `×${(revenue / spent).toFixed(2)}`;
}
function cpa(spent: number, conversions: number) {
  if (conversions === 0) return '—';
  return fmtEur(spent / conversions);
}
function ctr(clicks: number, impressions: number) {
  if (impressions === 0) return '—';
  return `${((clicks / impressions) * 100).toFixed(2)} %`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const tabs: { value: Period; label: string }[] = [
    { value: '7d', label: '7 jours' },
    { value: '30d', label: '30 jours' },
    { value: 'mtd', label: 'Ce mois' },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-gray-800/50 p-1 ring-1 ring-white/10">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={
            value === t.value
              ? 'rounded-md bg-gray-700 px-3 py-1 text-xs font-medium text-white'
              : 'rounded-md px-3 py-1 text-xs font-medium text-gray-400 hover:text-white'
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ChannelBadge({ channel }: { channel: Channel }) {
  const { Logo } = CHANNEL_META[channel];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-800/50 px-2 py-1 text-xs font-medium text-gray-300 ring-1 ring-inset ring-white/10">
      <Logo />
      {CHANNEL_META[channel].label.split(' ')[0]}
    </span>
  );
}

function StatusDot({ status }: { status: Campaign['status'] }) {
  const cls: Record<Campaign['status'], string> = {
    active: 'bg-indigo-400',
    paused: 'bg-gray-500',
    ended: 'bg-white/10',
  };
  return <span className={`inline-block size-1.5 rounded-full ${cls[status]}`} />;
}

function RoasBadge({ value }: { value: number }) {
  const good = value >= 1.5;
  const Icon = good ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${good ? 'text-indigo-400' : 'text-gray-500'}`}
    >
      <Icon className="size-3" aria-hidden />
      &times;{value.toFixed(2)}
    </span>
  );
}

function ConnectBanner({ channel }: { channel: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-800/50 px-4 py-3 text-xs text-gray-400 ring-1 ring-white/10">
      <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold text-gray-300">{channel}</strong> — compte non connect&eacute;. Configure la cl&eacute; API dans{' '}
        <a href="/admin/settings" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">R&eacute;glages</a>.
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all');

  const campaigns = MOCK_CAMPAIGNS;
  const filtered = channelFilter === 'all' ? campaigns : campaigns.filter((c) => c.channel === channelFilter);
  const summaries = buildChannelSummaries(campaigns);

  const totalSpent = campaigns.reduce((s, c) => s + c.spent_eur, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue_eur, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Mock data warning banner */}
      <div className="flex items-center gap-2.5 rounded-xl bg-amber-400/10 px-4 py-2.5 text-xs text-amber-400 ring-1 ring-inset ring-amber-400/20">
        <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">Donn&eacute;es mock&eacute;es</strong> — connecte Google Ads, Meta Graph API, TikTok Business API et Amazon Ads dans{' '}
          <a href="/admin/settings" className="font-medium underline underline-offset-2 hover:text-amber-300">R&eacute;glages</a>{' '}
          pour afficher les vraies m&eacute;triques.
        </span>
      </div>

      <AdminPageHeader
        eyebrow="Marketing · Pub payée"
        title="Campagnes & revenus"
        description="Vue consolidée de toutes les campagnes actives — Google, Meta, TikTok, Amazon. Dépenses, revenus, ROAS et conversions en temps réel."
        actions={
          <div className="flex items-center gap-3">
            <PeriodTabs value={period} onChange={setPeriod} />
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400"
            >
              <PlusIcon className="size-4" aria-hidden />
              Nouvelle campagne
            </button>
          </div>
        }
      />

      {/* KPIs globaux */}
      <AdminStatGrid>
        <AdminStatCard label="Dépensé" value={fmtEur(totalSpent)} />
        <AdminStatCard label="Revenus" value={fmtEur(totalRevenue)} />
        <AdminStatCard label="ROAS global" value={roas(totalRevenue, totalSpent)} />
        <AdminStatCard label="Conversions" value={fmtNum(totalConversions)} />
        <AdminStatCard label="Clics" value={fmtNum(totalClicks)} />
        <AdminStatCard label="Campagnes actives" value={String(activeCampaigns)} />
      </AdminStatGrid>

      {/* Par canal */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map((s) => {
          const { Logo } = CHANNEL_META[s.channel];
          return (
            <AdminCard key={s.channel} className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-gray-800/50 ring-1 ring-inset ring-white/10">
                    <Logo />
                  </span>
                  <span className="text-sm font-semibold text-white">{s.label}</span>
                </div>
                {s.connected ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-400">
                    <span className="size-1.5 rounded-full bg-indigo-400" /> Connecté
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-gray-500">
                    <span className="size-1.5 rounded-full bg-gray-600" /> Non connecté
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Dépensé</p>
                  <p className="font-semibold tabular-nums text-white">{fmtEur(s.spent_eur)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Revenus</p>
                  <p className="font-semibold tabular-nums text-white">{fmtEur(s.revenue_eur)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500">ROAS</p>
                  <RoasBadge value={s.spent_eur > 0 ? s.revenue_eur / s.spent_eur : 0} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Campagnes</p>
                  <p className="font-semibold text-white">{s.campaigns_active} actives</p>
                </div>
              </div>
            </AdminCard>
          );
        })}
      </section>

      {/* Filtre canal */}
      <div className="flex items-center gap-2">
        {(['all', 'google', 'meta', 'tiktok', 'amazon'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannelFilter(c)}
            className={
              channelFilter === c
                ? 'rounded-lg bg-indigo-500 px-3 py-1 text-xs font-medium text-white'
                : 'rounded-lg bg-gray-800/50 px-3 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-white/10 hover:text-white'
            }
          >
            {c === 'all' ? 'Tous' : c === 'google' ? 'Google' : c === 'meta' ? 'Meta' : c === 'tiktok' ? 'TikTok' : 'Amazon'}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">{filtered.length} campagne{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau campagnes */}
      <AdminCard className="min-h-0 flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                <th scope="col" className="px-4 py-2.5 text-left font-medium text-white">Campagne</th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium text-white">Canal</th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium text-white">Store</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium text-white">Budget</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium text-white">Dépensé</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium text-white">Revenus</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium text-white">ROAS</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium text-white">Conv.</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium text-white">CPA</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium text-white">Clics</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium text-white">CTR</th>
                <th scope="col" className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusDot status={c.status} />
                      <span className="font-medium text-white">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><ChannelBadge channel={c.channel} /></td>
                  <td className="px-3 py-2.5 text-gray-400">{c.store}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">{fmtEur(c.budget_eur)}/j</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-white">{fmtEur(c.spent_eur)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-indigo-400">{fmtEur(c.revenue_eur)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <RoasBadge value={c.spent_eur > 0 ? c.revenue_eur / c.spent_eur : 0} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white">{c.conversions}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">{cpa(c.spent_eur, c.conversions)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">{fmtNum(c.clicks)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{ctr(c.clicks, c.impressions)}</td>
                  <td className="px-3 py-2.5 text-right"></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-white/10 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
              <tr>
                <td className="px-4 py-2.5 text-gray-500" colSpan={4}>Total &middot; {filtered.length} campagnes</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white">
                  {fmtEur(filtered.reduce((s, c) => s + c.spent_eur, 0))}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-indigo-400">
                  {fmtEur(filtered.reduce((s, c) => s + c.revenue_eur, 0))}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {(() => {
                    const s = filtered.reduce((a, c) => a + c.spent_eur, 0);
                    const r = filtered.reduce((a, c) => a + c.revenue_eur, 0);
                    return <RoasBadge value={s > 0 ? r / s : 0} />;
                  })()}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white">
                  {filtered.reduce((s, c) => s + c.conversions, 0)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">
                  {cpa(filtered.reduce((s, c) => s + c.spent_eur, 0), filtered.reduce((s, c) => s + c.conversions, 0))}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">
                  {fmtNum(filtered.reduce((s, c) => s + c.clicks, 0))}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                  {ctr(filtered.reduce((s, c) => s + c.clicks, 0), filtered.reduce((s, c) => s + c.impressions, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </AdminCard>

      {/* Banner non connectés */}
      {summaries.filter((s) => !s.connected).length > 0 && (
        <div className="flex flex-col gap-2">
          {summaries.filter((s) => !s.connected).map((s) => (
            <ConnectBanner key={s.channel} channel={s.label} />
          ))}
        </div>
      )}

      <p className="pb-1 text-center text-[10px] text-gray-500">
        Donn&eacute;es mock&eacute;es — connecte Google Ads, Meta Graph API, TikTok Business API et Amazon Ads API dans R&eacute;glages pour afficher les vraies m&eacute;triques.
      </p>
    </div>
  );
}
