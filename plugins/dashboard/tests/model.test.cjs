const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const context = {Date,Intl};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/model.js'),'utf8')+'\nthis.api={parseDay,localDay,shiftDay,activity,heatmapDays,searchFiles,normalizeSettings,ruleMatches,ruleLabel};',context);
const {parseDay,localDay,shiftDay,activity,heatmapDays,searchFiles,normalizeSettings,ruleMatches,ruleLabel}=context.api;
const plain=value=>JSON.parse(JSON.stringify(value));

test('strict dates reject overflow and preserve local date arithmetic',()=>{
 assert.equal(parseDay('2024-02-29'),'2024-02-29');
 for(const date of ['2026-02-29','2026-04-31','26-10-2026','2026-1-01','2026-10-26T00:00:00','',null,{},1])assert.equal(parseDay(date),null);
 assert.equal(localDay(new Date(2026,9,26,0,1)),'2026-10-26');
 assert.equal(shiftDay('2026-03-08',1),'2026-03-09');
 assert.equal(shiftDay('2026-11-01',1),'2026-11-02');
 assert.equal(shiftDay('2024-02-28',1),'2024-02-29');
 assert.equal(shiftDay('2025-12-31',1),'2026-01-01');
 assert.equal(parseDay(new Date('2026-10-26T00:00:00Z')),'2026-10-26');
});
test('daily activity uses exact minute threshold and highest eligible level',()=>{
 assert.deepEqual(plain(activity({})),{level:1,deepWork:0,wins:''});
 for(const value of [null,false,'60',-1,Infinity,NaN,{},[]])assert.equal(activity({deep_work:value}).level,1);
 assert.equal(activity({deep_work:59.99}).level,1);
 assert.equal(activity({deep_work:60}).level,2);
 assert.equal(activity({deep_work:120,wins:' \n\t '}).level,2);
 assert.equal(activity({deep_work:0,wins:'small win'}).level,3);
 for(const wins of [false,0,[],{},null])assert.equal(activity({wins}).level,1);
});
test('heatmap always has 53 complete weeks and 365 distinct in-range local days',()=>{
 for(const day of ['2026-10-26','2026-10-25','2026-10-31','2024-02-29','2026-03-10','2026-11-03']){
  const cells=heatmapDays(day),visible=cells.filter(c=>c.inRange);
  assert.equal(cells.length,371);assert.equal(visible.length,365);
  assert.equal(new Set(cells.map(c=>c.day)).size,371);
  assert.equal(visible.at(-1).day,day);assert.equal(visible[0].day,shiftDay(day,-364));
  assert.equal(new Date(cells[0].day+'T12:00:00').getDay(),0);
 }
});
test('search ranks file names and handles accents, duplicate names and attachments',()=>{
 const files=['Z/Daily notes.md','Daily.md','Ideas/daily.md','Study/Đọc sách.md','Images/Daily.png','Archive/notes.md'].map(path=>({path,name:path.split('/').at(-1),basename:path.split('/').at(-1).replace(/\.[^.]+$/,'')}));
 assert.equal(searchFiles(files,'daily')[0].path,'Daily.md');
 assert.equal(searchFiles(files,'doc sach')[0].path,'Study/Đọc sách.md');
 assert.equal(searchFiles(files,'images daily')[0].path,'Images/Daily.png');
 assert.equal(searchFiles(files,'daily',2).length,2);
 assert.equal(searchFiles(files,' \t ').length,0);
 assert.equal(searchFiles(files,'<script>').length,0);
});
test('settings keep explicit root, normalize paths and reject malformed values',()=>{
 assert.equal(normalizeSettings({useDailySettings:false,dailyFolder:''}).dailyFolder,'');
 assert.equal(normalizeSettings({dailyFolder:' /Daily//2026/ '}).dailyFolder,'Daily/2026');
 assert.equal(normalizeSettings({dailyFolder:'../secret'}).dailyFolder,'');
 assert.equal(normalizeSettings({dailyFormat:42}).dailyFormat,'YYYY-MM-DD');
 assert.equal(normalizeSettings([]).useDailySettings,true);
});

test('configurable rules support either type independently and keep level 3 priority',()=>{
 const settings=normalizeSettings({level2:{property:'reading',type:'text'},level3:{property:'exercise',type:'number',threshold:30}});
 assert.equal(activity({reading:'one page',exercise:0},settings).level,2);
 assert.equal(activity({reading:' ',exercise:29.99},settings).level,1);
 assert.equal(activity({reading:'',exercise:30},settings).level,3);
 assert.equal(activity({reading:'one page',exercise:40},settings).level,3);
 assert.equal(activity({deep_work:200,wins:'legacy'},settings).level,1);
});
test('text and numeric rules reject coercion and inherited properties',()=>{
 const text={property:'value',type:'text'},number={property:'value',type:'number',threshold:0};
 for(const value of [' ',false,0,[],{},null,undefined])assert.equal(ruleMatches({value},text),false);
 assert.equal(ruleMatches({value:'done'},text),true);
 for(const value of ['',false,'0',null,undefined,NaN,Infinity,[]])assert.equal(ruleMatches({value},number),false);
 assert.equal(ruleMatches({value:0},number),true);
 assert.equal(ruleMatches({value:-2},{...number,threshold:-3}),true);
 assert.equal(ruleMatches(Object.create({value:'inherited'}),text),false);
 assert.equal(ruleMatches({}, {property:'constructor',type:'text'}),false);
});
test('old settings retain defaults and invalid persisted rules have safe independent fallbacks',()=>{
 const old=normalizeSettings({dailyFolder:'Daily',useDailySettings:false});
 assert.deepEqual(plain(old.level2),{property:'deep_work',type:'number',threshold:60});
 assert.deepEqual(plain(old.level3),{property:'wins',type:'text',threshold:0});
 const first=normalizeSettings({level2:{property:'  focus minutes  ',type:'number',threshold:0},level3:{property:' ',type:'invalid',threshold:null}});
 assert.equal(first.level2.property,'focus minutes');assert.equal(first.level2.threshold,0);
 assert.deepEqual(plain(first.level3),plain(old.level3));
 const second=normalizeSettings({});first.level2.threshold=10;assert.equal(second.level2.threshold,60);
 assert.equal(ruleLabel(old.level2),'deep_work ≥ 60');assert.equal(ruleLabel(old.level3),'wins has text');
});
