export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const brands = await prisma.brandProfile.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(brands);
  } catch (error: any) {
    console.error('Get brands error:', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const brand = await prisma.brandProfile.create({
      data: {
        name: body.name,
        industry: body.industry || null,
        targetAudience: body.targetAudience || null,
        brandVoice: body.brandVoice || null,
        description: body.description || null,
        userId: session.user.id,
      },
    });
    return NextResponse.json(brand, { status: 201 });
  } catch (error: any) {
    console.error('Create brand error:', error);
    return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 });
  }
}
