const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const {setup}=require('./host.cjs');
const png=fs.readFileSync(path.join(__dirname,'../assets/ryo.png'));
function image(name='Photo.png',bytes=png){return {name,size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer};}
async function start(e){const p=new e.DashboardPlugin();p.loaded=true;await p.onload();p.now=()=>new Date(2026,9,26,12);return p;}

test('avatar imports into an images folder inside the installed plugin and preserves bytes',async()=>{
 const e=setup(),p=await start(e),selected=image();
 assert.equal(p.avatarFolder(),'.obsidian/plugins/dashboard/images');
 const target=await p.importAvatar(selected);
 assert(target.startsWith('.obsidian/plugins/dashboard/images/Photo-'));assert(target.endsWith('.png'));
 assert.deepEqual(Buffer.from(e.disk.get(target).data),png);
 assert.equal(p.settings.avatarPath,'');p.unload();
});
test('custom config directories derive the nested folder from the actual plugin location',async()=>{
 const e=setup(),p=await start(e);p.manifest.dir='Obsidian Config/plugins/custom-dashboard';
 assert.equal(p.avatarFolder(),'Obsidian Config/plugins/custom-dashboard/images');p.unload();
});
test('Set up saves avatar choice, updates every view, persists and restores it',async()=>{
 const e=setup(),p=await start(e),a=e.board(p),b=e.board(p);a.showSetup();
 a.avatarInput.files=[image('My avatar.png')];a.avatarInput.dispatch('change');
 assert.equal(e.disk.size,0);assert.equal(await a.saveRules(),true);e.flush();
 const selected=p.settings.avatarPath;assert(selected.startsWith(p.avatarFolder()+'/'));
 assert.equal(a.avatar.src,p.avatarSource());assert.equal(b.avatar.src,p.avatarSource());assert(a.setupForm.hidden);
 assert.equal(p.saved.at(-1).settings.avatarPath,selected);
 const q=new e.DashboardPlugin();q.loaded=true;q.data=e.plain(p.saved.at(-1));await q.onload();assert.equal(q.settings.avatarPath,selected);assert.equal(q.avatarSource(),p.avatarSource());
 q.unload();p.unload();
});
test('Cancel and invalid level rules do not import a selected draft image',async()=>{
 const e=setup(),p=await start(e),b=e.board(p);b.showSetup();b.avatarInput.files=[image()];b.avatarInput.dispatch('change');
 b.setupCancel.dispatch('click');assert.equal(e.disk.size,0);assert.equal(p.settings.avatarPath,'');
 b.showSetup();assert.equal(b.pendingAvatar,null);b.avatarInput.files=[image()];b.avatarInput.dispatch('change');b.ruleFields[0].property.value='';
 assert.equal(await b.saveRules(),false);assert.equal(e.disk.size,0);p.unload();
});
test('reset returns to the cat without removing previously imported files',async()=>{
 const e=setup(),p=await start(e),b=e.board(p);b.showSetup();b.avatarInput.files=[image()];b.avatarInput.dispatch('change');await b.saveRules();e.flush();
 const selected=p.settings.avatarPath;b.showSetup();b.avatarResetButton.dispatch('click');await b.saveRules();e.flush();
 assert.equal(p.settings.avatarPath,'');assert(b.avatar.src.startsWith('data:image/jpeg;base64,'));assert(e.disk.has(selected));p.unload();
});
test('bad types, unreadable files, oversized uploads and write errors preserve the current avatar',async()=>{
 const e=setup(),p=await start(e),b=e.board(p);b.showSetup();
 for(const bad of [image('script.svg'),image('wrong.png',Buffer.from('not an image')),{name:'huge.png',size:21*1024*1024,arrayBuffer:async()=>{throw Error('should not read');}},{name:'broken.png',size:16,arrayBuffer:async()=>{throw Error('cannot read');}}]){
  b.avatarInput.files=[bad];b.avatarInput.dispatch('change');assert.equal(await b.saveRules(),false);assert.equal(p.settings.avatarPath,'');assert(!b.setupError.hidden);assert(!b.setupSave.disabled);
 }
 e.app.vault.adapter.failWrites=true;b.avatarInput.files=[image()];b.avatarInput.dispatch('change');assert.equal(await b.saveRules(),false);assert.equal(p.settings.avatarPath,'');assert(!b.setupForm.hidden);p.unload();
});
test('same-name imports use unique safe paths without overwriting prior images',async()=>{
 const e=setup(),p=await start(e);const [a,b]=await Promise.all([p.importAvatar(image('../../Photo.png')),p.importAvatar(image('../../Photo.png'))]);
 assert.notEqual(a,b);assert(!a.includes('..'));assert(!b.includes('..'));assert(e.disk.has(a)&&e.disk.has(b));p.unload();
});
test('failed settings save retries the same copied image rather than importing it twice',async()=>{
 const e=setup(),p=await start(e),b=e.board(p);b.showSetup();b.avatarInput.files=[image()];b.avatarInput.dispatch('change');p.saveFailure=true;
 assert.equal(await b.saveRules(),false);const selected=p.settings.avatarPath,count=e.disk.size;assert(selected);assert.equal(b.pendingAvatar,null);
 p.saveFailure=false;assert.equal(await b.saveRules(),true);assert.equal(p.settings.avatarPath,selected);assert.equal(e.disk.size,count);p.unload();
});
test('saved avatar sources are restricted to the plugin images folders',async()=>{
 const e=setup(),p=await start(e);
 for(const value of ['https://example.com/a.png','../../Downloads/a.png','Notes/other.png']){
  p.settings.avatarPath=value;assert(p.avatarSource().startsWith('data:image/jpeg;base64,'));
 }
 p.unload();
});

