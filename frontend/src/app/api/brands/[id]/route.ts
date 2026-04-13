export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const brand = await prisma.brandProfile.update({
      where: { id, userId: session.user.id },
      data: {
        name: body.name,
        industry: body.industry || null,
        targetAudience: body.targetAudience || null,
        brandVoice: body.brandVoice || null,
        description: body.description || null,
      },
    });
    return NextResponse.json(brand);
  } catch (error: any) {
    console.error('Update brand error:', error);
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await prisma.brandProfile.delete({ where: { id, userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete brand error:', error);
    return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 });
  }
}
