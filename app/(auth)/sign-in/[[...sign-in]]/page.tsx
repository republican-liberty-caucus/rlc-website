import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 py-12">
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary: 'bg-rlc-red hover:bg-rlc-red/90',
            card: 'shadow-lg',
          },
        }}
      />
    </div>
  );
}
