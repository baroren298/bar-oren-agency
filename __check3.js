const { parse } = require('@babel/parser');
const fs = require('fs');
const files = ['data/site.js', 'components/home/FeaturedTalent.jsx'];
let ok = true;
for (const f of files) {
  try {
    parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    console.log('OK   ', f);
  } catch (e) { ok = false; console.log('FAIL ', f, '-', e.message); }
}
process.exit(ok?0:1);
