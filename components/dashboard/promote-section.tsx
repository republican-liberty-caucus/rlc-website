'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Megaphone, Share2 } from 'lucide-react';
import { ShareKitModal } from '@/components/shared/share-kit-modal';
import type { ShareKit } from '@/types';

interface PromoteSectionProps {
  shareKits: ShareKit[];
}

export function PromoteSection({ shareKits }: PromoteSectionProps) {
  const [selectedKit, setSelectedKit] = useState<ShareKit | null>(null);

  if (shareKits.length === 0) {
    return null;
  }

  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="h-5 w-5 text-rlc-red" />
          <h2 className="font-heading text-lg font-semibold">Promote</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shareKits.map((kit) => (
            <Card key={kit.id} className="group transition-colors hover:border-rlc-red">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="inline-block rounded-full bg-rlc-red/10 px-2 py-0.5 text-xs font-medium text-rlc-red capitalize mb-1.5">
                      {kit.content_type}
                    </span>
                    <h3 className="text-sm font-semibold leading-tight line-clamp-2">
                      {kit.title}
                    </h3>
                    {kit.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {kit.description}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  className="mt-3 w-full bg-rlc-red hover:bg-rlc-red/90"
                  onClick={() => setSelectedKit(kit)}
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Share
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedKit && (
        <ShareKitModal
          kit={selectedKit}
          open={!!selectedKit}
          onOpenChange={(open) => !open && setSelectedKit(null)}
        />
      )}
    </>
  );
}
