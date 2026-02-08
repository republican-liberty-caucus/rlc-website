'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export function EmbedCodeGenerator({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const embedCode = `<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/scorecards/embed/${slug}" width="100%" height="600" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`;

  async function copyCode() {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="mb-3 text-sm text-muted-foreground">
        Embed this scorecard on any website by copying the code below.
      </p>
      <div className="relative">
        <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">{embedCode}</pre>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyCode}
          className="absolute right-2 top-2"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
