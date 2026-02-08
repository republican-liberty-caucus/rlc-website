import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/admin/permissions';
import { CampaignForm } from '@/components/admin/campaign-form';

export const metadata: Metadata = {
  title: 'New Campaign - Admin',
  description: 'Create a new action campaign',
};

export default async function NewCampaignPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">New Action Campaign</h1>
      <CampaignForm />
    </div>
  );
}
