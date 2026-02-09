const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data } = await sb.from('rlc_posts').select('content').eq('slug', 'committees').contains('categories', ['Pages']).single();

  let output = data.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  output = output.replace(/<strong>(?:\s|&nbsp;)*<\/strong>/gi, '');

  // NEW regex: inner capture cannot cross </strong> or </p> boundaries
  const re = /<p[^>]*>\s*<strong>([^<]*(?:<(?!\/strong>|\/p>)[^<]*)*)<\/strong>(?:\s|&nbsp;)*<\/p>/gi;
  let m;
  let count = 0;
  while ((m = re.exec(output)) !== null) {
    count++;
    const inner = m[1];
    const hasImg = /<img/i.test(inner);
    const clean = inner.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, ' ').trim();
    const skipped = hasImg || !clean;
    console.log(count + '. ' + (skipped ? 'SKIP' : 'PROMOTE') + ': "' + clean.substring(0, 80) + '"');
    if (skipped) console.log('   reason: img=' + hasImg + ' empty=' + (!clean));
  }
  console.log('\nTotal regex matches:', count);
}
main().catch(console.error);
