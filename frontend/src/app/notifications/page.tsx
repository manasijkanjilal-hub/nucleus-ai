'use client';

// =============================================================================
// /notifications — full notification list with All / Unread tabs.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

type Filter = 'all' | 'unread';

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleString();
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?filter=${f}&limit=100`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const markOne = async (id: string) => {
    setItems((prev) =>
      filter === 'unread'
        ? prev.filter((n) => n.id !== id)
        : prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      /* best-effort */
    }
  };

  const markAll = async () => {
    setItems((prev) => (filter === 'unread' ? [] : prev.map((n) => ({ ...n, read: true }))));
    setUnread(0);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
    } catch {
      /* best-effort */
    }
  };

  return (
    <>
      <DashboardHeader title="Notifications" />
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border bg-muted p-[3px]">
            {(['all', 'unread'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors',
                  filter === f ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f}
                {f === 'unread' && unread > 0 ? ` (${unread})` : ''}
              </button>
            ))}
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAll}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {filter === 'unread' ? "You're all caught up!" : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => !n.read && markOne(n.id)}
                  className={cn(
                    'flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      n.read ? 'bg-transparent' : 'bg-primary',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{n.message}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
