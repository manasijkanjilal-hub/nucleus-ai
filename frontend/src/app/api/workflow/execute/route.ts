export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requirePermission } from '@/middleware/rbac';

export async function POST(request: Request) {
  const guard = await requirePermission('content:generate');
  if (!guard.authorized) return guard.response;
  try {
    const { prompt, brandId } = await request.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'LLM API key not configured' }, { status: 500 });

    const systemPrompt = `You are an expert marketing strategist and content creator for Nucleus AI, a marketing orchestration platform.
When given a campaign brief, you must:
1. First output a "## Task Plan" section that breaks the request into sub-tasks (e.g., Email Sequence, Ad Copy, Social Posts)
2. Then output a "## Generated Content" section with the full marketing content in well-formatted markdown
3. Include specific, actionable copy for each sub-task
4. Maintain a professional, engaging tone
5. Include subject lines, CTAs, and channel-specific formatting

Always structure your output clearly with markdown headers and bullet points.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Campaign Brief: ${prompt}${brandId ? `\nBrand ID: ${brandId}` : ''}` },
    ];

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages,
        stream: true,
        max_tokens: 4000,
      }),
    });

    if (!response?.ok) {
      const errText = await response?.text?.().catch(() => 'Unknown error');
      return NextResponse.json({ error: `LLM API error: ${errText}` }, { status: 502 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            const chunk = decoder.decode(value);
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Workflow execute error:', error);
    return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 });
  }
}
