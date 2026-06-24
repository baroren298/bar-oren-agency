const { parse } = require('@babel/parser');
const fs = require('fs');
parse(fs.readFileSync('components/home/ContactInvite.jsx','utf8'), { sourceType: 'module', plugins: ['jsx'] });
console.log('OK ContactInvite.jsx');
