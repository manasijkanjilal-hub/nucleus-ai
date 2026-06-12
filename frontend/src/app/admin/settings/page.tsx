'use client';

// =============================================================================
// /admin/settings — admin tools. Currently: broadcast a system announcement
// notification to every user.
// =============================================================================

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Megaphone, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function AdminSettingsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = title.trim().length > 0 && message.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), message: message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send announcement');
      toast.success(`Announcement sent to ${data.sent ?? 0} user${data.sent === 1 ? '' : 's'}`);
      setTitle('');
      setMessage('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send announcement');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Platform-wide administration tools</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4" />Send Announcement</CardTitle>
          <CardDescription>
            Broadcast an in-app notification to every user. Use for maintenance windows, new features, or important updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled maintenance this weekend"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-message">Message</Label>
            <Textarea
              id="ann-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the announcement details users will see…"
              rows={5}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{message.length}/2000 characters</p>
          </div>
          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
            {sending ? 'Sending…' : 'Send to all users'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
