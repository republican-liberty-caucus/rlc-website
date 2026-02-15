'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { ShareKit, SocialCopyVariant } from '@/types';

interface ShareKitModalProps {
  kit: ShareKit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tone = 'formal' | 'casual' | 'punchy';
type Platform = 'x' | 'facebook' | 'linkedin';

const TONE_LABELS: Record<Tone, string> = {
  formal: 'Formal',
  casual: 'Casual',
  punchy: 'Punchy',
};

const PLATFORM_LABELS: Record<Platform, string> = {
  x: 'X / Twitter',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

export function ShareKitModal({ kit, open, onOpenChange }: ShareKitModalProps) {
  const { toast } = useToast();
  const [tone, setTone] = useState<Tone>('casual');
  const [trackedUrl, setTrackedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<Platform>('x');

  const ensureTrackedUrl = useCallback(async (): Promise<string | null> => {
    if (trackedUrl) return trackedUrl;

    setLoading(true);
    try {
      const res = await fetch('/api/v1/member/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareKitId: kit.id }),
      });

      if (!res.ok) {
        console.error('Failed to create tracked link:', res.status);
        return null;
      }
      const data = await res.json();
      const url = data.shareLink?.url as string;
      setTrackedUrl(url);
      return url;
    } catch (err) {
      console.error('Failed to create tracked share link:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [kit.id, trackedUrl]);

  async function recordShare(platform: string) {
    try {
      await fetch('/api/v1/member/share-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareKitId: kit.id, platform }),
      });
    } catch (err) {
      console.error('Failed to record share event:', err);
    }
  }

  function getCopyForPlatform(platform: Platform): string {
    const variants = kit.social_copy?.[platform] as SocialCopyVariant | undefined;
    return variants?.[tone] || kit.title;
  }

  async function handleShare(platform: 'x' | 'facebook' | 'linkedin' | 'email') {
    const url = await ensureTrackedUrl();
    if (!url) {
      toast({
        title: 'Unable to share',
        description: 'Could not create a tracked link. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    recordShare(platform);

    // LinkedIn doesn't support pre-filling text via URL — copy it to clipboard
    if (platform === 'linkedin') {
      try {
        await navigator.clipboard.writeText(getCopyForPlatform('linkedin'));
        toast({
          title: 'Post text copied!',
          description: 'Paste it into your LinkedIn post.',
        });
      } catch {
        // Silent fail — the share window will still open
      }
    }

    const shareUrls: Record<string, string> = {
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(getCopyForPlatform('x'))}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(getCopyForPlatform('facebook'))}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(kit.title)}&body=${encodeURIComponent(getCopyForPlatform('facebook'))}%0A%0A${encodeURIComponent(url)}`,
    };

    window.open(shareUrls[platform], platform === 'email' ? '_self' : '_blank');
  }

  async function handleCopyLink() {
    const url = await ensureTrackedUrl();
    if (!url) {
      toast({
        title: 'Unable to share',
        description: 'Could not create a tracked link. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    let success = false;
    try {
      await navigator.clipboard.writeText(url);
      success = true;
    } catch {
      // Fallback for older browsers
      try {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        success = document.execCommand('copy');
        document.body.removeChild(input);
      } catch (fallbackErr) {
        console.error('Failed to copy to clipboard:', fallbackErr);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      recordShare('copy');
    } else {
      toast({
        title: 'Could not copy automatically',
        description: url,
      });
    }
  }

  const previewText = getCopyForPlatform(previewPlatform);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Share: {kit.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tone picker */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Tone</p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    tone === t
                      ? 'bg-rlc-red text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {TONE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <div className="flex gap-1">
                {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPreviewPlatform(p)}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      previewPlatform === p
                        ? 'bg-foreground/10 text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {PLATFORM_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm">{previewText}</p>
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShare('x')}
              disabled={loading}
              className="justify-start"
            >
              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Post on X
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShare('facebook')}
              disabled={loading}
              className="justify-start"
            >
              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShare('linkedin')}
              disabled={loading}
              className="justify-start"
            >
              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShare('email')}
              disabled={loading}
              className="justify-start"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Email
            </Button>
          </div>

          {/* Copy link */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCopyLink}
            disabled={loading}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4 text-green-600" />
                Link Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Tracked Link
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
