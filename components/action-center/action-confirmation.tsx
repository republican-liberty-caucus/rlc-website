'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareButtons } from '@/components/shared/share-buttons';

interface ActionConfirmationProps {
  campaignTitle: string;
  campaignSlug: string;
  nextCampaign?: {
    title: string;
    slug: string;
  } | null;
  onClose: () => void;
}

export function ActionConfirmation({
  campaignTitle,
  campaignSlug,
  nextCampaign,
  onClose,
}: ActionConfirmationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/action-center/contact?campaign=${campaignSlug}`
    : '';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md rounded-lg border bg-card p-8 shadow-xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2, duration: 0.6 }}
              >
                <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
              </motion.div>

              <motion.h2
                className="mt-4 font-heading text-2xl font-bold"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                You Made Your Voice Heard!
              </motion.h2>

              <motion.p
                className="mt-2 text-muted-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Thank you for taking action on <strong>{campaignTitle}</strong>.
                Your participation makes a difference.
              </motion.p>

              <motion.div
                className="mt-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <p className="mb-3 text-sm font-medium">Spread the word:</p>
                <div className="flex justify-center">
                  <ShareButtons
                    url={shareUrl}
                    title={`I just took action on "${campaignTitle}" with the Republican Liberty Caucus!`}
                    text={`I just contacted my reps about "${campaignTitle}" via @rlcnational. You can too!`}
                  />
                </div>
              </motion.div>

              {nextCampaign && (
                <motion.div
                  className="mt-6 rounded-md border bg-muted/50 p-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <p className="text-sm text-muted-foreground">Keep the momentum going:</p>
                  <Button asChild className="mt-2 w-full bg-rlc-red text-white hover:bg-rlc-red/90">
                    <Link href={`/action-center/contact?campaign=${nextCampaign.slug}`}>
                      {nextCampaign.title}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </motion.div>
              )}

              <Button
                variant="ghost"
                className="mt-4"
                onClick={onClose}
              >
                Back to Action Center
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
