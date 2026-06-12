'use client';

// =============================================================================
// Nucleus AI — Command Palette (⌘K / Ctrl+K)
// =============================================================================
// Global quick-navigation menu. Listens for Cmd/Ctrl+K, renders a searchable
// command list, and routes on selection. Mounted once in Providers.
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  LayoutDashboard,
  Sparkles,
  Database,
  BarChart3,
  Megaphone,
  Building2,
  Settings,
  Bell,
  CreditCard,
  ShieldCheck,
  ScrollText,
  Server,
  Search,
} from 'lucide-react';

interface NavCommand {
  label: string;
  href: string;
  icon: React.ElementType;
  group: string;
  keywords?: string;
}

const COMMANDS: NavCommand[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, group: 'Navigation' },
  { label: 'Generate Campaign', href: '/campaign-generator', icon: Sparkles, group: 'Navigation', keywords: 'ai create content' },
  { label: 'Context Vault', href: '/context-vault', icon: Database, group: 'Navigation', keywords: 'documents upload' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, group: 'Navigation', keywords: 'reports charts metrics' },
  { label: 'Campaigns', href: '/campaigns', icon: Megaphone, group: 'Navigation' },
  { label: 'Brand Profile', href: '/brand-profile', icon: Building2, group: 'Navigation' },
  { label: 'Notifications', href: '/notifications', icon: Bell, group: 'Account' },
  { label: 'Billing', href: '/billing', icon: CreditCard, group: 'Account' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'Account' },
  { label: 'Admin Dashboard', href: '/admin/dashboard', icon: ShieldCheck, group: 'Admin' },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText, group: 'Admin' },
  { label: 'System Settings', href: '/admin/system', icon: Server, group: 'Admin' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const groups = Array.from(new Set(COMMANDS.map((c) => c.group)));

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Menu"
      className="fixed inset-0 z-[100] flex items-start justify-center"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
      />
      {/* Panel */}
      <div className="relative mt-[18vh] w-full max-w-lg origin-top animate-scale-in overflow-hidden rounded-2xl border border-white/10 bg-popover shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Command.Input
            autoFocus
            placeholder="Search pages and actions…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-[55vh] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>
          {groups.map((group) => (
            <Command.Group
              key={group}
              heading={group}
              className="px-1 py-1 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            >
              {COMMANDS.filter((c) => c.group === group).map((c) => {
                const Icon = c.icon;
                return (
                  <Command.Item
                    key={c.href}
                    value={`${c.label} ${c.keywords ?? ''}`}
                    onSelect={() => runCommand(c.href)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-indigo-500/15 data-[selected=true]:to-purple-500/10 data-[selected=true]:text-foreground"
                  >
                    <Icon className="h-4 w-4 text-violet-500" />
                    {c.label}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}

export default CommandPalette;
