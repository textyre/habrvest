const fs = require('fs');
const cache = JSON.parse(fs.readFileSync(process.env.HOME + '/.cache/medium-scraper/accessibility-testing.json', 'utf8'));

const seen = new Set();
const results = [];
const keys = Object.keys(cache).sort((a, b) => b.localeCompare(a));
for (const k of keys) {
  const articles = cache[k];
  for (const a of articles) {
    if (a.url && !seen.has(a.url)) {
      seen.add(a.url);
      results.push({ ...a, period: k });
    }
  }
}

function parseClaps(c) {
  if (!c) return 0;
  if (c.endsWith('K')) return parseFloat(c) * 1000;
  if (c.endsWith('M')) return parseFloat(c) * 1000000;
  return parseInt(c) || 0;
}

results.sort((a, b) => parseClaps(b.claps) - parseClaps(a.claps));

// build markdown
const lines = [];
lines.push('---');
lines.push('type: collection');
lines.push('created: 2026-03-08');
lines.push('source: medium.com/tag/accessibility-testing');
lines.push('period: 2017–2026');
lines.push(`total: ${results.length}`);
lines.push('---');
lines.push('');
lines.push('# Medium: Accessibility Testing articles');
lines.push('');
lines.push('Источник: [medium.com/tag/accessibility-testing](https://medium.com/tag/accessibility-testing/archive) — полный архив 2017–2026, отсортировано по claps.');
lines.push('');
lines.push('[[Accessibility]] [[Testing]]');
lines.push('');
lines.push('---');
lines.push('');
lines.push('## Топ по claps');
lines.push('');
lines.push('| Claps | Дата | 💎 | Статья | Автор | Описание |');
lines.push('|-------|------|-----|--------|-------|----------|');

for (const a of results.slice(0, 100)) {
  const claps = a.claps || '—';
  const date = (a.date || '').slice(0, 10) || '—';
  const member = a.isMember ? '💎' : '';
  const title = a.title.replace(/\|/g, '—');
  const desc = (a.description || '').slice(0, 80).replace(/\|/g, '—');
  const author = (a.author || '').replace(/\|/g, '—');
  lines.push(`| ${claps} | ${date} | ${member} | [${title}](${a.url}) | ${author} | ${desc} |`);
}

lines.push('');
lines.push('---');
lines.push('');
lines.push('## Все статьи без claps');
lines.push('');
const noclaps = results.filter(a => !a.claps);
for (const a of noclaps) {
  const date = (a.date || '').slice(0, 10);
  const member = a.isMember ? ' 💎' : '';
  lines.push(`- ${date}${member} [${a.title}](${a.url}) — ${a.author || ''}`);
}

console.log(lines.join('\n'));
process.stderr.write('Total: ' + results.length + ', with claps: ' + results.filter(a => a.claps).length + '\n');
