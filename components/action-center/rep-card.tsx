'use client';

import Image from 'next/image';
import { Phone, Mail, Globe } from 'lucide-react';

interface Official {
  name: string;
  party: string;
  phones: string[];
  emails: string[];
  photoUrl: string | null;
  urls: string[];
  office: string;
}

export function RepCard({ official }: { official: Official }) {
  const partyColor = official.party === 'Republican'
    ? 'text-red-600'
    : official.party === 'Democratic'
    ? 'text-blue-600'
    : 'text-gray-600';

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start gap-4">
        {official.photoUrl ? (
          <Image
            src={official.photoUrl}
            alt={official.name}
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
            {official.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">{official.name}</h3>
          <p className="text-sm text-muted-foreground">{official.office}</p>
          <p className={`text-xs font-medium ${partyColor}`}>{official.party}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {official.phones.length > 0 && (
          <a
            href={`tel:${official.phones[0]}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Phone className="h-4 w-4" />
            {official.phones[0]}
          </a>
        )}
        {official.emails.length > 0 && (
          <a
            href={`mailto:${official.emails[0]}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-4 w-4" />
            {official.emails[0]}
          </a>
        )}
        {official.urls.length > 0 && (
          <a
            href={official.urls[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Globe className="h-4 w-4" />
            Website
          </a>
        )}
      </div>
    </div>
  );
}
