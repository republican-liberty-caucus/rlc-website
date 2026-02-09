'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, UserMinus, Shield, User } from 'lucide-react';

interface CommitteeMember {
  id: string;
  committee_id: string;
  contact_id: string;
  role: string;
  is_active: boolean;
  joined_at: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface Committee {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface CommitteeManagerProps {
  committees: Committee[];
  members: CommitteeMember[];
  canManage: boolean;
}

export function CommitteeManager({ committees, members, canManage }: CommitteeManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const activeCommittee = committees.find((c) => c.is_active) ?? committees[0];
  const committeeMembers = activeCommittee
    ? members.filter((m) => m.committee_id === activeCommittee.id)
    : [];

  async function handleToggleActive(memberId: string, currentlyActive: boolean) {
    setLoading(memberId);
    try {
      const res = await fetch(`/api/v1/admin/vetting/committee/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentlyActive }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleChangeRole(memberId: string, newRole: string) {
    setLoading(memberId);
    try {
      const res = await fetch(`/api/v1/admin/vetting/committee/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this member from the committee?')) return;
    setLoading(memberId);
    try {
      const res = await fetch(`/api/v1/admin/vetting/committee/members/${memberId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  if (!activeCommittee) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <p className="mb-4">No vetting committee exists yet.</p>
        {canManage && (
          <Button
            className="bg-rlc-red hover:bg-rlc-red/90"
            onClick={async () => {
              const name = prompt('Committee name:');
              if (!name) return;
              const res = await fetch('/api/v1/admin/vetting/committee', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
              });
              if (res.ok) router.refresh();
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Committee
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{activeCommittee.name}</h2>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const contactId = prompt('Enter member Contact ID (UUID):');
              if (!contactId) return;
              const res = await fetch('/api/v1/admin/vetting/committee/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  committeeId: activeCommittee.id,
                  contactId,
                  role: 'committee_member',
                }),
              });
              if (res.ok) {
                router.refresh();
              } else {
                const err = await res.json();
                alert(err.error || 'Failed to add member');
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Joined</th>
                {canManage && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {committeeMembers.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">
                    {m.contact
                      ? `${m.contact.first_name} ${m.contact.last_name}`
                      : m.contact_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {m.contact?.email || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-transparent',
                        m.role === 'chair'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                      )}
                    >
                      {m.role === 'chair' ? (
                        <><Shield className="mr-1 h-3 w-3" />Chair</>
                      ) : (
                        <><User className="mr-1 h-3 w-3" />Member</>
                      )}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-transparent',
                        m.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                      )}
                    >
                      {m.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loading === m.id}
                          onClick={() =>
                            handleChangeRole(
                              m.id,
                              m.role === 'chair' ? 'committee_member' : 'chair'
                            )
                          }
                        >
                          {m.role === 'chair' ? 'Demote' : 'Promote'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loading === m.id}
                          onClick={() => handleToggleActive(m.id, m.is_active)}
                        >
                          {m.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          disabled={loading === m.id}
                          onClick={() => handleRemove(m.id)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {committeeMembers.length === 0 && (
                <tr>
                  <td
                    colSpan={canManage ? 6 : 5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No committee members yet. Add members to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
