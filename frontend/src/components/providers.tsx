'use client';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { CommandPalette } from '@/components/command-palette';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <CommandPalette />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          className: 'nucleus-toast',
          style: {
            borderRadius: '12px',
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
            boxShadow: '0 10px 30px -10px rgba(99,102,241,0.35)',
            padding: '12px 16px',
            fontSize: '0.875rem',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
    </SessionProvider>
  );
}
