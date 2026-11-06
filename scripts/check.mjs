import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const files=fs.readdirSync('assets').filter(x=>x.endsWith('.js'));
for(const name of files)new vm.Script(fs.readFileSync('assets/'+name,'utf8'),{filename:name});
new vm.Script(fs.readFileSync('engagement.js','utf8'),{filename:'engagement.js'});
const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('assets/content.js','utf8'),ctx);
const items=ctx.window.OT_CONTENT;
assert.equal(new Set(items.map(x=>x.id)).size,items.length);
for(const item of items){for(const field of ['url','img']){if(!/^https?:/.test(item[field]))assert.ok(fs.existsSync(item[field]),`${item.id}: missing ${field}`);}}
for(const file of ['index.html','admin.html','about.html']){
  const html=fs.readFileSync(file,'utf8');
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const target=m[1];if(/^(https?:|#|mailto:|data:)/.test(target))continue;
    assert.ok(fs.existsSync(target),`${file}: missing ${target}`);
  }
}
assert.ok(fs.statSync('index.html').size<15000,'Shell must stay below 15 KB');
assert.ok(!fs.readFileSync('index.html','utf8').includes('base64,'));
JSON.parse(fs.readFileSync('vercel.json','utf8'));
console.log(`PASS: ${files.length} JavaScript modules, ${items.length} published content links, local assets, HTML shell size.`);
