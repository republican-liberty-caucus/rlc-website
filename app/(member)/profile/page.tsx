import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/forms/profile-form';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Manage your RLC member profile',
};

export default async function ProfilePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const member = await getMemberByClerkId(userId);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your personal information and preferences.
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <ProfileForm member={member} />
      </div>
    </div>
  );
}
