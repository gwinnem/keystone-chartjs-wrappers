// @ts-nocheck
import { readFileSync, writeFileSync } from 'node:fs';
const r = JSON.parse(readFileSync('./reports/mutation/mutation-report.json', 'utf8'));
const f = r.files['src/zoomPlugin.ts'];
const bad = f.mutants.filter(m => m.status === 'Survived' || m.status === 'NoCoverage' || m.status === 'RuntimeError');
const out = bad
  .sort((a,b) => a.location.start.line - b.location.start.line || a.location.start.column - b.location.start.column)
  .map(m => `${m.location.start.line}:${m.location.start.column}-${m.location.end.line}:${m.location.end.column} | ${m.mutatorName} | ${m.status} | ${JSON.stringify(m.replacement)}`);
writeFileSync('./mutant-detail.txt', out.join('\n'));
console.log('wrote', out.length, 'lines to mutant-detail.txt');
