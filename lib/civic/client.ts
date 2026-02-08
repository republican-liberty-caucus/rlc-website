export interface CivicOfficial {
  name: string;
  party: string;
  phones: string[];
  emails: string[];
  photoUrl: string | null;
  urls: string[];
  channels: Array<{ type: string; id: string }>;
  office: string;
}

export interface CivicRepresentatives {
  officials: CivicOfficial[];
  normalizedAddress: string | null;
}

export async function getRepresentatives(address: string): Promise<CivicRepresentatives> {
  const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_CIVIC_API_KEY is not configured');
  }

  const url = new URL('https://www.googleapis.com/civicinfo/v2/representatives');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('address', address);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Civic API error: ${res.status} - ${text}`);
  }

  const data = await res.json();

  const officials: CivicOfficial[] = [];

  if (data.officials && data.offices) {
    for (const office of data.offices) {
      const indices = office.officialIndices || [];
      for (const idx of indices) {
        const official = data.officials[idx];
        if (official) {
          officials.push({
            name: official.name || '',
            party: official.party || 'Unknown',
            phones: official.phones || [],
            emails: official.emails || [],
            photoUrl: official.photoUrl || null,
            urls: official.urls || [],
            channels: official.channels || [],
            office: office.name || '',
          });
        }
      }
    }
  }

  const normalizedAddress = data.normalizedInput
    ? `${data.normalizedInput.line1 || ''}, ${data.normalizedInput.city || ''}, ${data.normalizedInput.state || ''} ${data.normalizedInput.zip || ''}`.trim()
    : null;

  return { officials, normalizedAddress };
}
