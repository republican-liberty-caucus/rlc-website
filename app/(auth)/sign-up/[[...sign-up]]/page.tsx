import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 py-12">
      <SignUp
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
