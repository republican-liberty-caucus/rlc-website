import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { DistrictResearchInput, DistrictResearchOutput } from './types';

const SYSTEM_PROMPT = `You are a political data analyst for the Republican Liberty Caucus (RLC). Your role is to compile structured district profiles for races where the RLC is evaluating an endorsement.

For each district, research and provide:
1. Cook PVI — the Cook Partisan Voting Index rating (e.g. "R+5", "D+3", "EVEN")
2. Demographics — population, median age, median income, race/ethnicity breakdown as percentages
3. Voter Registration — breakdown by party (Republican, Democrat, Independent, Other) as estimated percentages
4. Electoral History — recent election results (last 3-4 cycles) with winner, party, and margin
5. Key Issues — the most important local issues for voters in this district
6. Geographic Notes — notable geographic features, urban/rural composition, major cities/towns

Respond ONLY in valid JSON format:
{
  "cookPvi": "string",
  "demographics": {
    "population": number|null,
    "medianAge": number|null,
    "medianIncome": number|null,
    "raceEthnicity": { "white": number, "hispanic": number, "black": number, "asian": number, "other": number }
  },
  "voterRegistration": { "republican": number|null, "democrat": number|null, "independent": number|null, "other": number|null },
  "electoralHistory": [{ "year": number, "winner": "string", "party": "string", "margin": "string" }],
  "keyIssues": ["string"],
  "geographicNotes": "string"
}

Use real data where available. If data is unavailable, use null for numbers and "Data not available" for strings.`;

export async function researchDistrict(input: DistrictResearchInput): Promise<DistrictResearchOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    system: SYSTEM_PROMPT,
    prompt: `Research this district:\n\nState: ${input.stateCode}\nDistrict: ${input.districtId}\nOffice Type: ${input.officeType}`,
    maxOutputTokens: 1500,
    temperature: 0.2,
  });

  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON. Response: ${cleaned.slice(0, 200)}`);
  }

  const demographics = result.demographics as Record<string, unknown> | undefined;
  const voterReg = result.voterRegistration as Record<string, unknown> | undefined;
  const history = result.electoralHistory as Record<string, unknown>[] | undefined;

  return {
    cookPvi: String(result.cookPvi || 'Unknown'),
    demographics: {
      population: demographics?.population != null ? Number(demographics.population) : null,
      medianAge: demographics?.medianAge != null ? Number(demographics.medianAge) : null,
      medianIncome: demographics?.medianIncome != null ? Number(demographics.medianIncome) : null,
      raceEthnicity: (demographics?.raceEthnicity as Record<string, number>) || {},
    },
    voterRegistration: {
      republican: voterReg?.republican != null ? Number(voterReg.republican) : null,
      democrat: voterReg?.democrat != null ? Number(voterReg.democrat) : null,
      independent: voterReg?.independent != null ? Number(voterReg.independent) : null,
      other: voterReg?.other != null ? Number(voterReg.other) : null,
    },
    electoralHistory: Array.isArray(history)
      ? history.map((h) => ({
          year: Number(h.year) || 0,
          winner: String(h.winner || ''),
          party: String(h.party || ''),
          margin: String(h.margin || ''),
        }))
      : [],
    keyIssues: Array.isArray(result.keyIssues) ? result.keyIssues.map(String) : [],
    geographicNotes: String(result.geographicNotes || ''),
  };
}
