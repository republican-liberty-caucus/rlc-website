'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The admin panel encountered an error. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-rlc-red px-4 py-2 text-sm text-white hover:bg-rlc-red/90"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
