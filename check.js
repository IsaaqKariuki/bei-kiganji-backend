require('dotenv').config();
const fs = require('fs');
const sql = fs.readFileSync('./schema.sql','utf8');
const stmts = sql.split(';').map(s=>s.trim()).filter(s=>s.length>0 && !s.startsWith('--'));
console.log('statements found:', stmts.length);
stmts.forEach((s,i)=>console.log(i+':',s.substring(0,60)));
