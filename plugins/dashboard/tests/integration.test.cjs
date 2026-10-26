const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {setup}=require('./host.cjs');
async function plugin(env){const p=new env.DashboardPlugin();p.loaded=true;await p.onload();p.now=()=>new Date(2026,9,26,12);return p;}

test('automatic daily settings prefer Periodic Notes and respect explicit root',()=>{
 const e=setup(),s=e.normalizeSettings({});
 e.app.internalPlugins.getPluginById=()=>({enabled:true,instance:{options:{folder:'Daily',format:'DD-MM-YYYY'}}});
 assert.equal(e.resolveDailySettings(e.app,s).source,'core');
 e.app.plugins.getPlugin=()=>({settings:{daily:{enabled:true,folder:'Periodic',format:'YYYY-MM-DD'}}});
 assert.equal(e.resolveDailySettings(e.app,s).folder,'Periodic');
 assert.equal(e.resolveDailySettings(e.app,e.normalizeSettings({useDailySettings:false})).folder,'');
});
test('index uses strict property dates, filename fallback, nested formats and folder boundaries',()=>{
 const e=setup();e.add('Daily/2026-10-25.md',{date:'2026-10-26',deep_work:60});
 e.add('Daily/2026-10-24.md',{date:'2026-02-30'});e.add('Daily-other/2026-10-23.md');
 const index=new e.DailyIndex(e.app,e.normalizeSettings({useDailySettings:false,dailyFolder:'Daily'}));index.rebuild();
 assert.equal(index.get('2026-10-26').level,2);assert.equal(index.get('2026-10-25'),null);
 assert.equal(index.get('2026-10-24').level,1);assert.equal(index.get('2026-10-23'),null);
 e.add('Daily/2026/10/2026-10-20.md');index.settings.dailyFormat='YYYY/MM/YYYY-MM-DD';index.rebuild();
 assert.equal(index.get('2026-10-20').level,1);
});
test('fallback excludes ordinary dated notes, while daily properties identify custom titles',()=>{
 const e=setup();e.add('Ordinary.md',{date:'2026-10-26'});e.add('My journal.md',{date:'2026-10-25',wins:'yes'});
 const index=new e.DailyIndex(e.app,e.normalizeSettings({}));index.rebuild();
 assert.equal(index.get('2026-10-26'),null);assert.equal(index.get('2026-10-25').level,3);
});
test('duplicate dates prefer the canonical filename without aggregating activity',()=>{
 const e=setup();e.add('Daily/A.md',{date:'2026-10-26',wins:'wins'});e.add('Daily/2026-10-26.md',{deep_work:60});
 const index=new e.DailyIndex(e.app,e.normalizeSettings({useDailySettings:false,dailyFolder:'Daily'}));index.rebuild();
 const day=index.get('2026-10-26');assert.equal(day.level,2);assert.equal(day.count,2);assert.equal(day.file.path,'Daily/2026-10-26.md');
});
test('real metadata changes refresh every board and preserve independent counts',async()=>{
 const e=setup(),file=e.add('2026-10-26.md');const p=await plugin(e),a=e.board(p),b=e.board(p);e.flush();
 assert.equal(a.counts[0].textContent,'1');assert.equal(a.counts[1].textContent,'0');
 assert.deepEqual(Array.from(a.countLabels,label=>label.textContent),['active days','deep_work','wins']);
 e.cache.set(file.path,{frontmatter:{deep_work:90,wins:'finished'}});e.app.metadataCache.trigger('changed',file);e.flush();
 assert.equal(a.counts[1].textContent,'1');assert.equal(b.counts[2].textContent,'1');
 assert.equal(b.cellNodes.get('2026-10-26').className,'db-l3');
 p.unload();assert.equal(e.intervals.size,0);assert.equal(p.listeners.size,0);
});
test('folder rename and deletion clear stale indexed paths',async()=>{
 const e=setup(),f=e.add('2026-10-26.md',{wins:'done'}),p=await plugin(e);
 f.path='Archive/other.md';f.name='other.md';f.basename='other';e.cache.clear();e.app.vault.trigger('rename',{path:'Archive'},'old');e.flush();
 assert.equal(p.index.get('2026-10-26'),null);
 e.files.length=0;e.app.vault.trigger('delete',{path:'Archive'});e.flush();assert.equal(p.index.days.size,0);p.unload();
});
test('view, embed, settings and commands register and rapid open reuses the dashboard tab',async()=>{
 const e=setup(),p=await plugin(e);assert.equal(p.blockType,'dashboard');assert.equal(p.commands.length,2);
 await Promise.all([p.openDashboard(),p.openDashboard()]);assert.equal(e.app.workspace.getLeavesOfType('dashboard-view').length,1);
 const ctx=new e.Component();ctx.load();p.blockCallback('',e.doc.createElement('div'),ctx);assert.equal(ctx.children.length,1);
 p.settingsTab.display();ctx.unload();p.unload();e.flush();assert.equal(p.boards.size,0);assert.equal(p.listeners.size,0);
});
test('search keyboard and IME only open existing selected files',async()=>{
 const e=setup();e.add('Daily.md');e.add('Daily notes.md');const p=await plugin(e),b=e.board(p);
 b.search.value='daily';b.search.dispatch('input');e.flush();assert.equal(b.results.length,2);
 b.search.dispatch('compositionstart');b.search.dispatch('keydown',{key:'Enter',isComposing:true});assert.equal(e.app.workspace.opened.length,0);
 b.search.dispatch('compositionend');e.flush();b.search.dispatch('keydown',{key:'ArrowDown'});b.search.dispatch('keydown',{key:'Enter'});
 await Promise.resolve();assert.equal(e.app.workspace.opened[0],'Daily.md');
 b.search.dispatch('input');e.flush();b.search.dispatch('keydown',{key:'Escape'});assert(b.resultBox.hidden);
 e.files.length=0;assert.equal(await p.openFile({path:'Daily.md'}),false);assert(e.notices.some(n=>n.includes('no longer exists')));p.unload();
});
test('hostile file names and wins are rendered as text',async()=>{
 const e=setup();e.add('<img src=x onerror=alert(1)>.md');e.add('2026-10-26.md',{wins:'<script>bad()</script>'});const p=await plugin(e),b=e.board(p);
 b.search.value='<img';b.runSearch();assert.equal(b.resultNodes[0].children[0].textContent,'<img src=x onerror=alert(1)>.md');
 b.chooseDay('2026-10-26');assert(b.detailBody.textContent.includes('<script>bad()</script>'));assert.equal(b.detailBody.children.length,0);p.unload();
});
test('heatmap keyboard navigation preserves focus and selected day',async()=>{
 const e=setup(),p=await plugin(e),b=e.board(p);
 const cell=b.cellNodes.get('2026-10-26');cell.focus();cell.dispatch('keydown',{key:'ArrowLeft'});
 assert.equal(b.selected,'2026-10-19');assert.equal(e.doc.activeElement.getAttribute('data-day'),'2026-10-19');
 b.chooseDay('2026-10-20');assert(b.openButton.disabled);p.unload();
});

