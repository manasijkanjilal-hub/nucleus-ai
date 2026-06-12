'use client';

// =============================================================================
// Nucleus AI — Admin Panel Layout
// =============================================================================
// Provides the chrome (sidebar + topbar) for all /admin pages. Role-gated:
// only ADMIN and SUPER_ADMIN may view it; others are redirected to /dashboard.
// =============================================================================

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  ArrowLeft,
  LogOut,
  Loader2,
  CreditCard,
} from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const adminNav = [
  { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { title: 'Users', href: '/admin/users', icon: Users },
  { title: 'Brands', href: '/admin/brands', icon: Building2 },
  { title: 'Billing', href: '/admin/billing', icon: CreditCard },
];

function initialsFromName(name?: string | null, email?: string | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  }
  return (email?.[0] ?? 'U').toUpperCase();
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { data: session } = useSession();
  const { isAtLeast, isLoading, isAuthenticated, role } = usePermissions();

  const allowed = isAtLeast('ADMIN');

  // Role gating: redirect users who lack admin access.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!allowed) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, allowed, router]);

  if (isLoading || !isAuthenticated || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Checking permissions…</p>
        </div>
      </div>
    );
  }

  const user = session?.user;
  const displayName = user?.name ?? user?.email ?? 'Admin';

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Nucleus AI</span>
            <span className="text-xs text-muted-foreground">Admin Panel</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {adminNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-zinc-900 text-white'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {role}
            </span>
            <h1 className="text-sm font-semibold md:hidden">Admin</h1>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted"
                />
              }
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {initialsFromName(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {displayName}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[12rem]">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/dashboard" />}>
                <LayoutDashboard className="h-4 w-4" />
                App Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Users className="h-4 w-4" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b bg-background px-3 py-2 md:hidden">
          {adminNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-zinc-900 text-white'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
