// =============================================================================
// Nucleus AI — Admin Users API (collection)
// =============================================================================
// GET  /api/admin/users  — paginated list with search + role/status filters
// POST /api/admin/users  — create a new user
// =============================================================================

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import { canManageUserRole, type Role } from '@/lib/permissions';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'] as const;

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerified: true,
  lastLogin: true,
  createdAt: true,
  _count: { select: { brandProfiles: true, campaigns: true } },
} satisfies Prisma.UserSelect;

// ----------------------------------------------------------------------------
// GET — list users
// ----------------------------------------------------------------------------
export async function GET(req: Request) {
  const guard = await requirePermission('user:read');
  if (!guard.authorized) return guard.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20)
  );
  const search = searchParams.get('search')?.trim() ?? '';
  const roleFilter = searchParams.get('role') ?? '';
  const statusFilter = searchParams.get('status') ?? '';

  const where: Prisma.UserWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (ROLES.includes(roleFilter as Role)) {
    where.role = roleFilter as Role;
  }
  if ((STATUSES as readonly string[]).includes(statusFilter)) {
    where.status = statusFilter as (typeof STATUSES)[number];
  }

  try {
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error('[admin/users GET] error', err);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

// ----------------------------------------------------------------------------
// POST — create user
// ----------------------------------------------------------------------------
const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
});

export async function POST(req: Request) {
  const guard = await requirePermission('user:create');
  if (!guard.authorized) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { name, email, password, role, status } = parsed.data;

  // Enforce role-management rules
  if (!canManageUserRole(guard.user.role, role)) {
    return NextResponse.json(
      { error: `You cannot assign the ${role} role.` },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'A user with this email already exists.' },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        status: status ?? 'ACTIVE',
        emailVerified: (status ?? 'ACTIVE') === 'ACTIVE',
      },
      select: userSelect,
    });

    await recordAudit({
      userId: guard.user.id,
      action: 'user.create',
      entity: 'User',
      entityId: user.id,
      changes: { email, role, status: status ?? 'ACTIVE' },
      request: req,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error('[admin/users POST] error', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