test('header shows the supplied cat image before the date without a duplicate calendar',async()=>{
 const e=setup(),p=await plugin(e),b=e.board(p);
 assert.equal(b.avatar.tagName,'IMG');assert.equal(b.avatar.alt,'Sleeping cat');assert(b.avatar.src.startsWith('data:image/jpeg;base64,'));
 const imageBytes=Buffer.from(b.avatar.src.split(',')[1],'base64');
 assert.deepEqual(imageBytes,fs.readFileSync(path.join(__dirname,'../assets/cat.jpg')));
 assert.equal(b.clock.textContent,'12:00');
 const intro=b.avatar.parentElement.parentElement;
 assert.equal(intro.children[0],b.avatar.parentElement);assert(intro.children[1].contains(b.heading));
 assert.equal(b.calendarEl,undefined);assert.equal(b.setupButton.textContent,'Set up');p.unload();
});
test('midnight advances dates and unload cancels pending search/render callbacks',async()=>{
 const e=setup(),p=await plugin(e),b=e.board(p);p.lastToday='2026-10-26';
 p.now=()=>new Date(2026,9,27,0,1);p.checkToday();e.flush();assert.equal(b.today,'2026-10-27');assert.equal(b.selected,'2026-10-27');
 b.search.value='daily';b.queueSearch();b.unload();assert.equal(p.listeners.size,0);e.flush();assert.equal(b.root.parentElement,null);
 p.unload();assert.equal(e.timers.size,0);assert.equal(e.intervals.size,0);
});
test('failed settings saves stay usable, retry succeeds, serial updates save latest last',async()=>{
 const e=setup(),p=await plugin(e),b=e.board(p);p.saveFailure=true;
 assert.equal(await p.applySettings({useDailySettings:false,dailyFolder:'Daily'}),false);e.flush();assert.equal(p.settings.dailyFolder,'Daily');assert(!b.feedback.hidden);
 p.saveFailure=false;await p.retry();e.flush();assert.equal(p.storageError,'');assert(b.feedback.hidden);
 await Promise.all([p.applySettings({useDailySettings:false,dailyFolder:'A'}),p.applySettings({useDailySettings:false,dailyFolder:'B'})]);
 assert.equal(p.saved.at(-1).settings.dailyFolder,'B');p.unload();
});
test('load failures and unsupported versions are reported without an automatic save',async()=>{
 for(const failing of [true,false]){
  const e=setup(),p=new e.DashboardPlugin();p.loaded=true;p.loadFailure=failing;p.data={version:99};await p.onload();
  assert(p.storageError);assert.equal(p.saved.length,0);assert.equal(p.settings.dailyFormat,'YYYY-MM-DD');p.unload();
 }
});

