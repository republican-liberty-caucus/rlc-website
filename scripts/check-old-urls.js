const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: posts } = await sb.from('rlc_posts').select('id, content, featured_image_url');
  const oldUrls = new Set();
  for (const p of posts) {
    const c = (p.content || '') + ' ' + (p.featured_image_url || '');
    const matches = c.match(/https?:\/\/(?:www\.rlc\.org\/sites\/default\/files\/[^\s"'<>]+|new\.rlc\.org\/wp-content\/uploads\/[^\s"'<>]+)/g);
    if (matches) matches.forEach(m => oldUrls.add(m.replace(/["']$/, '')));
  }

  // List all storage files
  const allFiles = new Set();
  const years = ['2013','2014','2015','2016','2017','2018','2019','2020','2021','2022','2023'];
  for (const year of years) {
    const { data: months } = await sb.storage.from('wordpress-media').list(year, { limit: 100 });
    if (!months) continue;
    for (const m of months) {
      if (m.id === null) {
        const { data: files } = await sb.storage.from('wordpress-media').list(year + '/' + m.name, { limit: 500 });
        if (files) files.filter(f => f.id !== null).forEach(f => allFiles.add(year + '/' + m.name + '/' + f.name));
      }
    }
  }

  let found = 0, missing = 0;
  const missingUrls = [];

  for (const url of oldUrls) {
    let storagePath;
    const uploadsMatch = url.match(/\/wp-content\/uploads\/(\d{4})\/(\d{2})\/(.+)$/);
    if (uploadsMatch) {
      storagePath = uploadsMatch[1] + '/' + uploadsMatch[2] + '/' + decodeURIComponent(uploadsMatch[3]);
    } else {
      const parts = url.split('/');
      storagePath = 'misc/' + parts[parts.length - 1];
    }

    if (allFiles.has(storagePath)) {
      found++;
    } else {
      missing++;
      missingUrls.push(url + '  →  expected: ' + storagePath);
    }
  }

  console.log('Found in storage:', found);
  console.log('Missing from storage:', missing);
  console.log('\nMISSING URLs:');
  missingUrls.forEach(u => console.log(' ', u));
}
main().catch(console.error);
