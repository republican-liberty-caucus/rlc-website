import type {
  LegiScanBillDetail,
  LegiScanRollCall,
  LegiScanPerson,
  LegiScanSearchResult,
  LegiScanSession,
} from './types';
import { LegiScanError } from './types';

const BASE_URL = 'https://api.legiscan.com/';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 15000;

function getApiKey(): string {
  const key = process.env.LEGISCAN_API_KEY;
  if (!key) throw new LegiScanError('LEGISCAN_API_KEY is not configured');
  return key;
}

async function legiscanFetch<T>(op: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(BASE_URL);
  url.searchParams.set('key', getApiKey());
  url.searchParams.set('op', op);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

      if (res.status === 429 || res.status >= 500) {
        lastError = new LegiScanError(`LegiScan API ${res.status}`, res.status);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        throw new LegiScanError(`LegiScan API error: ${res.status} ${res.statusText}`, res.status);
      }

      const json = await res.json();

      if (json.status === 'ERROR') {
        throw new LegiScanError(json.alert?.message || 'Unknown LegiScan error', undefined, json.alert?.code);
      }

      return json as T;
    } catch (err) {
      if (err instanceof LegiScanError) throw err;
      lastError = err as Error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new LegiScanError('LegiScan request failed after retries');
}

/** Search bills by keyword, state, and/or session year */
export async function searchBills(
  query: string,
  options: { state?: string; year?: number; page?: number } = {}
): Promise<LegiScanSearchResult> {
  const params: Record<string, string | number> = { query };
  if (options.state) params.state = options.state;
  if (options.year) params.year = options.year;
  if (options.page) params.page = options.page;

  const res = await legiscanFetch<{ status: string; searchresult: LegiScanSearchResult }>('getSearch', params);
  return res.searchresult;
}

/** Get detailed bill information */
export async function getBillDetail(billId: number): Promise<LegiScanBillDetail> {
  const res = await legiscanFetch<{ status: string; bill: LegiScanBillDetail }>('getBill', { id: billId });
  return res.bill;
}

/** Get roll call vote details */
export async function getRollCall(rollCallId: number): Promise<LegiScanRollCall> {
  const res = await legiscanFetch<{ status: string; roll_call: LegiScanRollCall }>('getRollCall', { id: rollCallId });
  return res.roll_call;
}

/** Get list of legislators for a session */
export async function getPeopleList(sessionId: number): Promise<LegiScanPerson[]> {
  const res = await legiscanFetch<{ status: string; sessionpeople: { people: LegiScanPerson[] } }>('getSessionPeople', { id: sessionId });
  return res.sessionpeople.people;
}

/** Get available sessions for a state */
export async function getSessionList(state: string): Promise<LegiScanSession[]> {
  const res = await legiscanFetch<{ status: string; sessions: LegiScanSession[] }>('getSessionList', { state });
  return res.sessions;
}