test('Enter after a new query opens its current result instead of the previous query',async()=>{
 const e=setup();e.add('Alpha.md');e.add('Beta.md');const p=await plugin(e),b=e.board(p);
 b.search.value='alpha';b.search.dispatch('input');e.flush();
 b.search.value='beta';b.search.dispatch('input');b.search.dispatch('keydown',{key:'Enter'});
 await Promise.resolve();assert.equal(e.app.workspace.opened[0],'Beta.md');p.unload();
});
test('dismissed pending search stays closed after outside pointerdown',async()=>{
 const e=setup();e.add('Alpha.md');const p=await plugin(e),b=e.board(p);
 b.search.value='alpha';b.search.dispatch('input');e.doc.dispatch('pointerdown',{target:e.doc});e.flush();
 assert(b.resultBox.hidden);p.unload();
});
test('first ArrowDown from a collapsed search highlights the first result',async()=>{
 const e=setup();e.add('Alpha.md');e.add('Alpha notes.md');const p=await plugin(e),b=e.board(p);
 b.search.value='alpha';b.search.dispatch('keydown',{key:'ArrowDown'});
 assert.equal(b.activeResult,0);assert.equal(b.search.getAttribute('aria-activedescendant'),b.resultNodes[0].id);p.unload();
});

test('disabling during asynchronous tab creation leaves no dashboard or subscriptions',async()=>{
 const e=setup(),p=await plugin(e);let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const original=e.app.workspace.getLeaf.bind(e.app.workspace);
 e.app.workspace.getLeaf=()=>{
  const leaf=original(),set=leaf.setViewState.bind(leaf);
  leaf.setViewState=async state=>{await gate;await set(state);};return leaf;
 };
 const opening=p.openDashboard();p.unload();release();await opening;
 assert.equal(p.boards.size,0);assert.equal(p.listeners.size,0);
 assert.equal(e.app.workspace.getLeavesOfType('dashboard-view').length,0);
});

