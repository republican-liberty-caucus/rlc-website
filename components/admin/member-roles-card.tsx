'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';
import { ADMIN_INPUT_CLASS } from '@/components/admin/form-styles';
import type { Charter, UserRole } from '@/types';
import { formatDate } from '@/lib/utils';

interface RoleRow {
  id: string;
  role: UserRole;
  charter_id: string | null;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  charter: { name: string } | null;
  granter: { first_name: string; last_name: string } | null;
}

interface MemberRolesCardProps {
  memberId: string;
  roles: RoleRow[];
  charters: Pick<Charter, 'id' | 'name'>[];
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'charter_officer', label: 'Charter Officer' },
  { value: 'charter_admin', label: 'Charter Admin' },
  { value: 'state_chair', label: 'State Chair' },
  { value: 'regional_coordinator', label: 'Regional Coordinator' },
  { value: 'national_board', label: 'National Board' },
  { value: 'super_admin', label: 'Super Admin' },
];

export function MemberRolesCard({ memberId, roles, charters }: MemberRolesCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAddRole(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      role: formData.get('role') as string,
      charterId: (formData.get('charterId') as string) || null,
    };

    try {
      const res = await fetch(`/api/v1/admin/members/${memberId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errorMessage = 'Failed to assign role';
        try {
          const err = await res.json();
          errorMessage = err.error || errorMessage;
        } catch {
          // Response was not JSON (e.g., 502 gateway error)
        }
        throw new Error(errorMessage);
      }

      toast({ title: 'Role assigned' });
      setShowForm(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign role',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveRole(roleId: string) {
    setRemovingId(roleId);

    try {
      const res = await fetch(`/api/v1/admin/members/${memberId}/roles?roleId=${roleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        let errorMessage = 'Failed to revoke role';
        try {
          const err = await res.json();
          errorMessage = err.error || errorMessage;
        } catch {
          // Response was not JSON (e.g., 502 gateway error)
        }
        throw new Error(errorMessage);
      }

      toast({ title: 'Role revoked' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke role',
        variant: 'destructive',
      });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Roles</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Add Role Form */}
      {showForm && (
        <form onSubmit={handleAddRole} className="mb-4 space-y-3 rounded border bg-muted/30 p-3">
          <div>
            <label className="block text-xs font-medium mb-1">Role</label>
            <select name="role" required className={ADMIN_INPUT_CLASS}>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Charter (optional for national roles)</label>
            <select name="charterId" className={ADMIN_INPUT_CLASS}>
              <option value="">None (National)</option>
              {charters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting} className="bg-rlc-red hover:bg-rlc-red/90">
              {submitting ? 'Assigning...' : 'Assign'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Roles List */}
      {roles.length > 0 ? (
        <ul className="space-y-3">
          {roles.map((r) => (
            <li key={r.id} className="flex items-start justify-between border-b pb-2 last:border-0 last:pb-0">
              <div>
                <span className="text-sm font-medium capitalize">{r.role.replace(/_/g, ' ')}</span>
                <p className="text-xs text-muted-foreground">
                  {r.charter?.name || 'National'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Granted {formatDate(r.granted_at)}
                  {r.granter && ` by ${r.granter.first_name} ${r.granter.last_name}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveRole(r.id)}
                disabled={removingId === r.id}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No roles assigned</p>
      )}
    </div>
  );
}
