const { config } = require('dotenv');
config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await sb.from('rlc_posts')
    .select('slug, content')
    .contains('categories', ['Pages']);

  if (error) { console.log('ERROR:', error.message); return; }

  for (const page of data) {
    const c = page.content || '';
    console.log(`\n=== ${page.slug} ===`);
    console.log(`  length: ${c.length}`);
    console.log(`  has <p>: ${/<p[\s>]/i.test(c)}`);
    console.log(`  has <h>: ${/<h[1-6][\s>]/i.test(c)}`);
    console.log(`  has <strong>: ${/<strong/i.test(c)}`);
    console.log(`  has <ol>/<ul>: ${/<[ou]l[\s>]/i.test(c)}`);
    console.log(`  newlines: ${(c.match(/\n/g) || []).length}`);
    console.log(`  double newlines: ${(c.match(/\n\n/g) || []).length}`);
  }

  // Show bylaws raw first 3000 chars
  const bylaws = data.find(p => p.slug === 'bylaws');
  if (bylaws && bylaws.content) {
    console.log('\n\n=== BYLAWS RAW (first 3000) ===');
    console.log(bylaws.content.substring(0, 3000));
  }
}

main();
