import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { VotingRulesResearchInput, VotingRulesResearchOutput } from './types';

const SYSTEM_PROMPT = `You are an election law researcher for the Republican Liberty Caucus (RLC). Your role is to compile structured voting rules and regulations for US states.

For each state, research and provide:
1. Voter Eligibility — who can vote (age, citizenship, residency requirements)
2. Registration Rules — registration deadline, online availability, same-day registration
3. Absentee Rules — no-excuse absentee voting, early voting days, mail ballot deadlines
4. Primary Type — open, closed, semi-closed, top-two, etc.
5. Runoff Rules — when runoffs are triggered, runoff election rules
6. Key Dates — upcoming election dates, registration deadlines, early voting periods

Respond ONLY in valid JSON format:
{
  "voterEligibility": "string",
  "registrationRules": { "deadline": "string", "onlineAvailable": boolean, "sameDay": boolean },
  "absenteeRules": { "noExcuseRequired": boolean, "earlyVotingDays": number|null, "mailBallotDeadline": "string" },
  "primaryType": "string",
  "runoffRules": "string",
  "keyDates": [{ "event": "string", "date": "string" }]
}

Be precise and factual. Reference current state law. If a specific detail is uncertain, note "Verify with state election office" rather than guessing.`;

export async function researchVotingRules(input: VotingRulesResearchInput): Promise<VotingRulesResearchOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    system: SYSTEM_PROMPT,
    prompt: `Research the voting rules and election regulations for the state of ${input.stateCode}.`,
    maxOutputTokens: 1000,
    temperature: 0.1,
  });

  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON. Response: ${cleaned.slice(0, 200)}`);
  }

  const regRules = result.registrationRules as Record<string, unknown> | undefined;
  const absentee = result.absenteeRules as Record<string, unknown> | undefined;
  const dates = result.keyDates as Record<string, unknown>[] | undefined;

  return {
    voterEligibility: String(result.voterEligibility || ''),
    registrationRules: {
      deadline: String(regRules?.deadline || 'Unknown'),
      onlineAvailable: Boolean(regRules?.onlineAvailable),
      sameDay: Boolean(regRules?.sameDay),
    },
    absenteeRules: {
      noExcuseRequired: Boolean(absentee?.noExcuseRequired),
      earlyVotingDays: absentee?.earlyVotingDays != null ? Number(absentee.earlyVotingDays) : null,
      mailBallotDeadline: String(absentee?.mailBallotDeadline || 'Unknown'),
    },
    primaryType: String(result.primaryType || 'Unknown'),
    runoffRules: String(result.runoffRules || ''),
    keyDates: Array.isArray(dates)
      ? dates.map((d) => ({
          event: String(d.event || ''),
          date: String(d.date || ''),
        }))
      : [],
  };
}
