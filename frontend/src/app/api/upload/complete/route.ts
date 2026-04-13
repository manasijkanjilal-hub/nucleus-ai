export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { cloudStoragePath, isPublic, fileName, fileType, brandId } = await request.json();
    const doc = await prisma.uploadedDocument.create({
      data: {
        fileName,
        fileType: fileType || 'unknown',
        cloudStoragePath,
        isPublic: isPublic ?? false,
        brandId: brandId || null,
        status: 'uploaded',
        userId: session.user.id,
      },
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    console.error('Upload complete error:', error);
    return NextResponse.json({ error: 'Failed to save upload record' }, { status: 500 });
  }
}
