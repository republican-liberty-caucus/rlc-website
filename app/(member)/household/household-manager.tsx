'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Trash2, AlertCircle } from 'lucide-react';

interface HouseholdMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  household_role: string | null;
  membership_status: string;
  created_at: string;
}

interface HouseholdManagerProps {
  initialMembers: HouseholdMember[];
  canAddSpouse: boolean;
  canAddChild: boolean;
  tierName: string;
}

export function HouseholdManager({
  initialMembers,
  canAddSpouse,
  canAddChild,
  tierName,
}: HouseholdManagerProps) {
  const [members, setMembers] = useState<HouseholdMember[]>(initialMembers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addRole, setAddRole] = useState<'spouse' | 'child'>('spouse');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const currentSpouseCount = members.filter(m => m.household_role === 'spouse').length;
  const canStillAddSpouse = canAddSpouse && currentSpouseCount < 1;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/me/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          role: addRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add household member');
      }

      const { data } = await res.json();

      setMembers(prev => [...prev, {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        household_role: data.household_role,
        membership_status: data.membership_status,
        created_at: data.created_at,
      }]);

      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(memberId: string) {
    const memberToRemove = members.find(m => m.id === memberId);
    if (!memberToRemove) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${memberToRemove.first_name} ${memberToRemove.last_name} from your household? Their membership will be cancelled.`
    );
    if (!confirmed) return;

    setRemovingId(memberId);
    setError(null);

    try {
      const res = await fetch(`/api/v1/me/household/${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove household member');
      }

      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setRemovingId(null);
    }
  }

  function openAddForm(role: 'spouse' | 'child') {
    setAddRole(role);
    setShowAddForm(true);
    setError(null);
    setFirstName('');
    setLastName('');
    setEmail('');
  }

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Current household members */}
      {members.length > 0 ? (
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Current Household Members</h2>
          </div>
          <div className="divide-y">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rlc-red/10">
                    <Users className="h-5 w-5 text-rlc-red" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.first_name} {member.last_name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{member.email}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                        {member.household_role}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleRemove(member.id)}
                  disabled={removingId === member.id}
                  aria-label={`Remove ${member.first_name} ${member.last_name} from household`}
                >
                  {removingId === member.id ? (
                    <span className="text-xs">Removing...</span>
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No household members yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your {canAddChild ? 'spouse and family members' : 'spouse'} to share your {tierName} membership.
          </p>
        </div>
      )}

      {/* Add member buttons */}
      {!showAddForm && (
        <div className="flex flex-wrap gap-3">
          {canStillAddSpouse && (
            <Button
              onClick={() => openAddForm('spouse')}
              className="bg-rlc-red hover:bg-rlc-red/90"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Spouse
            </Button>
          )}
          {canAddChild && (
            <Button
              onClick={() => openAddForm('child')}
              variant="outline"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Child
            </Button>
          )}
        </div>
      )}

      {/* Add member form */}
      {showAddForm && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Add {addRole === 'spouse' ? 'Spouse' : 'Child'}
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="mb-1 block text-sm font-medium">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="First name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-1 block text-sm font-medium">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Last name"
                />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="email@example.com"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                They can use this email to create their own account and access the member portal.
              </p>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="bg-rlc-red hover:bg-rlc-red/90">
                {loading ? 'Adding...' : `Add ${addRole === 'spouse' ? 'Spouse' : 'Child'}`}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddForm(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Info note */}
      <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How household memberships work</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Household members inherit your membership tier and status</li>
          <li>When your membership renews or expires, household members follow</li>
          <li>Each household member can create their own account using their email</li>
          <li>Household members can update their own profile but cannot change membership settings</li>
        </ul>
      </div>
    </div>
  );
}
