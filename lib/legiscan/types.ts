// LegiScan API response types
// Docs: https://legiscan.com/legiscan

export interface LegiScanSession {
  session_id: number;
  state_id: number;
  year_start: number;
  year_end: number;
  session_name: string;
  session_title: string;
  special: number;
}

export interface LegiScanBillSummary {
  bill_id: number;
  number: string;
  change_hash: string;
  url: string;
  status_date: string;
  status: number;
  last_action_date: string;
  last_action: string;
  title: string;
  description: string;
}

export interface LegiScanBillDetail {
  bill_id: number;
  change_hash: string;
  session_id: number;
  session: {
    session_id: number;
    session_name: string;
    session_title: string;
    year_start: number;
    year_end: number;
    special: number;
  };
  url: string;
  state_link: string;
  completed: number;
  status: number;
  status_date: string;
  progress: Array<{
    date: string;
    event: number;
  }>;
  state: string;
  state_id: number;
  bill_number: string;
  bill_type: string;
  bill_type_id: string;
  body: string;
  body_id: number;
  current_body: string;
  current_body_id: number;
  title: string;
  description: string;
  committee: Record<string, unknown>;
  pending_committee_id: number;
  history: Array<{
    date: string;
    action: string;
    chamber: string;
    chamber_id: number;
    importance: number;
  }>;
  sponsors: Array<{
    people_id: number;
    person_hash: string;
    party_id: string;
    party: string;
    role_id: number;
    role: string;
    name: string;
    first_name: string;
    middle_name: string;
    last_name: string;
    suffix: string;
    district: string;
    committee_sponsor: number;
    committee_id: number;
  }>;
  votes: Array<{
    roll_call_id: number;
    date: string;
    desc: string;
    yea: number;
    nay: number;
    nv: number;
    absent: number;
    total: number;
    passed: number;
    chamber: string;
    chamber_id: number;
    url: string;
    state_link: string;
  }>;
  texts: Array<{
    doc_id: number;
    date: string;
    type: string;
    type_id: number;
    mime: string;
    mime_id: number;
    url: string;
    state_link: string;
    text_size: number;
  }>;
  amendments: unknown[];
  supplements: unknown[];
  calendar: unknown[];
  subjects: Array<{
    subject_id: number;
    subject_name: string;
  }>;
}

export interface LegiScanRollCall {
  roll_call_id: number;
  bill_id: number;
  date: string;
  desc: string;
  yea: number;
  nay: number;
  nv: number;
  absent: number;
  total: number;
  passed: number;
  chamber: string;
  chamber_id: number;
  votes: Array<LegiScanVoteRecord>;
}

export interface LegiScanVoteRecord {
  people_id: number;
  vote_id: number;
  vote_text: 'Yea' | 'Nay' | 'NV' | 'Absent';
}

export interface LegiScanPerson {
  people_id: number;
  person_hash: string;
  state_id: number;
  party_id: string;
  party: string;
  role_id: number;
  role: string;
  name: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  district: string;
  committee_sponsor: number;
  committee_id: number;
}

export interface LegiScanSearchResult {
  summary: {
    page: number;
    range: string;
    relevance: number;
    count: number;
    page_current: number;
    page_total: number;
  };
  results: Array<{
    relevance: number;
    state: string;
    bill_number: string;
    bill_id: number;
    change_hash: string;
    url: string;
    text_url: string;
    research_url: string;
    last_action_date: string;
    last_action: string;
    title: string;
  }>;
}

export class LegiScanError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'LegiScanError';
  }
}