test('closing the plugin during image reading does not write a file or save stale settings',async()=>{
 const e=setup(),p=await start(e),b=e.board(p);let release;
 const pending=new Promise(resolve=>{release=resolve;});b.showSetup();
 b.avatarInput.files=[{name:'Photo.png',size:png.length,arrayBuffer:()=>pending}];b.avatarInput.dispatch('change');
 const saving=b.saveRules();await Promise.resolve();p.unload();release(Uint8Array.from(png).buffer);
 assert.equal(await saving,false);assert.equal(e.disk.size,0);assert.equal(p.saved.length,0);assert.equal(p.listeners.size,0);
});

test('an unavailable saved image falls back without retrying it on every tracker repaint',async()=>{
 const e=setup(),p=await start(e),b=e.board(p);p.settings.avatarPath=p.avatarFolder()+'/missing.png';b.render();
 const requested=b.avatarRequested;b.avatar.dispatch('error');assert(b.avatar.src.startsWith('data:image/jpeg;base64,'));
 b.render();assert.equal(b.avatarRequested,requested);assert(b.avatar.src.startsWith('data:image/jpeg;base64,'));p.unload();
});

for(const failure of [false,true])test(`legacy selected avatar is ${failure?'kept usable on copy failure':'copied into dashboard/images on upgrade'}`,async()=>{
 const e=setup(),old='.obsidian/plugins/images/previous.png';e.disk.set(old,{type:'file',data:Uint8Array.from(png)});
 e.app.vault.adapter.failWrites=failure;
 const p=new e.DashboardPlugin();p.loaded=true;p.data={version:1,settings:{avatarPath:old}};await p.onload();
 assert(e.disk.has(old));
 if(failure){assert.equal(p.settings.avatarPath,old);assert.equal(p.avatarSource(),'app://vault/'+old);assert(e.notices.some(n=>n.includes('avatar')));}
 else {assert(p.settings.avatarPath.startsWith('.obsidian/plugins/dashboard/images/'));assert.deepEqual(Buffer.from(e.disk.get(p.settings.avatarPath).data),png);assert.equal(p.saved.at(-1).settings.avatarPath,p.settings.avatarPath);}
 p.unload();
});
test('missing legacy image does not prevent startup or reset saved preferences',async()=>{
 const e=setup(),p=new e.DashboardPlugin();p.loaded=true;p.data={version:1,settings:{avatarPath:'.obsidian/plugins/images/missing.png',level2:{property:'reading',type:'number',threshold:10}}};await p.onload();
 assert.equal(p.settings.level2.property,'reading');assert.equal(p.saved.length,0);assert.equal(p.settings.avatarPath,'.obsidian/plugins/images/missing.png');assert(p.index);p.unload();
});
