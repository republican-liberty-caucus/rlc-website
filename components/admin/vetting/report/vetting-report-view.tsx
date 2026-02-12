'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { VettingReportSectionType, VettingRecommendation, BoardVoteChoice } from '@/types';

// Section data type mirrors ReportSectionWithAssignments but simplified for report
interface ReportSection {
  section: VettingReportSectionType;
  data: Record<string, unknown> | null;
  status: string;
}

interface OpponentData {
  name: string;
  party: string | null;
  is_incumbent: boolean;
  background: string | null;
  credibility: string | null;
  fundraising: Record<string, unknown> | null;
  endorsements: string[];
  social_links: Record<string, unknown> | null;
  photo_url: string | null;
}

interface VoteSummary {
  voter_name: string;
  vote: BoardVoteChoice;
  notes: string | null;
}

interface VettingReportData {
  id: string;
  candidate_name: string;
  candidate_state: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  candidate_party: string | null;
  office_type: { name: string; district_label: string | null } | null;
  stage: string;
  recommendation: VettingRecommendation | null;
  recommendation_notes: string | null;
  endorsement_result: VettingRecommendation | null;
  endorsed_at: string | null;
  interview_date: string | null;
  interview_notes: string | null;
  interviewers: string[] | null;
  created_at: string;
  election_deadline: {
    primary_date: string | null;
    general_date: string | null;
    state_code: string | null;
    cycle_year: number | null;
    office_type: string | null;
  } | null;
  committee: { name: string } | null;
  sections: ReportSection[];
  opponents: OpponentData[];
  votes: VoteSummary[];
}

interface VettingReportViewProps {
  data: VettingReportData;
}

// Human-readable section titles
const SECTION_TITLES: Record<VettingReportSectionType, string> = {
  executive_summary: 'Executive Summary',
  election_schedule: 'Election Schedule',
  voting_rules: 'Voting Rules',
  candidate_background: 'Candidate Background',
  incumbent_record: 'Incumbent Record',
  opponent_research: 'Opponent Research',
  electoral_results: 'Electoral Results',
  district_data: 'District Data',
  digital_presence_audit: 'Digital Presence Audit',
};