test('tracker setup saves typed custom rules and updates every board and count',async()=>{
 const e=setup();e.add('2026-10-26.md',{reading:'page',exercise:30});const p=await plugin(e),a=e.board(p),b=e.board(p);
 a.setupButton.dispatch('click');assert(!a.setupForm.hidden);assert.equal(a.setupButton.getAttribute('aria-expanded'),'true');
 assert.equal(a.ruleFields[0].property.value,'deep_work');assert.equal(a.ruleFields[0].type.value,'number');
 a.ruleFields[0].property.value='reading';a.ruleFields[0].type.value='text';a.ruleFields[0].type.dispatch('change');
 assert(a.ruleFields[0].thresholdLabel.hidden);
 a.ruleFields[1].property.value='exercise';a.ruleFields[1].type.value='number';a.ruleFields[1].type.dispatch('change');a.ruleFields[1].threshold.value='30';
 await a.saveRules();e.flush();
 assert(a.setupForm.hidden);assert.equal(p.settings.level3.threshold,30);
 assert.equal(p.index.get('2026-10-26').level,3);assert.equal(b.counts[1].textContent,'1');assert.equal(b.counts[2].textContent,'1');
 assert.equal(b.legendNodes[2].getAttribute('aria-label'),'reading has text');
 assert.deepEqual(Array.from(b.countLabels,label=>label.textContent),['active days','reading','exercise']);
 assert.equal(p.saved.at(-1).settings.level2.property,'reading');p.unload();
});
test('invalid setup does not mutate rules and Cancel discards edits',async()=>{
 const e=setup(),p=await plugin(e),b=e.board(p);b.setupButton.dispatch('click');
 b.ruleFields[0].property.value=' ';await b.saveRules();assert(b.setupError.textContent.includes('property'));assert.equal(p.saved.length,0);
 b.ruleFields[0].property.value='minutes';b.ruleFields[0].threshold.value='';await b.saveRules();assert(b.setupError.textContent.includes('minimum'));assert.equal(p.settings.level2.property,'deep_work');
 b.ruleFields[0].threshold.value='Infinity';await b.saveRules();assert(!b.setupForm.hidden);assert.equal(p.saved.length,0);
 b.setupCancel.dispatch('click');b.setupButton.dispatch('click');assert.equal(b.ruleFields[0].property.value,'deep_work');assert.equal(b.ruleFields[0].threshold.value,'60');p.unload();
});
test('custom properties identify property-dated daily notes in automatic fallback',async()=>{
 const e=setup();e.add('My journal.md',{date:'2026-10-26',reading:'page'});e.add('Older journal.md',{date:'2026-10-25',deep_work:100});const p=await plugin(e);
 await p.applySettings({...p.settings,level2:{property:'reading',type:'text'}});
 assert.equal(p.index.get('2026-10-26').level,2);assert.equal(p.index.get('2026-10-25').level,1);p.unload();
});
test('first ArrowDown after visible suggestions selects the first file and second selects the next',async()=>{
 const e=setup();e.add('Alpha.md');e.add('Alpha notes.md');const p=await plugin(e),b=e.board(p);
 b.search.value='alpha';b.search.dispatch('input');e.flush();
 assert.equal(b.search.getAttribute('aria-activedescendant'),null);
 b.search.dispatch('keydown',{key:'ArrowDown'});assert.equal(b.activeResult,0);
 b.search.dispatch('keydown',{key:'ArrowDown'});assert.equal(b.activeResult,1);
 b.search.dispatch('keydown',{key:'Enter'});await Promise.resolve();assert.equal(e.app.workspace.opened[0],'Alpha notes.md');p.unload();
});

test('search keeps the selected suggestion when metadata refreshes',async()=>{
 const e=setup(),file=e.add('2026-10-26.md');e.add('Alpha.md');e.add('Alpha notes.md');const p=await plugin(e),b=e.board(p);
 b.search.value='alpha';b.runSearch();b.search.dispatch('keydown',{key:'ArrowDown'});b.search.dispatch('keydown',{key:'ArrowDown'});
 e.app.metadataCache.trigger('changed',file);e.flush();assert.equal(b.activeResult,1);
 b.search.dispatch('keydown',{key:'Enter'});await Promise.resolve();assert.equal(e.app.workspace.opened[0],'Alpha notes.md');p.unload();
});
test('setup saves zero thresholds and failures remain editable and retryable',async()=>{
 const e=setup();e.add('2026-10-26.md',{score:0});const p=await plugin(e),b=e.board(p);b.showSetup();
 b.ruleFields[0].property.value='score';b.ruleFields[0].threshold.value='0';p.saveFailure=true;
 assert.equal(await b.saveRules(),false);assert.equal(p.index.get('2026-10-26').level,2);
 assert(!b.setupForm.hidden);assert(!b.setupSave.disabled);assert(b.setupError.textContent.includes('could not be saved'));
 p.saveFailure=false;assert.equal(await b.saveRules(),true);assert(b.setupForm.hidden);
 const q=new e.DashboardPlugin();q.loaded=true;q.data=e.plain(p.saved.at(-1));await q.onload();
 assert.equal(q.settings.level2.property,'score');assert.equal(q.settings.level2.threshold,0);q.unload();p.unload();
});

