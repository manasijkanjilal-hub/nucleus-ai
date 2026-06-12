'use client';
import { useSession } from 'next-auth/react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { User } from 'lucide-react';
import { NotificationCenter } from '@/components/NotificationCenter';

export function DashboardHeader({ title }: { title?: string }) {
  const { data: session } = useSession() || {};
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      {title && <h1 className="text-sm font-medium">{title}</h1>}
      <div className="ml-auto flex items-center gap-2">
        <NotificationCenter />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">{session?.user?.name || session?.user?.email || ''}</span>
      </div>
    </header>
  );
}
