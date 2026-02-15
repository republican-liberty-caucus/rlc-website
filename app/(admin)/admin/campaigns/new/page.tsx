import { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { CampaignForm } from '@/components/admin/campaign-form';

export const metadata: Metadata = {
  title: 'New Campaign - Admin',
  description: 'Create a new action campaign',
};

export default async function NewCampaignPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">New Action Campaign</h1>
      <CampaignForm />
    </div>
  );
}
