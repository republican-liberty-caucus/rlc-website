'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import type { Contact, Charter, MembershipTier, MembershipStatus } from '@/types';

interface MemberDetailFormProps {
  member: Contact;
  charters: Pick<Charter, 'id' | 'name'>[];
  isNational: boolean;
}

const TIER_OPTIONS: { value: MembershipTier; label: string }[] = [
  { value: 'student_military', label: 'Student/Military' },
  { value: 'individual', label: 'Individual' },
  { value: 'premium', label: 'Premium' },
  { value: 'sustaining', label: 'Sustaining' },
  { value: 'patron', label: 'Patron' },
  { value: 'benefactor', label: 'Benefactor' },
  { value: 'roundtable', label: 'Roundtable' },
];

const STATUS_OPTIONS: { value: MembershipStatus; label: string }[] = [
  { value: 'new_member', label: 'New' },
  { value: 'current', label: 'Current' },
  { value: 'grace', label: 'Grace' },
  { value: 'expired', label: 'Expired' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'expiring', label: 'Expiring' },
];

export function MemberDetailForm({ member, charters, isNational }: MemberDetailFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);

    const body: Record<string, unknown> = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || null,
      addressLine1: (formData.get('addressLine1') as string) || null,
      addressLine2: (formData.get('addressLine2') as string) || null,
      city: (formData.get('city') as string) || null,
      state: (formData.get('state') as string) || null,
      postalCode: (formData.get('postalCode') as string) || null,
      emailOptIn: formData.get('emailOptIn') === 'on',
      smsOptIn: formData.get('smsOptIn') === 'on',
      doNotPhone: formData.get('doNotPhone') === 'on',
    };

    // Only national admins can modify restricted fields
    if (isNational) {
      body.membershipTier = formData.get('membershipTier') as string;
      body.membershipStatus = formData.get('membershipStatus') as string;
      body.primaryCharterId = (formData.get('primaryCharterId') as string) || null;
      body.membershipExpiryDate = (formData.get('membershipExpiryDate') as string) || null;
    }

    try {
      const res = await fetch(`/api/v1/admin/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errorMessage = 'Failed to update member';
        try {
          const err = await res.json();
          errorMessage = err.error || errorMessage;
        } catch {
          // Response was not JSON (e.g., 502 gateway error)
        }
        throw new Error(errorMessage);
      }

      toast({
        title: 'Member updated',
        description: `${body.firstName as string} ${body.lastName as string} has been updated.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update member',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Profile Section */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL_CLASS}>First Name</label>
            <input name="firstName" defaultValue={member.first_name} required className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Last Name</label>
            <input name="lastName" defaultValue={member.last_name} required className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Email</label>
            <input name="email" type="email" defaultValue={member.email} required className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Phone</label>
            <input name="phone" defaultValue={member.phone || ''} className={ADMIN_INPUT_CLASS} />
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Address</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Address Line 1</label>
            <input name="addressLine1" defaultValue={member.address_line1 || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Address Line 2</label>
            <input name="addressLine2" defaultValue={member.address_line2 || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>City</label>
            <input name="city" defaultValue={member.city || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>State</label>
            <input name="state" defaultValue={member.state || ''} maxLength={2} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Postal Code</label>
            <input name="postalCode" defaultValue={member.postal_code || ''} className={ADMIN_INPUT_CLASS} />
          </div>
        </div>
      </div>

      {/* Membership Section */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Membership</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL_CLASS}>Tier</label>
            <select name="membershipTier" defaultValue={member.membership_tier} disabled={!isNational} className={`${ADMIN_INPUT_CLASS} ${!isNational ? 'opacity-60' : ''}`}>
              {TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Status</label>
            <select name="membershipStatus" defaultValue={member.membership_status} disabled={!isNational} className={`${ADMIN_INPUT_CLASS} ${!isNational ? 'opacity-60' : ''}`}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Charter</label>
            <select name="primaryCharterId" defaultValue={member.primary_charter_id || ''} disabled={!isNational} className={`${ADMIN_INPUT_CLASS} ${!isNational ? 'opacity-60' : ''}`}>
              <option value="">No Charter</option>
              {charters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Expiry Date</label>
            <input
              name="membershipExpiryDate"
              type="date"
              defaultValue={member.membership_expiry_date?.split('T')[0] || ''}
              disabled={!isNational}
              className={`${ADMIN_INPUT_CLASS} ${!isNational ? 'opacity-60' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Preferences</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="emailOptIn" defaultChecked={member.email_opt_in} className="rounded" />
            <span className="text-sm">Email opt-in</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="smsOptIn" defaultChecked={member.sms_opt_in} className="rounded" />
            <span className="text-sm">SMS opt-in</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="doNotPhone" defaultChecked={member.do_not_phone} className="rounded" />
            <span className="text-sm">Do not phone</span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-rlc-red hover:bg-rlc-red/90">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
