'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import {
  LayoutDashboard, Database, Sparkles, Megaphone, BarChart3,
  Building2, Settings, LogOut, Zap, ShieldCheck,
} from 'lucide-react';

const navItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Context Vault', href: '/context-vault', icon: Database },
  { title: 'AI Campaign Generator', href: '/campaign-generator', icon: Sparkles },
  { title: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { title: 'Analytics', href: '/analytics', icon: BarChart3 },
  { title: 'Brand Profile', href: '/brand-profile', icon: Building2 },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname() ?? '';
  const { isAtLeast } = usePermissions();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">Nucleus AI</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems?.map?.((item: any) => (
                <SidebarMenuItem key={item?.href ?? ''}>
                  <SidebarMenuButton render={<Link href={item?.href ?? '#'} />} isActive={pathname === item?.href || pathname?.startsWith?.(`${item?.href}/`)}>
                    {item?.icon && <item.icon className="h-4 w-4" />}
                    <span>{item?.title ?? ''}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )) ?? []}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAtLeast('ADMIN') && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/admin/dashboard" />}
                    isActive={pathname?.startsWith?.('/admin')}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Admin Panel</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => signOut?.({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