// Ordered display of sections (matches the Robert Onder brief format)
const SECTION_ORDER: VettingReportSectionType[] = [
  'executive_summary',
  'election_schedule',
  'voting_rules',
  'candidate_background',
  'incumbent_record',
  'opponent_research',
  'electoral_results',
  'district_data',
  'digital_presence_audit',
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRecommendation(rec: VettingRecommendation): string {
  return rec.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatVote(vote: BoardVoteChoice): string {
  return vote.replace(/^vote_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const RECOMMENDATION_STYLES: Record<VettingRecommendation, string> = {
  endorse: 'bg-green-100 text-green-800 border-green-300',
  do_not_endorse: 'bg-red-100 text-red-800 border-red-300',
  no_position: 'bg-gray-100 text-gray-800 border-gray-300',
};

/**
 * Renders a section's JSON data as formatted content.
 * Since section data is freeform JSON, we render known keys nicely
 * and fall back to key-value display for everything else.
 */
function SectionContent({ data }: { section?: VettingReportSectionType; data: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-muted-foreground italic">No data entered for this section.</p>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        if (typeof value === 'string') {
          return (
            <div key={key}>
              <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap">{value}</dd>
            </div>
          );
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
          return (
            <div key={key}>
              <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm">{String(value)}</dd>
            </div>
          );
        }

        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1">
                <ul className="list-disc list-inside text-sm space-y-1">
                  {value.map((item, i) => (
                    <li key={i}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
                  ))}
                </ul>
              </dd>
            </div>
          );
        }

        if (typeof value === 'object' && value !== null) {
          return (
            <div key={key}>
              <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1">
                <dl className="ml-4 space-y-1">
                  {Object.entries(value as Record<string, unknown>).map(([subKey, subVal]) => (
                    <div key={subKey} className="flex gap-2 text-sm">
                      <dt className="text-muted-foreground min-w-[120px]">
                        {subKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}:
                      </dt>
                      <dd>{typeof subVal === 'string' ? subVal : JSON.stringify(subVal)}</dd>
                    </div>
                  ))}
                </dl>
              </dd>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function OpponentCard({ opponent }: { opponent: OpponentData }) {
  return (
    <div className="rounded-lg border bg-card p-4 print:break-inside-avoid">
      <div className="flex items-start gap-4">
        {opponent.photo_url && isValidImageUrl(opponent.photo_url) && (
          <Image
            src={opponent.photo_url}
            alt={opponent.name}
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-full object-cover border"
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{opponent.name}</h4>
            {opponent.party && (
              <Badge variant="outline" className="text-xs">{opponent.party}</Badge>
            )}
            {opponent.is_incumbent && (
              <Badge className="bg-blue-100 text-blue-700 border-transparent text-xs">Incumbent</Badge>
            )}
          </div>

          {opponent.background && (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{opponent.background}</p>
          )}

          {opponent.credibility && (
            <div className="mt-2">
              <span className="text-xs font-medium text-muted-foreground">Credibility:</span>
              <p className="text-sm whitespace-pre-wrap">{opponent.credibility}</p>
            </div>
          )}

          {opponent.endorsements.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-muted-foreground">Endorsements:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {opponent.endorsements.map((e, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{e}</Badge>
                ))}
              </div>
            </div>
          )}

          {opponent.social_links && Object.keys(opponent.social_links).length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-muted-foreground">Social Links:</span>
              <div className="flex flex-wrap gap-2 mt-1 text-xs">
                {Object.entries(opponent.social_links).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={String(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {platform}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function VettingReportView({ data }: VettingReportViewProps) {
  const orderedSections = SECTION_ORDER
    .map((key) => data.sections.find((s) => s.section === key))
    .filter((s): s is ReportSection => !!s);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Print/Export Controls (hidden in print) */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href={`/admin/vetting/${data.id}`}>
          <Button variant="outline" size="sm">
            &larr; Back to Vetting Detail
          </Button>
        </Link>
        <Button
          onClick={() => window.print()}
          className="bg-rlc-red hover:bg-rlc-red/90"
          size="sm"
        >
          Export PDF
        </Button>
      </div>

      {/* Report Header */}
      <div className="text-center mb-8 print:mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-[2px] w-12 bg-rlc-red" />
          <span className="text-xs font-semibold uppercase tracking-widest text-rlc-red">
            Republican Liberty Caucus
          </span>
          <div className="h-[2px] w-12 bg-rlc-red" />
        </div>
        <h1 className="text-2xl font-bold mt-2">Candidate Vetting Report</h1>
        <p className="text-muted-foreground mt-1">
          {data.candidate_name}
          {data.candidate_party && ` (${data.candidate_party})`}
        </p>
        <p className="text-sm text-muted-foreground">
          {[
            data.office_type?.name ?? data.candidate_office,
            data.candidate_district
              ? `${data.office_type?.district_label ?? 'District'} ${data.candidate_district}`
              : null,
            data.candidate_state,
          ]
            .filter(Boolean)
            .join(' \u2014 ')}
        </p>
        {data.committee && (
          <p className="text-xs text-muted-foreground mt-1">
            Committee: {data.committee.name}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Report generated {formatDate(new Date().toISOString())}
        </p>
      </div>

      {/* Election Dates */}
      {data.election_deadline && (
        <div className="flex gap-4 justify-center mb-8 text-sm print:mb-6">
          {data.election_deadline.primary_date && (
            <div className="text-center">
              <span className="text-xs font-medium text-muted-foreground block">Primary</span>
              <span className="font-semibold">{formatDate(data.election_deadline.primary_date)}</span>
            </div>
          )}
          {data.election_deadline.general_date && (
            <div className="text-center">
              <span className="text-xs font-medium text-muted-foreground block">General</span>
              <span className="font-semibold">{formatDate(data.election_deadline.general_date)}</span>
            </div>
          )}
          {data.election_deadline.cycle_year && (
            <div className="text-center">
              <span className="text-xs font-medium text-muted-foreground block">Cycle</span>
              <span className="font-semibold">{data.election_deadline.cycle_year}</span>
            </div>
          )}
        </div>
      )}

      {/* Endorsement Result (if finalized) */}
      {data.endorsement_result && (
        <div className={cn(
          'rounded-lg border-2 p-4 text-center mb-8 print:mb-6 print:break-inside-avoid',
          RECOMMENDATION_STYLES[data.endorsement_result]
        )}>
          <p className="text-xs font-medium uppercase tracking-wider mb-1">Board Decision</p>
          <p className="text-lg font-bold">{formatRecommendation(data.endorsement_result)}</p>
          {data.endorsed_at && (
            <p className="text-xs mt-1">Finalized {formatDate(data.endorsed_at)}</p>
          )}
        </div>
      )}

      {/* Committee Recommendation (if not yet finalized) */}
      {data.recommendation && !data.endorsement_result && (
        <div className={cn(
          'rounded-lg border p-4 text-center mb-8 print:mb-6 print:break-inside-avoid',
          RECOMMENDATION_STYLES[data.recommendation]
        )}>
          <p className="text-xs font-medium uppercase tracking-wider mb-1">Committee Recommendation</p>
          <p className="text-lg font-bold">{formatRecommendation(data.recommendation)}</p>
          {data.recommendation_notes && (
            <p className="text-sm mt-2 text-muted-foreground">{data.recommendation_notes}</p>
          )}
        </div>
      )}

      {/* Report Sections */}
      <div className="space-y-8 print:space-y-6">
        {orderedSections.map((section, index) => {
          // Special handling for opponent_research — show opponent cards
          if (section.section === 'opponent_research' && data.opponents.length > 0) {
            return (
              <div key={section.section} className="print:break-inside-avoid">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-bold text-rlc-red">{index + 1}.</span>
                  <h2 className="text-lg font-bold">{SECTION_TITLES[section.section]}</h2>
                </div>

                {/* Section data first (if any) */}
                {section.data && Object.keys(section.data).length > 0 && (
                  <div className="mb-4">
                    <SectionContent section={section.section} data={section.data} />
                  </div>
                )}

                {/* Opponent cards */}
                <div className="space-y-4">
                  {data.opponents.map((opponent) => (
                    <OpponentCard key={opponent.name} opponent={opponent} />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={section.section} className="print:break-inside-avoid">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-bold text-rlc-red">{index + 1}.</span>
                <h2 className="text-lg font-bold">{SECTION_TITLES[section.section]}</h2>
                {section.status !== 'section_completed' && (
                  <Badge variant="outline" className="text-xs text-amber-600 print:hidden">
                    {section.status.replace(/section_|_/g, ' ').trim()}
                  </Badge>
                )}
              </div>
              <SectionContent section={section.section} data={section.data} />
            </div>
          );
        })}

        {orderedSections.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No report sections initialized</p>
            <p className="text-sm mt-1">Sections are created when the vetting begins.</p>
          </div>
        )}
      </div>

      {/* Interview Notes */}
      {data.interview_date && (
        <div className="mt-8 print:mt-6 print:break-inside-avoid">
          <h2 className="text-lg font-bold mb-4">Interview</h2>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm">
              <span className="font-medium">Date:</span> {formatDate(data.interview_date)}
            </p>
            {data.interviewers && data.interviewers.length > 0 && (
              <p className="text-sm mt-1">
                <span className="font-medium">Interviewers:</span> {data.interviewers.join(', ')}
              </p>
            )}
            {data.interview_notes && (
              <div className="mt-3">
                <span className="text-sm font-medium">Notes:</span>
                <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground">
                  {data.interview_notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Board Vote Summary — only shown after endorsement is finalized */}
      {data.votes.length > 0 && data.endorsement_result && (
        <div className="mt-8 print:mt-6 print:break-inside-avoid">
          <h2 className="text-lg font-bold mb-4">Board Vote</h2>
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left text-sm font-medium">Board Member</th>
                  <th className="px-4 py-2 text-left text-sm font-medium">Vote</th>
                  <th className="px-4 py-2 text-left text-sm font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.votes.map((vote, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2 text-sm">{vote.voter_name}</td>
                    <td className="px-4 py-2 text-sm">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs border-transparent',
                          vote.vote === 'vote_endorse' && 'bg-green-100 text-green-700',
                          vote.vote === 'vote_do_not_endorse' && 'bg-red-100 text-red-700',
                          vote.vote === 'vote_no_position' && 'bg-gray-100 text-gray-700',
                          vote.vote === 'vote_abstain' && 'bg-amber-100 text-amber-700'
                        )}
                      >
                        {formatVote(vote.vote)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {vote.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground print:mt-8">
        <p>Republican Liberty Caucus &mdash; Candidate Vetting Report</p>
        <p className="mt-1">CONFIDENTIAL &mdash; For Internal Use Only</p>
      </div>
    </div>
  );
}
