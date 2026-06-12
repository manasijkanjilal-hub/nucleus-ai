'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface PlanLimits {
  generations: number;
  brands: number;
  documents: number;
  campaigns: number;
}

interface PlanDTO {
  id: string;
  name: string;
  price: number | null;
  limits: PlanLimits;
  features: string[];
  purchasable: boolean;
  stripePriceId: string | null;
  isCurrent: boolean;
}

const RANK: Record<string, number> = { FREE: 0, STARTER: 1, PRO: 2, ENTERPRISE: 3 };

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>('FREE');
  const [loading, setLoading] = useState(true);
  const [actionPlan, setActionPlan] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/billing/plans');
        if (res.ok) {
          const data = await res.json();
          setPlans(data.plans ?? []);
          setCurrentPlan(data.currentPlan ?? 'FREE');
        }
      } catch {
        toast.error('Failed to load plans');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function selectPlan(plan: PlanDTO) {
    if (plan.id === 'ENTERPRISE') {
      window.location.href = 'mailto:sales@nucleus-ai.com?subject=Enterprise%20Plan%20Inquiry';
      return;
    }
    if (!plan.stripePriceId) {
      toast.error('This plan is not available for self-service checkout.');
      return;
    }
    setActionPlan(plan.id);
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: plan.stripePriceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to start subscription');
        return;
      }
      if (data.mode === 'checkout' && data.url) {
        window.location.href = data.url;
      } else if (data.mode === 'update') {
        toast.success(data.message || 'Plan updated');
        router.push('/billing');
      }
    } catch {
      toast.error('Failed to start subscription');
    } finally {
      setActionPlan(null);
    }
  }

  function ctaLabel(plan: PlanDTO): string {
    if (plan.isCurrent) return 'Current Plan';
    if (plan.id === 'ENTERPRISE') return 'Contact Sales';
    if (RANK[plan.id] < RANK[currentPlan]) return `Downgrade to ${plan.name}`;
    return `Upgrade to ${plan.name}`;
  }

  return (
    <div className="space-y-6">
      <DashboardHeader title="Plans & Pricing" />

      {loading ? (
        <div className="py-20 text-center text-zinc-400">Loading plans…</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
          {plans.map((plan) => {
            const popular = plan.id === 'PRO';
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${popular ? 'border-indigo-500 shadow-lg ring-1 ring-indigo-500' : ''}`}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.isCurrent && (
                      <Badge className="bg-emerald-50 text-emerald-700">Current</Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    {plan.price === null ? (
                      <span className="text-2xl font-bold text-zinc-900">Custom</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-zinc-900">${plan.price}</span>
                        <span className="text-sm text-zinc-500">/month</span>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <ul className="mb-6 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-zinc-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.isCurrent ? 'outline' : popular ? 'default' : 'outline'}
                    disabled={plan.isCurrent || actionPlan === plan.id}
                    onClick={() => selectPlan(plan)}
                  >
                    {actionPlan === plan.id ? (
                      'Processing…'
                    ) : (
                      <>
                        {!plan.isCurrent && plan.id !== 'ENTERPRISE' && (
                          <Sparkles className="mr-1.5 h-4 w-4" />
                        )}
                        {ctaLabel(plan)}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
