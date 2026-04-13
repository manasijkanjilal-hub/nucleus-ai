'use client';
import { useSession } from 'next-auth/react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, User, Globe } from 'lucide-react';

export default function SettingsPage() {
  const { data: session } = useSession() || {};
  return (
    <>
      <DashboardHeader title="Settings" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Manage your account and platform preferences</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-4 w-4" />Account Information</CardTitle>
            <CardDescription>Your personal account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={session?.user?.name ?? ''} disabled className="max-w-md" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={session?.user?.email ?? ''} disabled className="max-w-md" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4" />API Configuration</CardTitle>
            <CardDescription>Backend integration settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Backend API URL</Label>
              <Input value={process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'} disabled className="max-w-md" />
              <p className="text-xs text-muted-foreground">The FastAPI backend powering the AI agents and attribution engine</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