test('Vietnamese IME shows live suggestions while leaving composition and commit keys untouched',async()=>{
 const e=setup();e.add('Study/Đọc sách.md');const p=await plugin(e),b=e.board(p),input=b.search;
 input.focus();input.dispatch('compositionstart');input.value='Đọc';input.dispatch('input',{isComposing:true,data:'ọ'});e.flush();
 assert(!b.resultBox.hidden);assert.equal(b.results[0].path,'Study/Đọc sách.md');
 assert.equal(input.value,'Đọc');assert.equal(e.doc.activeElement,input);
 const arrow=input.dispatch('keydown',{key:'ArrowDown',isComposing:true,keyCode:229});
 const commit=input.dispatch('keydown',{key:'Enter',isComposing:true,keyCode:229});
 assert(!arrow.defaultPrevented);assert(!commit.defaultPrevented);assert.equal(e.app.workspace.opened.length,0);
 input.dispatch('compositionend',{data:'Đọc'});e.flush();
 input.dispatch('keydown',{key:'ArrowDown'});input.dispatch('keydown',{key:'Enter'});
 await Promise.resolve();assert.equal(e.app.workspace.opened[0],'Study/Đọc sách.md');p.unload();
});

test('IME composition updates suggestions as accents change without hiding existing matches',async()=>{
 const e=setup();e.add('Đọc sách.md');e.add('Dọn bàn.md');const p=await plugin(e),b=e.board(p);
 b.search.value='doc';b.search.dispatch('input');e.flush();assert.equal(b.results[0].name,'Đọc sách.md');
 b.search.dispatch('compositionstart');assert(!b.resultBox.hidden);
 b.search.value='Dọn';b.search.dispatch('input',{isComposing:true});e.flush();
 assert.equal(b.results[0].name,'Dọn bàn.md');assert.equal(b.search.value,'Dọn');p.unload();
});

test('leaving search clears cancelled composition and closes pending suggestions',async()=>{
 const e=setup();e.add('Đọc sách.md');const p=await plugin(e),b=e.board(p);
 b.search.dispatch('compositionstart');b.search.value='đọc';b.search.dispatch('input',{isComposing:true});
 b.search.dispatch('blur');b.search.dispatch('compositionend');e.flush();assert(!b.composing);assert(b.resultBox.hidden);
 b.search.focus();b.search.dispatch('focus');e.flush();b.search.dispatch('keydown',{key:'Enter'});
 await Promise.resolve();assert.equal(e.app.workspace.opened[0],'Đọc sách.md');p.unload();
});

test('shared clock updates each minute, pads HH:mm and keeps historical selections at midnight',async()=>{
 const e=setup(),p=await plugin(e),a=e.board(p),b=e.board(p);p.checkToday();e.flush();
 assert.equal(a.clock.textContent,'12:00');const heading=a.heading.children[0];
 p.now=()=>new Date(2026,9,26,12,1);p.checkToday();e.flush();assert.equal(a.clock.textContent,'12:01');assert.equal(b.clock.textContent,'12:01');assert.equal(a.heading.children[0],heading);
 a.chooseDay('2026-10-20');p.now=()=>new Date(2026,9,27,0,5);p.checkToday();e.flush();
 assert.equal(a.clock.textContent,'00:05');assert.equal(a.clock.getAttribute('datetime'),'2026-10-27T00:05');assert.equal(a.today,'2026-10-27');assert.equal(a.selected,'2026-10-20');assert.equal(b.selected,'2026-10-27');
 assert.equal(e.intervals.size,1);p.unload();assert.equal(e.intervals.size,0);
});
