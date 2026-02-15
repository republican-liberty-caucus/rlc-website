import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { formatCandidateName } from '@/lib/utils';
import type { CandidateBackgroundInput, CandidateBackgroundOutput } from './types';

const SYSTEM_PROMPT = `You are a political research analyst for the Republican Liberty Caucus (RLC). Your role is to compile structured background profiles on candidates seeking RLC endorsement.

For each candidate, research and provide:
1. Employment — current and past professional roles
2. Education — degrees, institutions, relevant certifications
3. Political Experience — offices held, campaigns run, party roles
4. Community Involvement — civic organizations, volunteer work, board memberships
5. Key Positions — the candidate's stated policy positions on major issues
6. Notable Achievements — significant accomplishments in public service, business, or community

If survey answers are provided, incorporate relevant information from them.

Respond ONLY in valid JSON format:
{
  "employment": "string",
  "education": "string",
  "politicalExperience": "string",
  "communityInvolvement": "string",
  "keyPositions": ["string"],
  "notableAchievements": ["string"]
}

Be factual and concise. Where information is unavailable from public sources, note "Not publicly available" rather than fabricating details.`;

export async function draftCandidateBackground(input: CandidateBackgroundInput): Promise<CandidateBackgroundOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const parts = [
    `Candidate Name: ${formatCandidateName(input.candidateFirstName, input.candidateLastName)}`,
    input.office && `Office Sought: ${input.office}`,
    input.state && `State: ${input.state}`,
    input.district && `District: ${input.district}`,
    input.party && `Party: ${input.party}`,
  ].filter(Boolean);

  if (input.surveyAnswers && input.surveyAnswers.length > 0) {
    parts.push('\nSurvey Responses:');
    for (const qa of input.surveyAnswers) {
      parts.push(`Q: ${qa.question}\nA: ${qa.answer}`);
    }
  }

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    system: SYSTEM_PROMPT,
    prompt: `Research and compile a background profile for this candidate:\n\n${parts.join('\n')}`,
    maxOutputTokens: 1500,
    temperature: 0.3,
  });

  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON. Response: ${cleaned.slice(0, 200)}`);
  }

  return {
    employment: String(result.employment || ''),
    education: String(result.education || ''),
    politicalExperience: String(result.politicalExperience || ''),
    communityInvolvement: String(result.communityInvolvement || ''),
    keyPositions: Array.isArray(result.keyPositions) ? result.keyPositions.map(String) : [],
    notableAchievements: Array.isArray(result.notableAchievements) ? result.notableAchievements.map(String) : [],
  };
}
