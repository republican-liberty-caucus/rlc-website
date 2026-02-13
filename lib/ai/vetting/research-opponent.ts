import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { OpponentResearchInput, OpponentResearchOutput } from './types';

const SYSTEM_PROMPT = `You are a political research analyst for the Republican Liberty Caucus (RLC). Your role is to compile structured research profiles on political opponents/candidates in races where the RLC is evaluating an endorsement.

For each opponent, research and provide:
1. Background — biographical summary, career history, relevant experience
2. Experience — political offices held, campaigns run, government roles
3. Fundraising — estimated total raised, major funding sources
4. Strengths — what makes this candidate competitive
5. Weaknesses — vulnerabilities, controversies, or liabilities
6. Key Issues — the opponent's top policy positions
7. Endorsements — notable endorsements received

Respond ONLY in valid JSON format:
{
  "background": "string",
  "experience": "string",
  "fundraising": { "estimatedTotal": "string", "sources": ["string"] },
  "strengths": ["string"],
  "weaknesses": ["string"],
  "keyIssues": ["string"],
  "endorsements": ["string"]
}

Be factual and concise. If information is unavailable, note it as "Not publicly available" rather than fabricating details.`;

export async function researchOpponent(input: OpponentResearchInput): Promise<OpponentResearchOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const parts = [
    `Opponent Name: ${input.opponentName}`,
    input.party && `Party: ${input.party}`,
    input.state && `State: ${input.state}`,
    input.office && `Office Sought: ${input.office}`,
    input.district && `District: ${input.district}`,
  ].filter(Boolean);

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    system: SYSTEM_PROMPT,
    prompt: `Research this political opponent:\n\n${parts.join('\n')}`,
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

  const fundraising = result.fundraising as Record<string, unknown> | undefined;

  return {
    background: String(result.background || ''),
    experience: String(result.experience || ''),
    fundraising: {
      estimatedTotal: String(fundraising?.estimatedTotal || 'Unknown'),
      sources: Array.isArray(fundraising?.sources)
        ? (fundraising.sources as unknown[]).map(String)
        : [],
    },
    strengths: Array.isArray(result.strengths) ? result.strengths.map(String) : [],
    weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses.map(String) : [],
    keyIssues: Array.isArray(result.keyIssues) ? result.keyIssues.map(String) : [],
    endorsements: Array.isArray(result.endorsements) ? result.endorsements.map(String) : [],
  };
}
