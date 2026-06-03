'use client';

// =============================================================================
// Nucleus AI — Admin: User Management
// =============================================================================
// Data table with search + role/status filters, pagination (20/page), and CRUD
// via dialogs (create, invite, edit, change role, suspend/activate, delete).
// =============================================================================

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Search,
  UserPlus,
  Plus,
  MoreHorizontal,
  Pencil,
  ShieldBan,
  ShieldCheck,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';
import type { Role } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  emailVerified: boolean;
  lastLogin: string | null;
  createdAt: string;
  _count: { brandProfiles: number; campaigns: number };
}

const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'];

const roleBadgeVariant: Record<Role, 'default' | 'secondary' | 'outline'> = {
  SUPER_ADMIN: 'default',
  ADMIN: 'secondary',
  EDITOR: 'outline',
  VIEWER: 'outline',
};

const statusBadge: Record<
  AdminUser['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  ACTIVE: { label: 'Active', variant: 'default' },
  SUSPENDED: { label: 'Suspended', variant: 'destructive' },
  PENDING_VERIFICATION: { label: 'Pending', variant: 'secondary' },
};

const selectClass =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

// ---------------------------------------------------------------------------
// Create / Invite form schemas
// ---------------------------------------------------------------------------
const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER']),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

const inviteUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER']),
});
type InviteUserForm = z.infer<typeof inviteUserSchema>;

function UsersPageInner() {
  const { assignableRoles, can } = usePermissions();
  const myAssignable = assignableRoles();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  // Open create/invite from query string (?action=create|invite)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') setCreateOpen(true);
    if (action === 'invite') setInviteOpen(true);
  }, [searchParams]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users);
      setTotalPages(data.pagination.totalPages || 1);
      setTotal(data.pagination.total || 0);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- Actions -------------------------------------------------------------
  const doSuspend = async (u: AdminUser) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/suspend`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success(`${u.email} suspended`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to suspend');
    } finally {
      setBusy(false);
    }
  };

  const doActivate = async (u: AdminUser) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/activate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success(`${u.email} activated`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to activate');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteUser) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success(`${deleteUser.email} deleted`);
      setDeleteUser(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  const canManage = (u: AdminUser) => myAssignable.includes(u.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'user' : 'users'} total
          </p>
        </div>
        <div className="flex gap-2">
          {can('user:create') && (
            <>
              <Button variant="outline" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create User
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              className="pl-9"
              value={search}
              onChange={(e: any) => setSearch(e.target?.value ?? '')}
            />
          </div>
          <select
            className={`${selectClass} sm:w-44`}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className={`${selectClass} sm:w-44`}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="PENDING_VERIFICATION">Pending</option>
          </select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Brands</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{u.name ?? '—'}</span>
                        <span className="text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[u.role]}>{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[u.status].variant}>
                        {statusBadge[u.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u._count.brandProfiles}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLogin
                        ? new Date(u.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {canManage(u) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                              />
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {can('user:update') && (
                              <DropdownMenuItem onClick={() => setEditUser(u)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {can('user:update') &&
                              (u.status === 'SUSPENDED' ? (
                                <DropdownMenuItem onClick={() => doActivate(u)}>
                                  <ShieldCheck className="h-4 w-4" />
                                  Activate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => doSuspend(u)}>
                                  <ShieldBan className="h-4 w-4" />
                                  Suspend
                                </DropdownMenuItem>
                              ))}
                            {can('user:delete') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteUser(u)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        assignable={myAssignable}
        onSuccess={fetchUsers}
      />

      {/* Invite dialog */}
      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        assignable={myAssignable}
        onSuccess={fetchUsers}
      />

      {/* Edit dialog */}
      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        assignable={myAssignable}
        onSuccess={fetchUsers}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(o: boolean) => !o && setDeleteUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteUser?.email}</strong> and
              all their associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => doDelete()}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===========================================================================
// Create User Dialog
// ===========================================================================
function CreateUserDialog({
  open,
  onOpenChange,
  assignable,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignable: Role[];
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: assignable[assignable.length - 1] ?? 'VIEWER' },
  });

  const onSubmit = async (values: CreateUserForm) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success('User created');
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create user');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Add a new user with an initial password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" {...register('email')} />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-password">Password</Label>
            <Input id="c-password" type="password" {...register('password')} />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-role">Role</Label>
            <select id="c-role" className={selectClass} {...register('role')}>
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Invite User Dialog
// ===========================================================================
function InviteUserDialog({
  open,
  onOpenChange,
  assignable,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignable: Role[];
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteUserForm>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { role: assignable[assignable.length - 1] ?? 'VIEWER' },
  });

  const onSubmit = async (values: InviteUserForm) => {
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      if (data.devInviteToken) {
        toast.success('Invite created (dev: see console for link)');
        // eslint-disable-next-line no-console
        console.log(
          `Invite link: ${window.location.origin}/reset-password?token=${data.devInviteToken}&invite=1`
        );
      } else {
        toast.success('Invitation sent');
      }
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to invite user');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an email invitation. The user sets their own password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="i-name">Name</Label>
            <Input id="i-name" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-email">Email</Label>
            <Input id="i-email" type="email" {...register('email')} />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-role">Role</Label>
            <select id="i-role" className={selectClass} {...register('role')}>
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Edit User Dialog
// ===========================================================================
function EditUserDialog({
  user,
  onClose,
  assignable,
  onSuccess,
}: {
  user: AdminUser | null;
  onClose: () => void;
  assignable: Role[];
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('VIEWER');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setRole(user.role);
      setPassword('');
    }
  }, [user]);

  // Roles that may be assigned: the union of assignable + current role.
  const roleOptions = Array.from(new Set([...assignable, role]));

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name, role };
      if (password) payload.password = password;
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success('User updated');
      onClose();
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Name</Label>
            <Input
              id="e-name"
              value={name}
              onChange={(e: any) => setName(e.target?.value ?? '')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-role">Role</Label>
            <select
              id="e-role"
              className={selectClass}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-password">
              New Password{' '}
              <span className="text-muted-foreground">(leave blank to keep)</span>
            </Label>
            <Input
              id="e-password"
              type="password"
              value={password}
              onChange={(e: any) => setPassword(e.target?.value ?? '')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersPageInner />
    </Suspense>
  );
}
