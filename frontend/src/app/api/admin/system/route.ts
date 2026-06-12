// =============================================================================
// Nucleus AI — Admin System Settings API
// =============================================================================
// GET   /api/admin/system  — read the singleton settings row (creates default)
// PATCH /api/admin/system  — update platform name, support email, maintenance
//                            mode, and feature flags.
// ADMIN+ only. All changes are audited.
// =============================================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/rbac';
import { recordAudit } from '@/lib/audit';
import { firstZodError } from '@/lib/validations/auth';
import { sanitizeText } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

const SINGLETON_ID = 'singleton';

// Default feature flags — used to backfill when reading.
const DEFAULT_FLAGS: Record<string, boolean> = {
  enableRegistration: true,
  enableAIGeneration: true,
  enableBilling: true,
};

const patchSchema = z.object({
  platformName: z.string().min(1).max(120).optional(),
  supportEmail: z.string().email().max(200).optional(),
  maintenanceMode: z.boolean().optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
});

/** Read the singleton row, creating it with defaults if missing. */
async function readSettings() {
  return prisma.systemSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, featureFlags: DEFAULT_FLAGS },
    update: {},
  });
}

function serialize(row: Awaited<ReturnType<typeof readSettings>>) {
  const flags = {
    ...DEFAULT_FLAGS,
    ...((row.featureFlags as Record<string, boolean> | null) ?? {}),
  };
  return {
    platformName: row.platformName,
    supportEmail: row.supportEmail,
    maintenanceMode: row.maintenanceMode,
    featureFlags: flags,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export async function GET() {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;

  try {
    const row = await readSettings();
    return NextResponse.json(serialize(row));
  } catch (err) {
    console.error('[admin/system] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load system settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const guard = await requirePermission('admin:access');
  if (!guard.authorized) return guard.response;
  const { user } = guard;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstZodError(parsed.error) },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Merge feature flags onto existing ones so partial updates are safe.
    let mergedFlags: Record<string, boolean> | undefined;
    if (data.featureFlags) {
      const current = await readSettings();
      mergedFlags = {
        ...DEFAULT_FLAGS,
        ...((current.featureFlags as Record<string, boolean> | null) ?? {}),
        ...data.featureFlags,
      };
    }

    const updateData: Record<string, unknown> = { updatedBy: user.id };
    if (data.platformName !== undefined)
      updateData.platformName = sanitizeText(data.platformName);
    if (data.supportEmail !== undefined)
      updateData.supportEmail = data.supportEmail.trim().toLowerCase();
    if (data.maintenanceMode !== undefined)
      updateData.maintenanceMode = data.maintenanceMode;
    if (mergedFlags !== undefined) updateData.featureFlags = mergedFlags;

    const row = await prisma.systemSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        featureFlags: mergedFlags ?? DEFAULT_FLAGS,
        ...('platformName' in updateData
          ? { platformName: updateData.platformName as string }
          : {}),
        ...('supportEmail' in updateData
          ? { supportEmail: updateData.supportEmail as string }
          : {}),
        ...('maintenanceMode' in updateData
          ? { maintenanceMode: updateData.maintenanceMode as boolean }
          : {}),
        updatedBy: user.id,
      },
      update: updateData,
    });

    await recordAudit({
      userId: user.id,
      action: 'system.settings.update',
      entity: 'SystemSettings',
      entityId: SINGLETON_ID,
      changes: data as Record<string, unknown>,
      request,
    });

    return NextResponse.json(serialize(row));
  } catch (err) {
    console.error('[admin/system] PATCH error', err);
    return NextResponse.json(
      { error: 'Failed to update system settings' },
      { status: 500 }
    );
  }
}
