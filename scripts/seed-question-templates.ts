/**
 * Seed question templates from existing 2024 survey questions.
 *
 * Fetches all questions from the first survey found (the existing 2024 candidate survey),
 * classifies them by keyword matching into QuestionCategory values, and inserts them as
 * reusable question templates tagged with office_levels: ['federal'].
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/seed-question-templates.ts
 *
 * Idempotent: Checks for existing templates and skips if any are found.
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type QuestionCategory =
  | 'fiscal_policy'
  | 'constitutional_rights'
  | 'second_amendment'
  | 'judicial_philosophy'
  | 'immigration'
  | 'healthcare'
  | 'education'
  | 'foreign_policy'
  | 'criminal_justice'
  | 'regulatory_reform'
  | 'property_rights'
  | 'other';

const CATEGORY_RULES: Array<{ category: QuestionCategory; keywords: RegExp }> = [
  { category: 'second_amendment', keywords: /gun|second amendment|firearm|2nd amendment|arms/i },
  { category: 'fiscal_policy', keywords: /spending|tax|budget|debt|deficit|fiscal|tariff|trade/i },
  { category: 'immigration', keywords: /immigra|border|deport|asylum|illegal alien/i },
  { category: 'education', keywords: /education|school|department of education|student/i },
  { category: 'healthcare', keywords: /healthcare|health care|health|medical|mandate|medicaid|medicare/i },
  { category: 'constitutional_rights', keywords: /constitution|rights|amendment|liberty|freedom|bill of rights|free speech|due process/i },
  { category: 'judicial_philosophy', keywords: /judicial|judge|court|originali|textuali/i },
  { category: 'foreign_policy', keywords: /foreign|nato|military|defense|war|treaty|sanctions/i },
  { category: 'criminal_justice', keywords: /criminal|prison|police|law enforcement|sentencing/i },
  { category: 'regulatory_reform', keywords: /regulation|deregulation|regulatory|epa|osha/i },
  { category: 'property_rights', keywords: /property|eminent domain|zoning|land use/i },
];

function classifyQuestion(text: string): QuestionCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.test(text)) {
      return rule.category;
    }
  }
  return 'other';
}

async function main() {
  // Check if templates already exist
  const { count: existingCount } = await supabase
    .from('rlc_question_templates')
    .select('*', { count: 'exact', head: true });

  if (existingCount && existingCount > 0) {
    console.log(`Found ${existingCount} existing templates. Skipping seed to preserve idempotency.`);
    console.log('To re-seed, delete existing templates first.');
    return;
  }

  // Find the first survey (the 2024 candidate survey)
  const { data: surveys, error: surveyError } = await supabase
    .from('rlc_surveys')
    .select('id, title')
    .order('created_at', { ascending: true })
    .limit(1);

  if (surveyError || !surveys?.length) {
    console.error('No surveys found:', surveyError?.message || 'empty result');
    process.exit(1);
  }

  const sourceSurvey = surveys[0];
  console.log(`Source survey: "${sourceSurvey.title}" (${sourceSurvey.id})`);

  // Fetch all questions from the source survey
  const { data: questions, error: questionsError } = await supabase
    .from('rlc_survey_questions')
    .select('question_text, question_type, options, weight, ideal_answer, sort_order')
    .eq('survey_id', sourceSurvey.id)
    .order('sort_order', { ascending: true });

  if (questionsError || !questions?.length) {
    console.error('No questions found:', questionsError?.message || 'empty result');
    process.exit(1);
  }

  console.log(`Found ${questions.length} questions to convert to templates.`);

  // Classify and prepare templates
  const categoryCounts: Record<string, number> = {};
  const templates = questions.map((q, i) => {
    const category = classifyQuestion(q.question_text);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    return {
      id: crypto.randomUUID(),
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options || [],
      weight: q.weight || 1,
      ideal_answer: q.ideal_answer || null,
      sort_order: q.sort_order ?? i,
      office_levels: ['federal'],
      category,
      is_active: true,
    };
  });

  console.log('\nCategory distribution:');
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Batch insert
  const { error: insertError } = await supabase
    .from('rlc_question_templates')
    .insert(templates as never[]);

  if (insertError) {
    console.error('Failed to insert templates:', insertError.message);
    process.exit(1);
  }

  console.log(`\nSuccessfully seeded ${templates.length} question templates.`);

  // Verify
  const { count } = await supabase
    .from('rlc_question_templates')
    .select('*', { count: 'exact', head: true });

  console.log(`Total question templates in database: ${count}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
