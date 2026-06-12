'use client';
import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#60B5FF', '#FF9149', '#FF9898', '#FF90BB', '#FF6363', '#80D8C3', '#A19AD3', '#72BF78'];

export function RevenueChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => (data ?? [])?.map?.((d: any) => ({
    date: d?.date?.slice?.(5) ?? '',
    revenue: Number(d?.revenue ?? 0),
  })) ?? [], [data]);

  if ((chartData ?? [])?.length === 0) return <EmptyChart message="No revenue data available" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
        <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }} />
        <YAxis tickLine={false} tick={{ fontSize: 10 }} label={{ value: 'Revenue', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }} />
        <Tooltip contentStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="revenue" stroke="#60B5FF" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SpendByChannelChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => (data ?? [])?.map?.((d: any, i: number) => ({
    name: d?.channel ?? d?.name ?? `Channel ${i + 1}`,
    value: Number(d?.total_spend ?? d?.spend ?? d?.value ?? 0),
  })) ?? [], [data]);

  if ((chartData ?? [])?.length === 0) return <EmptyChart message="No spend data available" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value" label={({ name }: any) => name ?? ''}>
          {chartData?.map?.((_: any, i: number) => <Cell key={i} fill={COLORS[i % (COLORS?.length ?? 8)]} />) ?? []}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 11 }} />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopCampaignsChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => (data ?? [])?.slice?.(0, 6)?.map?.((d: any) => ({
    name: (d?.name ?? d?.campaign_name ?? '')?.slice?.(0, 15) ?? '',
    roas: Number(d?.roas ?? 0),
  })) ?? [], [data]);

  if ((chartData ?? [])?.length === 0) return <EmptyChart message="No campaign data available" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
        <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={50} />
        <YAxis tickLine={false} tick={{ fontSize: 10 }} label={{ value: 'ROAS', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }} />
        <Tooltip contentStyle={{ fontSize: 11 }} />
        <Bar dataKey="roas" fill="#FF9149" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Usage analytics charts (Phase 3D)
// ---------------------------------------------------------------------------

export function GenerationTrendChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => (data ?? [])?.map?.((d: any) => ({
    date: d?.date?.slice?.(5) ?? '',
    generations: Number(d?.generations ?? 0),
  })) ?? [], [data]);

  if ((chartData ?? [])?.length === 0) return <EmptyChart message="No generation data available" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
        <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }} />
        <YAxis allowDecimals={false} tickLine={false} tick={{ fontSize: 10 }} label={{ value: 'Generations', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }} />
        <Tooltip contentStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="generations" stroke="#A19AD3" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ContentTypeChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => (data ?? [])?.map?.((d: any, i: number) => ({
    name: d?.label ?? d?.contentType ?? `Type ${i + 1}`,
    value: Number(d?.generations ?? 0),
  })) ?? [], [data]);

  if ((chartData ?? [])?.length === 0) return <EmptyChart message="No content data available" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value" label={({ name }: any) => name ?? ''}>
          {chartData?.map?.((_: any, i: number) => <Cell key={i} fill={COLORS[i % (COLORS?.length ?? 8)]} />) ?? []}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 11 }} />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CostByProviderChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => (data ?? [])?.map?.((d: any) => ({
    name: d?.label ?? d?.provider ?? '',
    cost: Number(d?.cost ?? 0),
  })) ?? [], [data]);

  if ((chartData ?? [])?.length === 0) return <EmptyChart message="No provider cost data available" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
        <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 10 }} />
        <YAxis tickLine={false} tick={{ fontSize: 10 }} label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }} />
        <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: any) => [`$${Number(v).toFixed(4)}`, 'Cost']} />
        <Bar dataKey="cost" fill="#80D8C3" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
