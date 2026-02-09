export type OfficialCategory =
  | 'federal_legislature'
  | 'federal_executive'
  | 'state_legislature'
  | 'state_executive'
  | 'local';

export interface CivicOfficial {
  name: string;
  party: string;
  phones: string[];
  emails: string[];
  photoUrl: string | null;
  urls: string[];
  channels: Array<{ type: string; id: string }>;
  office: string;
  category: OfficialCategory;
}

export interface CivicRepresentatives {
  officials: CivicOfficial[];
  normalizedAddress: string | null;
}

// Cicero API response types (partial — only fields we use)
interface CiceroAddress {
  phone_1?: string;
  phone_2?: string;
}

interface CiceroOfficial {
  first_name: string;
  last_name: string;
  middle_initial?: string;
  party?: string;
  addresses?: CiceroAddress[];
  email_addresses?: string[];
  photo_origin_url?: string;
  urls?: string[];
  office?: {
    title?: string;
    name?: string;
    chamber?: { name?: string };
    district?: { district_type?: string; subtype?: string };
  };
}

function categorize(districtType?: string): OfficialCategory {
  switch (districtType) {
    case 'NATIONAL_UPPER':
    case 'NATIONAL_LOWER':
      return 'federal_legislature';
    case 'NATIONAL_EXEC':
      return 'federal_executive';
    case 'STATE_UPPER':
    case 'STATE_LOWER':
      return 'state_legislature';
    case 'STATE_EXEC':
      return 'state_executive';
    default:
      return 'local';
  }
}

export async function getRepresentatives(address: string): Promise<CivicRepresentatives> {
  const apiKey = process.env.CICERO_API_KEY;
  if (!apiKey) {
    throw new Error('CICERO_API_KEY is not configured');
  }

  const url = new URL('https://app.cicerodata.com/v3.1/official');
  url.searchParams.set('search_loc', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('max', '50');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cicero API error: ${res.status} - ${text}`);
  }

  const data = await res.json();

  if (data?.response?.errors?.length > 0) {
    throw new Error(`Cicero API: ${data.response.errors.join(', ')}`);
  }

  // Cicero wraps results in a candidates array
  const candidates = data?.response?.results?.candidates || [];
  const ciceroOfficials: CiceroOfficial[] = candidates[0]?.officials || [];

  const officials: CivicOfficial[] = ciceroOfficials.map((o) => {
    const phones: string[] = [];
    if (o.addresses) {
      for (const addr of o.addresses) {
        if (addr.phone_1) phones.push(addr.phone_1);
        if (addr.phone_2 && !phones.includes(addr.phone_2)) phones.push(addr.phone_2);
      }
    }

    const emails = (o.email_addresses || []).filter(Boolean);
    const urls = (o.urls || []).filter(Boolean);

    const nameParts = [o.first_name, o.middle_initial, o.last_name].filter(Boolean);
    const officeTitle = o.office?.title || o.office?.name || '';
    const districtType = o.office?.district?.district_type;
    const category = categorize(districtType);

    return {
      name: nameParts.join(' '),
      party: o.party || 'Unknown',
      phones,
      emails,
      photoUrl: o.photo_origin_url || null,
      urls,
      channels: [],
      office: officeTitle,
      category,
    };
  });

  const normalizedAddress = address;

  return { officials, normalizedAddress };
}
