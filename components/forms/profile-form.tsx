'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';

interface Member {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
}

interface ProfileFormProps {
  member: Member | null;
}

export function ProfileForm({ member }: ProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: member?.first_name || '',
    lastName: member?.last_name || '',
    phone: member?.phone || '',
    addressLine1: member?.address_line1 || '',
    addressLine2: member?.address_line2 || '',
    city: member?.city || '',
    state: member?.state || '',
    postalCode: member?.postal_code || '',
    emailOptIn: member?.email_opt_in ?? true,
    smsOptIn: member?.sms_opt_in ?? false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });

      router.refresh();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Personal Information */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Personal Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-1 block text-sm font-medium">
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
              required
            />
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1 block text-sm font-medium">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={member?.email || ''}
              className="w-full rounded-md border bg-muted px-3 py-2 text-muted-foreground"
              disabled
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Email is managed through your account settings.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="(555) 555-5555"
              className="w-full rounded-md border bg-background px-3 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Address</h2>
        <div className="grid gap-4">
          <div>
            <label htmlFor="addressLine1" className="mb-1 block text-sm font-medium">
              Address Line 1
            </label>
            <input
              type="text"
              id="addressLine1"
              name="addressLine1"
              value={formData.addressLine1}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
            />
          </div>
          <div>
            <label htmlFor="addressLine2" className="mb-1 block text-sm font-medium">
              Address Line 2
            </label>
            <input
              type="text"
              id="addressLine2"
              name="addressLine2"
              value={formData.addressLine2}
              onChange={handleChange}
              placeholder="Apt, suite, unit, etc."
              className="w-full rounded-md border bg-background px-3 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="city" className="mb-1 block text-sm font-medium">
                City
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
              />
            </div>
            <div>
              <label htmlFor="state" className="mb-1 block text-sm font-medium">
                State
              </label>
              <select
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
              >
                <option value="">Select state</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="postalCode" className="mb-1 block text-sm font-medium">
                ZIP Code
              </label>
              <input
                type="text"
                id="postalCode"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                maxLength={10}
                className="w-full rounded-md border bg-background px-3 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Communication Preferences */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Communication Preferences</h2>
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="emailOptIn"
              checked={formData.emailOptIn}
              onChange={handleChange}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-rlc-red focus:ring-rlc-red"
            />
            <div>
              <span className="font-medium">Email Communications</span>
              <p className="text-sm text-muted-foreground">
                Receive newsletters, event announcements, and important updates.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="smsOptIn"
              checked={formData.smsOptIn}
              onChange={handleChange}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-rlc-red focus:ring-rlc-red"
            />
            <div>
              <span className="font-medium">SMS/Text Messages</span>
              <p className="text-sm text-muted-foreground">
                Receive text alerts for urgent news and event reminders.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-rlc-red hover:bg-rlc-red/90"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
