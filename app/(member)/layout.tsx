import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { MemberNav } from '@/components/navigation/member-nav';
import { Footer } from '@/components/layout/footer';

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MemberNav />
      <main className="flex-1 bg-muted/30">{children}</main>
      <Footer />
    </div>
  );
}
