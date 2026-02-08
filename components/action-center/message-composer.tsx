'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Mail } from 'lucide-react';

interface Props {
  template: string;
  recipientName: string;
  recipientEmail?: string;
  officeName: string;
}

export function MessageComposer({ template, recipientName, recipientEmail, officeName }: Props) {
  const [copied, setCopied] = useState(false);

  const message = template
    .replace(/\{representative\}/g, recipientName)
    .replace(/\{office\}/g, officeName);

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const subject = `Constituent Message - Liberty Issues`;
  const mailtoUrl = recipientEmail
    ? `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium">Message to {recipientName}</h4>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={copyMessage}>
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
          {mailtoUrl && (
            <a href={mailtoUrl}>
              <Button variant="outline" size="sm">
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
            </a>
          )}
        </div>
      </div>
      <textarea
        value={message}
        readOnly
        rows={6}
        className="w-full rounded-md border bg-muted/30 p-3 text-sm"
      />
    </div>
  );
}
