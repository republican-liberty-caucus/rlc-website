import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getMemberByClerkId, createServerClient } from '@/lib/supabase/server';
import { getTierConfig } from '@/lib/stripe/client';
import { Button } from '@/components/ui/button';
import type { MembershipTier } from '@/types';
import { Users, ArrowLeft } from 'lucide-react';
import { HouseholdManager } from './household-manager';

export const metadata: Metadata = {
  title: 'Household Members',
  description: 'Manage your household membership',
};

export default async function HouseholdPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const member = await getMemberByClerkId(userId);
  if (!member) {
    redirect('/dashboard');
  }

  const tierConfig = getTierConfig(member.membership_tier as MembershipTier);
  const canManageHousehold = tierConfig?.includesSpouse || tierConfig?.includesFamily;

  // If tier doesn't support household, show upgrade prompt
  if (!canManageHousehold) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-bold">Household Membership</h1>
          <p className="mb-6 text-muted-foreground">
            Household members are available with Premium membership ($75/year) and above.
            Premium includes one spouse, and Sustaining ($150/year) includes your whole family.
          </p>
          <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
            <Link href="/membership">Upgrade Your Membership</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Determine if this is a dependent member (spouse/child)
  const isDependent = member.household_role === 'spouse' || member.household_role === 'child';

  if (isDependent) {
    // Fetch the primary member info
    const supabase = createServerClient();
    const { data: primaryData, error: primaryError } = member.primary_member_id
      ? await supabase
          .from('rlc_members')
          .select('first_name, last_name, email')
          .eq('id', member.primary_member_id)
          .single()
      : { data: null, error: null };
    if (primaryError) {
      console.error('Error fetching primary member:', primaryError);
    }
    const primaryMember = primaryData as { first_name: string; last_name: string; email: string } | null;

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8">
          <div className="mb-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-rlc-red" />
            <div>
              <h1 className="text-2xl font-bold">Household Membership</h1>
              <p className="text-sm text-muted-foreground">
                You are a {member.household_role} member
              </p>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <p className="text-sm font-medium">Primary Member</p>
            {primaryMember ? (
              <p className="text-sm text-muted-foreground">
                {primaryMember.first_name} {primaryMember.last_name} ({primaryMember.email})
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Information not available</p>
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Your membership tier and status are managed by the primary household member.
            You can update your own profile information from the{' '}
            <Link href="/profile" className="text-rlc-red hover:underline">
              Profile
            </Link>{' '}
            page.
          </p>
        </div>
      </div>
    );
  }

  // Primary member or standalone — show household management
  // Fetch existing household members server-side for initial render
  const supabase = createServerClient();
  let householdMembers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    household_role: string | null;
    membership_status: string;
    created_at: string;
  }> = [];

  if (member.household_id) {
    const { data, error: fetchError } = await supabase
      .from('rlc_members')
      .select('id, first_name, last_name, email, household_role, membership_status, created_at')
      .eq('household_id', member.household_id)
      .neq('id', member.id)
      .order('household_role')
      .order('created_at');

    if (fetchError) {
      console.error('Error fetching household members:', fetchError);
    }
    householdMembers = data || [];
  }

  const existingSpouseCount = householdMembers.filter(m => m.household_role === 'spouse').length;
  const canAddSpouse = existingSpouseCount < 1;
  const canAddChild = tierConfig?.includesFamily || false;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Household Members</h1>
        <p className="mt-2 text-muted-foreground">
          {tierConfig?.includesFamily
            ? 'Your membership includes your spouse and children.'
            : 'Your membership includes one spouse.'}
        </p>
      </div>

      <HouseholdManager
        initialMembers={householdMembers}
        canAddSpouse={canAddSpouse}
        canAddChild={canAddChild}
        tierName={tierConfig?.name || member.membership_tier}
      />
    </div>
  );
}
