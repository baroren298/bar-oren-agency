const { parse } = require('@babel/parser');
const fs = require('fs');
const files = [
  'data/site.js',
  'app/[locale]/talent/page.jsx',
  'app/[locale]/talent/[slug]/page.jsx',
  'components/talent/TalentRoster.jsx',
  'components/talent/ProfileHero.jsx',
  'components/talent/ProfileGallery.jsx',
  'components/talent/PodcastSection.jsx',
  'components/talent/ProfileCTA.jsx',
  'components/talent/ProfileNav.jsx',
];
let ok = true;
for (const f of files) {
  try {
    const code = fs.readFileSync(f, 'utf8');
    parse(code, { sourceType: 'module', plugins: ['jsx'] });
    console.log('OK   ', f);
  } catch (e) {
    ok = false;
    console.log('FAIL ', f, '-', e.message);
  }
}
process.exit(ok ? 0 : 1);
