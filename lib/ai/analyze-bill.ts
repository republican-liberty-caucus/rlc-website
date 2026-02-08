import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const SYSTEM_PROMPT = `You are a policy analyst for the Republican Liberty Caucus (RLC). Your role is to evaluate legislation against core RLC principles:

1. Individual Liberty — personal freedom, privacy, due process, civil liberties
2. Limited Government — smaller government, reduced regulation, fiscal responsibility
3. Free Markets — free enterprise, deregulation, property rights, economic freedom
4. Second Amendment — gun rights, right to bear arms
5. Constitutional Governance — federalism, separation of powers, rule of law

For each bill, you must:
1. Determine whether a "Yea" (vote in favor) or "Nay" (vote against) best aligns with liberty principles
2. Provide a brief analysis explaining why
3. Categorize the bill into one of: fiscal, civil_liberties, gun_rights, regulation, healthcare, education, criminal_justice, immigration, trade, environment, other
4. Rate your confidence from 0 to 1

Respond in JSON format only:
{
  "suggestedPosition": "yea" | "nay",
  "analysis": "2-3 sentence explanation",
  "category": "category_name",
  "confidence": 0.0-1.0
}`;

export interface BillAnalysisResult {
  suggestedPosition: 'yea' | 'nay';
  analysis: string;
  category: string;
  confidence: number;
}

export async function analyzeBill(billTitle: string, billDescription: string): Promise<BillAnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    system: SYSTEM_PROMPT,
    prompt: `Analyze this bill:\n\nTitle: ${billTitle}\n\nDescription/Summary: ${billDescription || 'No description available'}`,
    maxOutputTokens: 500,
    temperature: 0.2,
  });

  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON. Response: ${cleaned.slice(0, 200)}`);
  }

  return {
    suggestedPosition: result.suggestedPosition === 'yea' ? 'yea' : 'nay',
    analysis: String(result.analysis || ''),
    category: String(result.category || 'other'),
    confidence: Number(result.confidence) || 0,
  };
}
