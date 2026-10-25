const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Minimal DOM and Obsidian hosts for exercising the actual dialog event handlers.
class Element {
 constructor(tag='div') {
  this.tag=tag;this.children=[];this.attributes={};this.value='';this.textContent='';this.isConnected=true;
  this.ownerDocument={createElement:tag=>new Element(tag),get activeElement(){return Element.activeElement;}};
  this.classList={add:(...names)=>{this.className=[this.className||'',...names].join(' ');},toggle:(name,enabled)=>{const names=new Set((this.className||'').split(' ').filter(Boolean));if(enabled)names.add(name);else names.delete(name);this.className=[...names].join(' ');}};
 }
 appendChild(child){this.children.push(child);}
 replaceChildren(){this.children=[];}
 setAttribute(name,value){this.attributes[name]=value;}
 focus(){this.focused=true;Element.activeElement=this;}
 blur(){if(Element.activeElement===this){Element.activeElement=null;this.onblur?.();}}
 remove(){this.isConnected=false;}
 animate(keyframes,options){const animation={cancelled:false,cancel(){this.cancelled=true;}};(this.animations??=[]).push({keyframes,options,animation});return animation;}
 querySelectorAll(selector){return this.children.flatMap(child=>[...(selector.split(',').includes(child.tag)?[child]:[]),...child.querySelectorAll(selector)]);}
}
class Modal {
 constructor(){this.contentEl=new Element();this.modalEl=new Element();}
 open(){this.onOpen();}
 close(){this.closed=true;this.onClose();}
}
class RenderChild {
 constructor(container){this.containerEl=container;}
 registerEvent(){}
}
const source=fs.readFileSync(path.join(__dirname,'..','main.js'),'utf8');
function setup(){
 const notices=[];
 const context={module:{exports:{}},setTimeout,clearTimeout,require:()=>({Plugin:class{},ItemView:class{async setState(){}},MarkdownRenderChild:RenderChild,Modal,Notice:class{constructor(message){notices.push(message);}},TFile:class{}})};
 vm.createContext(context);
 vm.runInContext(source+'\nthis.api={Board,MatrixView,TFile,parseBoard,addLine,editLine,buildTaskText,taskPath,EisenhowerPlugin:module.exports};',context);
 let raw='# Tasks\n\n## Do\n\n## Decide\n\n## Delegate\n\n## Delete\n',writes=0,failure=false,beforeSave=async()=>{};
 const plugin={app:{vault:{on(){return {};}}},async update(transform){writes++;await beforeSave();if(failure)throw Error('Disk unavailable');raw=transform(raw);}};
 const board=new context.api.Board(new Element(),plugin);
 board.refresh=async()=>{board.tasks=context.api.parseBoard(raw).tasks;board.render();return true;};
 board.onload();
 return {board,notices,...context.api,get raw(){return raw;},get writes(){return writes;},set failure(value){failure=value;},set beforeSave(value){beforeSave=value;}};
}
function descendants(element){return element.children.flatMap(child=>[child,...descendants(child)]);}
function byClass(element,name){return descendants(element).filter(child=>(child.className||'').split(' ').includes(name));}
function openDialog(env,quadrant=0,control=0){
 const trigger=byClass(env.board.root,'em-add-launcher')[quadrant].children[control];
 trigger.onclick();
 const dialog=env.board.dialog,form=dialog.contentEl.children[0];
 const [name,due,time]=form.querySelectorAll('input');
 return {dialog,trigger,form,name,due,time,error:dialog.contentEl.children[1],submit:()=>form.onsubmit({preventDefault(){}})};
}

test('blank bar and + open the correct quadrant and restore focus',async()=>{
 const env=setup();
 for(let quadrant=0;quadrant<4;quadrant++)for(let control=0;control<2;control++){
  const ui=openDialog(env,quadrant,control);
  assert.equal(ui.name.value,'');assert.equal(ui.name.placeholder,undefined);
  assert.equal(ui.due.value,'');assert.equal(ui.due.required,undefined);
  assert.equal(ui.time.value,'');
  ui.name.value='Task '+quadrant;
  await ui.submit();
  assert(ui.dialog.closed);assert.equal(env.board.dialog,null);assert(ui.trigger.focused);
 }
 assert.deepEqual(Array.from(env.parseBoard(env.raw).tasks,task=>task.q),['do','do','decide','decide','delegate','delegate','delete','delete']);
 assert(!env.raw.includes('^em-'));
});

test('time is a compact text field with no scroll or selection controls',async()=>{
 const env=setup(),ui=openDialog(env);assert.equal(ui.time.type,'text');assert.equal(ui.time.placeholder,'HH:mm');
 assert.equal(ui.time.onwheel,undefined);assert.equal(ui.form.querySelectorAll('select').length,0);assert.equal(byClass(ui.form,'em-time-wheel').length,0);
 ui.name.value='Exact time';ui.time.value='10:37';await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'Exact time 10:37');
});

test('midnight, last minute of day, date-only, and date with time retain Markdown format',async()=>{
 for(const time of ['', '00:00','23:59']){
  const env=setup(),ui=openDialog(env);ui.name.value='Task';ui.time.value=time;
  await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'Task'+(time?' '+time:''));
 }
 for(const time of ['', '09:30']){
  const env=setup(),ui=openDialog(env);ui.name.value='Task';ui.due.value='2026-10-25';ui.time.value=time;
  await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'Task 📅 2026-10-25'+(time?' '+time:''));
 }
});

test('empty names and invalid manual times do not save',async()=>{
 const env=setup(),ui=openDialog(env);await ui.submit();assert.equal(ui.error.textContent,'Please enter a task name.');
 ui.name.value='Time';for(const time of ['24:00','09:60','9:30','2400','1260','120','12a6']){ui.time.value=time;await ui.submit();assert.equal(env.writes,0);assert.match(ui.error.textContent,/HH:mm/);}
 ui.time.value='';await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'Time');
});

test('typing or pasting four digits formats the time and saves HH:mm',async()=>{
 for(const [typed,expected]of [['1203','12:03'],['1206','12:06'],['0000','00:00'],['0905','09:05'],['2359','23:59'],['12:06','12:06']]){
  const env=setup(),ui=openDialog(env);ui.name.value='Compact time';ui.time.value=typed;ui.time.oninput({isComposing:false});
  assert.equal(ui.time.value,expected);await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'Compact time '+expected);
 }
});

test('typing 1203 formats each keystroke immediately before saving',async()=>{
 const env=setup(),ui=openDialog(env);ui.name.value='Keyboard';
 for(const [digit,visible]of [['1','1'],['2','12:'],['0','12:0'],['3','12:03']]){
  ui.time.value+=digit;ui.time.oninput({isComposing:false});assert.equal(ui.time.value,visible);
 }
 assert.equal(env.writes,0);await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'Keyboard 12:03');
});

test('Vietnamese IME shows a formatted preview without modifying text being composed',async()=>{
 const env=setup(),ui=openDialog(env),preview=byClass(ui.form,'em-time-preview')[0];
 let raw='',writes=0;
 Object.defineProperty(ui.time,'value',{get:()=>raw,set:value=>{writes++;raw=value;}});
 ui.time.oncompositionstart();
 for(const [typed,visible]of [['1','1'],['12','12:'],['120','12:0'],['1203','12:03']]){
  raw=typed;ui.time.oninput({isComposing:true});assert.equal(raw,typed);assert.equal(preview.textContent,visible);assert.equal(writes,0);
 }
 ui.time.oncompositionend();assert.equal(raw,'1203');assert.equal(writes,0);
 raw='1203';ui.time.oninput({isComposing:false,inputType:'insertText'});assert.equal(raw,'1203');assert.equal(writes,0);
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(raw,'12:03');assert.equal(writes,1);assert.equal(preview.textContent,'');
 ui.name.value='Vietnamese keyboard';await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'Vietnamese keyboard 12:03');
});

test('IME events with an unreliable isComposing flag do not duplicate digits',async()=>{
 const env=setup(),ui=openDialog(env);ui.time.oncompositionstart();
 for(const value of ['1','12','120','1203']){ui.time.value=value;ui.time.oninput({isComposing:false});assert.equal(ui.time.value,value);}
 ui.time.oncompositionend();ui.time.value='1203';ui.time.oninput({isComposing:false});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(ui.time.value,'12:03');
});

test('IME caret follows the formatted hour and minute digits without changing the raw text',async()=>{
 const env=setup(),ui=openDialog(env),prefix=byClass(ui.form,'em-time-caret-prefix')[0];ui.time.oncompositionstart();
 for(const [raw,visiblePrefix]of [['12','12:'],['120','12:0'],['1203','12:03'],['12:03','12:03']]){
  ui.time.value=raw;ui.time.selectionStart=raw.length;ui.time.selectionEnd=raw.length;ui.time.oninput({isComposing:true});
  assert.equal(prefix.textContent,visiblePrefix);assert.equal(ui.time.value,raw);assert.equal(ui.time.selectionEnd,raw.length);
 }
 ui.time.oncompositionend();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(prefix.textContent,'');assert.equal(ui.time.value,'12:03');
});

test('moving the IME caret updates its displayed position rather than forcing it to the end',()=>{
 const env=setup(),ui=openDialog(env),prefix=byClass(ui.form,'em-time-caret-prefix')[0];ui.time.value='1203';ui.time.oncompositionstart();
 ui.time.selectionStart=3;ui.time.selectionEnd=3;ui.time.onselect();assert.equal(prefix.textContent,'12:0');
 ui.time.selectionStart=1;ui.time.selectionEnd=1;ui.time.onclick();assert.equal(prefix.textContent,'1');
 ui.time.selectionStart=2;ui.time.selectionEnd=2;ui.time.onkeyup();assert.equal(prefix.textContent,'12:');
 assert.equal(ui.time.value,'1203');assert.equal(ui.time.selectionStart,2);assert.equal(ui.time.selectionEnd,2);
 ui.dialog.close();
});

test('typing the colon with an IME still produces a single 12:03',async()=>{
 const env=setup(),ui=openDialog(env);ui.time.oncompositionstart();
 for(const value of ['1','12','12:','12:0','12:03']){ui.time.value=value;ui.time.oninput({isComposing:true});assert.equal(ui.time.value,value);}
 ui.time.oncompositionend();ui.time.oninput({isComposing:false});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(ui.time.value,'12:03');
});

test('IME Enter cannot submit the task until the time has finished committing',async()=>{
 const env=setup(),ui=openDialog(env);ui.name.value='IME Enter';ui.time.focus();ui.time.oncompositionstart();ui.time.value='1203';ui.time.oninput({isComposing:true});
 await ui.submit();assert.equal(env.writes,0);assert.equal(ui.time.value,'1203');
 ui.time.oncompositionend();await ui.submit();assert.equal(env.writes,0);
 await new Promise(resolve=>setTimeout(resolve,0));await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'IME Enter 12:03');
});

test('clicking Add task saves after leaving an IME input even if compositionend is missing',async()=>{
 for(const value of ['', '1203']){
  const env=setup(),ui=openDialog(env);ui.name.value='Click Add';ui.time.focus();ui.time.oncompositionstart();ui.time.value=value;ui.time.oninput({isComposing:true});
  ui.time.blur();byClass(ui.form,'em-save-task')[0].focus();await ui.submit();
  assert.equal(env.writes,1);assert(ui.dialog.closed);assert.equal(env.parseBoard(env.raw).tasks[0].text,'Click Add'+(value?' 12:03':''));
 }
});

test('clicking Add task during the IME commit saves once without a second click',async()=>{
 const env=setup(),ui=openDialog(env);ui.name.value='Fast click';ui.time.focus();ui.time.oncompositionstart();ui.time.value='1203';ui.time.oninput({isComposing:true});ui.time.oncompositionend();
 ui.time.blur();byClass(ui.form,'em-save-task')[0].focus();await Promise.all([ui.submit(),ui.submit()]);
 assert.equal(env.writes,1);assert(ui.dialog.closed);assert.equal(env.parseBoard(env.raw).tasks[0].text,'Fast click 12:03');
});

test('Clear and closing the modal cancel pending IME formatting',async()=>{
 for(const close of [false,true]){
  const env=setup(),ui=openDialog(env);ui.time.oncompositionstart();ui.time.value='1203';ui.time.oninput({isComposing:true});ui.time.oncompositionend();
  if(close)ui.dialog.close();else byClass(ui.form,'em-time-clear')[0].onclick();
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(ui.time.value,close?'1203':'');assert.equal(env.writes,0);
 }
});

test('Backspace can clear the time without getting trapped at the inserted colon',()=>{
 const env=setup(),ui=openDialog(env);ui.time.value='12:03';
 for(const visible of ['12:0','12:','12','1','']){
  ui.time.value=ui.time.value.slice(0,-1);ui.time.oninput({inputType:'deleteContentBackward'});assert.equal(ui.time.value,visible);
 }
});

test('autoformat keeps the caret after the typed digits',()=>{
 const env=setup(),ui=openDialog(env);ui.time.value='1203';ui.time.selectionStart=4;ui.time.selectionEnd=4;
 ui.time.setSelectionRange=(start,end)=>{ui.time.selectionStart=start;ui.time.selectionEnd=end;};
 ui.time.oninput({isComposing:false});assert.equal(ui.time.value,'12:03');assert.equal(ui.time.selectionStart,5);assert.equal(ui.time.selectionEnd,5);
 ui.time.value='12';ui.time.selectionStart=2;ui.time.selectionEnd=2;ui.time.oninput({inputType:'insertText'});
 assert.equal(ui.time.value,'12:');assert.equal(ui.time.selectionStart,3);assert.equal(ui.time.selectionEnd,3);
});

test('compact time is also accepted when submitting without an input event',async()=>{
 const env=setup(),ui=openDialog(env);ui.name.value='Direct save';ui.time.value='1206';await ui.submit();
 assert.equal(ui.time.value,'12:06');
 assert.equal(env.parseBoard(env.raw).tasks[0].text,'Direct save 12:06');
});

test('Clear removes only the time, restores focus, and allows saving without a time',async()=>{
 const env=setup(),ui=openDialog(env);ui.name.value='No time';ui.due.value='2026-10-25';ui.time.value='12:06';
 const clear=byClass(ui.form,'em-time-clear')[0];assert.equal(clear.type,'button');clear.onclick();
 assert.equal(ui.time.value,'');assert(ui.time.focused);assert.equal(ui.due.value,'2026-10-25');assert.equal(env.writes,0);
 await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'No time 📅 2026-10-25');
});

test('the calendar uses a separate centered modal and selects yyyy-mm-dd dates',async()=>{
 const env=setup(),ui=openDialog(env);assert.equal(ui.due.type,'text');assert.equal(ui.due.placeholder,'yyyy-mm-dd');
 ui.due.value='2028-02-10';byClass(ui.form,'em-date-open')[0].onclick();const calendar=ui.dialog.calendar;
 assert(calendar);assert(calendar.modalEl.className.includes('em-calendar-modal'));assert(!ui.dialog.closed);
 assert.equal(calendar.heading.textContent,'February 2028');assert.equal(byClass(calendar.days,'em-calendar-day').length,29);
 const leap=byClass(calendar.days,'em-calendar-day').find(button=>button.attributes['aria-label']==='2028-02-29');leap.onclick();
 assert.equal(ui.due.value,'2028-02-29');assert(calendar.closed);assert.equal(ui.dialog.calendar,null);
 ui.name.value='Leap day';await ui.submit();assert.equal(env.parseBoard(env.raw).tasks[0].text,'Leap day 📅 2028-02-29');
});

test('calendar navigation crosses year boundaries and keyboard navigation crosses month boundaries',()=>{
 const env=setup(),ui=openDialog(env);ui.due.value='2026-12-31';byClass(ui.form,'em-date-open')[0].onclick();const calendar=ui.dialog.calendar;
 byClass(calendar.contentEl,'em-calendar-nav')[1].onclick();assert.equal(calendar.heading.textContent,'January 2027');
 byClass(calendar.contentEl,'em-calendar-nav')[0].onclick();assert.equal(calendar.heading.textContent,'December 2026');
 byClass(calendar.days,'em-calendar-day').find(button=>button.attributes['aria-label']==='2026-12-31').onkeydown({key:'ArrowRight',preventDefault(){}});
 assert.equal(calendar.heading.textContent,'January 2027');
 const first=byClass(calendar.days,'em-calendar-day')[0];assert(first.focused);first.onclick();assert.equal(ui.due.value,'2027-01-01');
});

test('calendar cancel preserves the date, Clear removes it, and Today selects a valid date',()=>{
 const env=setup(),ui=openDialog(env),trigger=byClass(ui.form,'em-date-open')[0];ui.due.value='2026-10-25';trigger.onclick();
 ui.dialog.calendar.close();assert.equal(ui.due.value,'2026-10-25');assert(trigger.focused);
 trigger.onclick();byClass(ui.dialog.calendar.contentEl,'em-calendar-clear')[0].onclick();assert.equal(ui.due.value,'');
 trigger.onclick();byClass(ui.dialog.calendar.contentEl,'em-calendar-today')[0].onclick();assert.match(ui.due.value,/^\d{4}-\d{2}-\d{2}$/);
});

test('invalid and locale-specific date strings cannot be saved',async()=>{
 const env=setup(),ui=openDialog(env);ui.name.value='Date';
 for(const value of ['10/25/2026','2026-02-30','2026-1-1']){ui.due.value=value;await ui.submit();assert.equal(env.writes,0);assert(ui.error.textContent);}
 ui.due.value='';await ui.submit();
 assert.equal(env.parseBoard(env.raw).tasks[0].text,'Date');
});

test('save locks all fields including time and prevents duplicate submissions',async()=>{
 const env=setup(),ui=openDialog(env);let finish;
 env.beforeSave=()=>new Promise(resolve=>{finish=resolve;});ui.name.value='Once';
 const saving=ui.submit();
 assert(ui.form.querySelectorAll('input,button').every(node=>node.disabled));
 await ui.submit();await Promise.resolve();assert.equal(env.writes,1);
 finish();await saving;assert(ui.dialog.closed);assert.equal(env.parseBoard(env.raw).tasks.length,1);
});

test('failed saves preserve the task and selected time for retry',async()=>{
 const env=setup(),ui=openDialog(env);env.failure=true;ui.name.value='Retry';
 ui.time.value='09:00';await ui.submit();
 assert(!ui.dialog.closed);assert.equal(ui.name.value,'Retry');assert.equal(ui.time.value,'09:00');
 assert(ui.form.querySelectorAll('input,button').every(node=>!node.disabled));assert(ui.error.textContent);
 assert(env.notices.some(message=>message.includes('Disk unavailable')));
 env.failure=false;await ui.submit();assert(ui.dialog.closed);
 assert.equal(env.parseBoard(env.raw).tasks[0].text,'Retry 09:00');
});

test('closing the dialog does not save and unloading the board closes its dialog',()=>{
 const env=setup(),ui=openDialog(env);ui.name.value='Draft';ui.dialog.close();assert.equal(env.writes,0);
 const reopened=openDialog(env);byClass(reopened.form,'em-date-open')[0].onclick();const calendar=reopened.dialog.calendar;env.board.onunload();assert(reopened.dialog.closed);assert(calendar.closed);assert.equal(env.board.dialog,null);
});

test('invalid date/time is rejected and inline deadlines still work',()=>{
 const env=setup();
 assert.throws(()=>env.buildTaskText('Task','2026-02-30',''),/Invalid date/);
 assert.throws(()=>env.buildTaskText('Task','','24:00'),/HH:mm/);
 assert.equal(env.buildTaskText('Task [due:: 2026-10-25]','','09:30'),'Task 📅 2026-10-25 09:30');
});

test('parser and task edits preserve other content and support legacy IDs',()=>{
 const env=setup();
 const raw='---\ntitle: Tasks\n---\n## Do\n```md\n- [ ] Hidden\n```\n- [ ] Legacy ^em-123\n## Decide\n- [ ] Manual\n';
 const tasks=env.parseBoard(raw).tasks;assert.equal(tasks.length,2);assert.equal(tasks[0].text,'Legacy');
 const done=env.editLine(raw,tasks[0],true);assert(done.includes('- [x] Legacy ^em-123'));
 assert(env.editLine(raw,tasks[0],'delete').includes('- [ ] Manual'));
 assert.throws(()=>env.editLine(raw.replace('- [ ] Manual','- [ ] Changed'),tasks[1],true),/has changed/);
});

test('adding a task does not animate any quadrant',async()=>{
 for(let quadrant=0;quadrant<4;quadrant++){
  const env=setup(),ui=openDialog(env,quadrant);ui.name.value='New task';await ui.submit();
  assert([...env.board.panels.values()].every(panel=>!panel.card.animations?.length));
 }
 const env=setup(),ui=openDialog(env);env.failure=true;ui.name.value='Not saved';await ui.submit();
 assert([...env.board.panels.values()].every(panel=>!panel.card.animations?.length));
});

test('unchanged quadrant rows survive line shifts and their complete/delete actions use current lines',async()=>{
 const env=setup(),existing=openDialog(env,1);existing.name.value='Existing';await existing.submit();
 const panel=env.board.panels.get('decide'),row=panel.list.children[0],oldLine=panel.tasks[0].line;
 const other=openDialog(env,0);other.name.value='Inserted above';await other.submit();
 assert.equal(panel.list.children[0],row);assert(panel.tasks[0].line>oldLine);
 const checkbox=byClass(row,'task-cb')[0];checkbox.checked=true;await checkbox.onchange();
 assert.equal(env.parseBoard(env.raw).tasks.find(task=>task.text==='Existing').done,true);
 const animationCounts=[...env.board.panels.values()].map(p=>p.card.animations?.length||0);
 await byClass(panel.list.children[0],'task-del')[0].onclick();
 assert.equal(env.parseBoard(env.raw).tasks.length,1);assert.equal(env.parseBoard(env.raw).tasks[0].text,'Inserted above');
 assert.deepEqual([...env.board.panels.values()].map(p=>p.card.animations?.length||0),animationCounts);
});

test('repeated refreshes retain row identity and do not replay success animations',async()=>{
 const env=setup(),ui=openDialog(env);ui.name.value='Stable';await ui.submit();
 const panel=env.board.panels.get('do'),row=panel.list.children[0];
 await env.board.refresh();await env.board.refresh();assert.equal(panel.list.children[0],row);assert.equal(panel.card.animations?.length||0,0);
});

test('adding tasks ignores headings inside frontmatter and fenced examples',()=>{
 const env=setup();
 const raw='---\n## Do\ntitle: Board\n---\n```md\n## Do\n```\n## Do\n- [ ] Before\n~~~\n## Decide\n~~~\n## Decide\n';
 const saved=env.addLine(raw,'do','Visible task'),tasks=env.parseBoard(saved).tasks;
 assert.deepEqual(Array.from(tasks,task=>[task.q,task.text]),[['do','Before'],['do','Visible task']]);
 assert(saved.includes('~~~\n## Decide\n~~~'));
 const missing='```md\n## Delegate\n```\n## Do\n';
 assert.equal(env.parseBoard(env.addLine(missing,'delegate','New section')).tasks[0].q,'delegate');
});

test('unclosed code blocks or frontmatter do not silently swallow newly added tasks',()=>{
 const env=setup();
 assert.throws(()=>env.addLine('## Do\n```md\n','do','Task'),/Close the code block/);
 assert.throws(()=>env.addLine('---\ntitle: Board\n','do','Task'),/Close the frontmatter/);
});

test('an old task action cannot edit the same text after it has moved to a different quadrant',()=>{
 const env=setup();
 for(const suffix of ['', ' ^em-legacy']){
  const before='## Do\n- [ ] Repeated'+suffix+'\n## Decide\n';
  const after='## Decide\n- [ ] Repeated'+suffix+'\n## Do\n';
  const task=env.parseBoard(before).tasks[0];assert.throws(()=>env.editLine(after,task,true),/has changed/);assert.throws(()=>env.editLine(after,task,'delete'),/has changed/);
 }
});

test('replacing an inline deadline cannot leave a task with an empty name',()=>{
 const env=setup();assert.throws(()=>env.buildTaskText('📅 2026-10-25','2026-10-26',''),/task name/);
 assert.throws(()=>env.buildTaskText('[due:: 2026-10-25]','2026-10-26',''),/task name/);
});

test('fence markers with trailing text cannot expose fenced tasks or headings',()=>{
 const env=setup(),raw='## Do\n```md\n```example\n## Decide\n- [ ] Hidden\n```\n- [ ] Visible\n';
 assert.deepEqual(Array.from(env.parseBoard(raw).tasks,t=>[t.q,t.text]),[['do','Visible']]);
 assert.throws(()=>env.addLine('## Do\n```md\n```example\n','do','Task'),/Close the code block/);
});

test('adding, completing, and deleting tasks preserve CRLF line endings',()=>{
 const env=setup(),raw='# Tasks\r\n\r\n## Do\r\n- [ ] Before\r\n## Decide\r\n';
 for(const q of ['do','delegate']){
  const added=env.addLine(raw,q,'After');assert(!/(?<!\r)\n/.test(added));
  const task=env.parseBoard(added).tasks.find(t=>t.text==='After');
  assert(!/(?<!\r)\n/.test(env.editLine(added,task,true)));
  assert(!/(?<!\r)\n/.test(env.editLine(added,task,'delete')));
 }
});

test('legacy IDs tolerate line shifts but reject changed content and duplicate IDs',()=>{
 const env=setup(),raw='## Do\n- [ ] Original ^em-old\n',task=env.parseBoard(raw).tasks[0];
 assert(env.editLine('\n'+raw,task,true).includes('- [x] Original ^em-old'));
 for(const changed of [raw.replace('Original','Edited'),raw+'- [ ] Duplicate ^em-old\n']){
  assert.throws(()=>env.editLine(changed,task,true),/has changed/);
  assert.throws(()=>env.editLine(changed,task,'delete'),/has changed/);
 }
});

test('closing a dialog during a pending save does not close it twice',async()=>{
 const env=setup(),ui=openDialog(env);let finish;env.beforeSave=()=>new Promise(resolve=>{finish=resolve;});
 let closes=0;const close=ui.dialog.close.bind(ui.dialog);ui.dialog.close=()=>{closes++;close();};
 ui.name.value='Pending';const saving=ui.submit();ui.dialog.close();finish();await saving;
 assert.equal(closes,1);assert.equal(env.parseBoard(env.raw).tasks[0].text,'Pending');
});

test('a read error after an operation remains visible instead of being replaced by Saved',async()=>{
 const env=setup(),file=new env.TFile();env.board.plugin.app.vault.getAbstractFileByPath=()=>file;
 env.board.plugin.app.vault.read=async()=>{throw Error('Cannot read task file');};env.board.refresh=env.Board.prototype.refresh.bind(env.board);
 await env.board.run(async()=>{});assert.equal(env.board.label.textContent,'Error');assert.equal(env.board.status.attributes.title,'Cannot read task file');assert(env.board.dot.className.includes('error'));assert.equal(env.board.busy,false);
});

test('the board stays locked until its refresh finishes',async()=>{
 const env=setup();let finish,notifyStarted;const started=new Promise(resolve=>{notifyStarted=resolve;});
 env.board.refresh=()=>new Promise(resolve=>{finish=resolve;notifyStarted();});
 const saving=env.board.run(async()=>{});await started;assert.equal(env.board.busy,true);
 let second=false;await env.board.run(async()=>{second=true;});assert.equal(second,false);
 finish(true);await saving;assert.equal(env.board.busy,false);
});

test('an older failed read cannot overwrite the state from a newer successful refresh',async()=>{
 const env=setup(),file=new env.TFile(),reads=[];env.board.plugin.app.vault.getAbstractFileByPath=()=>file;
 env.board.plugin.app.vault.read=()=>new Promise((resolve,reject)=>reads.push({resolve,reject}));env.board.refresh=env.Board.prototype.refresh.bind(env.board);
 const first=env.board.refresh(),second=env.board.refresh();reads[1].resolve('## Do\n- [ ] Latest\n');await second;
 reads[0].reject(Error('Old failure'));await first;
 assert.equal(env.board.tasks[0].text,'Latest');assert(!env.board.label.textContent.includes('Old failure'));
});

test('light and dark text and secondary labels have at least 4.5:1 contrast on all quadrant colors',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
 const variables=block=>Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match=>[match[1],match[2].trim()]));
 const light=variables(css.match(/\.native-eisenhower, \.modal\.em-task-modal \{([^}]+)\}/)[1]);
 const dark={...light,...variables(css.match(/\.theme-dark \.native-eisenhower, \.theme-dark \.modal\.em-task-modal \{([^}]+)\}/)[1])};
 const luminance=hex=>{
  hex=hex.replace(/^var\(--[\w-]+,\s*(#[\da-f]+)\)$/i,'$1');
  const value=hex.slice(1),channels=value.length===3?[...value].map(c=>c+c):value.match(/../g);
  return channels.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
 };
 for(const [theme,palette]of [['light',light],['dark',dark]]){
  for(const background of ['--do','--decide','--delegate','--delete','--em-surface','--em-task','--em-task-hover','--em-field','--em-field-hover'])for(const foreground of ['--ink','--em-muted']){
   const a=luminance(palette[background]),b=luminance(palette[foreground]);
   assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${theme}: ${foreground} on ${background}`);
  }
  for(const quadrant of ['--do','--decide','--delegate','--delete']){
   const card=luminance(palette[quadrant]),surface=luminance(palette['--em-surface']);
   assert((Math.max(card,surface)+.05)/(Math.min(card,surface)+.05)>=(theme==='dark'?1.3:1.25),`${theme}: ${quadrant} card must stand out from dashboard`);
  }
  for(const [background,border]of [['--em-add-bg','--em-add-border'],['--em-add-hover','--em-add-border-hover']]){
   const fill=luminance(palette[background]),text=luminance(palette['--ink']),edge=luminance(palette[border]);
   assert((Math.max(fill,text)+.05)/(Math.min(fill,text)+.05)>=4.5,`${theme}: ${background} add button text contrast`);
   assert((Math.max(fill,edge)+.05)/(Math.min(fill,edge)+.05)>=3,`${theme}: ${border} add control edge contrast against fill`);
  }
  const a=luminance(palette['--ink']),b=luminance(palette['--em-check']);
  assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${theme}: checkmark and selected control text`);
 }
});


test('toolbar shows a compact save status and preserves accessible error details',async()=>{
 const env=setup(),tools=byClass(env.board.root,'matrix-tools')[0];
 assert.equal(byClass(env.board.root,'page-title').length,0);
 assert.equal(byClass(env.board.root,'page-sub').length,0);
 assert.equal(tools.children.at(-1),env.board.status);
 assert.equal(env.board.status.attributes.role,'status');
 let finish;const pending=env.board.run(()=>new Promise(resolve=>{finish=resolve;}));
 assert.equal(env.board.label.textContent,'Saving…');assert(env.board.dot.className.includes('syncing'));
 finish();await pending;assert.equal(env.board.label.textContent,'Saved');assert(env.board.dot.className.includes('connected'));
 await env.board.run(async()=>{throw Error('Disk unavailable');});
 assert.equal(env.board.label.textContent,'Error');
 assert.equal(env.board.status.attributes.title,'Save failed: Disk unavailable');
 assert.equal(env.board.status.attributes['aria-label'],'Error: Save failed: Disk unavailable');
});

async function vaultSetup(){
 const api=setup(),files=new Map(),events=new Map(),opened=[],leaves=[];
 let activeFile={path:'Projects/A/Dashboard.md'},processor;
 const emit=(name,...args)=>{for(const callback of events.get(name)||[])callback(...args);};
 const vault={
  on(name,callback){if(!events.has(name))events.set(name,[]);events.get(name).push(callback);return {};},
  getAbstractFileByPath:path=>files.get(path),
  getMarkdownFiles:()=>[...files.values()].filter(file=>file instanceof api.TFile&&file.path.endsWith('.md')),
  async read(file){return file.raw;},
  async create(path,raw){if(files.has(path))throw Error('File exists');const file=new api.TFile();Object.assign(file,{path,raw});files.set(path,file);emit('create',file);return file;},
  async process(file,transform){file.raw=transform(file.raw);emit('modify',file);}
 };
 const plugin=new api.EisenhowerPlugin();
 plugin.app={vault,workspace:{
  getActiveFile:()=>activeFile,getLeavesOfType:()=>leaves,
  getLeaf(){return {async openFile(file){opened.push(file.path);},async setViewState(state){this.view=new api.MatrixView(this,plugin);await this.view.setState(state.state,{});leaves.push(this);}};},
  async revealLeaf(leaf){this.activeLeaf=leaf;}
 }};
 plugin.registerView=()=>{};plugin.addRibbonIcon=()=>{};plugin.addCommand=()=>{};
 plugin.registerMarkdownCodeBlockProcessor=(type,callback)=>{processor=callback;};
 await plugin.onload();
 return {...api,plugin,files,opened,leaves,emit,get processor(){return processor;},set activeFile(file){activeFile=file;},
  async boardAt(sourcePath){const board=new api.Board(new Element(),plugin,sourcePath);board.onload();await board.refresh();return board;}
 };
}

test('task paths use the source note folder, including nested folders and vault root',()=>{
 const {taskPath}=setup();
 assert.equal(taskPath('Homepage.md'),'Eisenhower Tasks.md');
 assert.equal(taskPath('Projects/A/Homepage.md'),'Projects/A/Eisenhower Tasks.md');
 assert.equal(taskPath('Ghi chú/Cá nhân/Home.md'),'Ghi chú/Cá nhân/Eisenhower Tasks.md');
 assert.equal(taskPath(),'Eisenhower Tasks.md');
});

test('embedded matrices receive their own source note rather than the active note',async()=>{
 const env=await vaultSetup();let board;
 env.processor('',new Element(),{sourcePath:'Other/Matrix.md',addChild(child){board=child;}});
 assert.equal(board.path,'Other/Eisenhower Tasks.md');
});

test('two folders isolate save, complete, delete, and open-source actions',async()=>{
 const env=await vaultSetup();
 await env.plugin.app.vault.create('Eisenhower Tasks.md','## Do\n- [ ] Existing root task\n');
 await env.plugin.app.vault.create('Projects/A/Eisenhower Tasks.md','## Do\n');
 await env.plugin.app.vault.create('Projects/B/Eisenhower Tasks.md','## Do\n');
 const a=await env.boardAt('Projects/A/Dashboard.md'),b=await env.boardAt('Projects/B/Matrix.md');
 for(const [board,name]of [[a,'Task A'],[b,'Task B']]){
  const ui=openDialog({board});ui.name.value=name;ui.due.value='2026-10-25';ui.time.value='0930';await ui.submit();
 }
 assert(env.files.get(a.path).raw.includes('Task A 📅 2026-10-25 09:30'));
 assert(!env.files.get(a.path).raw.includes('Task B'));
 assert(env.files.get(b.path).raw.includes('Task B 📅 2026-10-25 09:30'));
 const row=a.panels.get('do').list.children[0],checkbox=byClass(row,'task-cb')[0];
 checkbox.checked=true;await checkbox.onchange();assert(env.files.get(a.path).raw.includes('- [x] Task A'));
 assert(env.files.get(b.path).raw.includes('- [ ] Task B'));
 await byClass(a.root,'open-source')[0].onclick();assert.equal(env.opened.at(-1),a.path);
 await byClass(a.panels.get('do').list.children[0],'task-del')[0].onclick();
 assert.equal(env.parseBoard(env.files.get(a.path).raw).tasks.length,0);
 assert(env.files.get('Eisenhower Tasks.md').raw.includes('Existing root task'));
});

test('notes in the same folder share tasks and ignore changes in other folders',async()=>{
 const env=await vaultSetup(),a=await env.boardAt('Projects/A/One.md'),b=await env.boardAt('Projects/A/Two.md');
 const ui=openDialog({board:a});ui.name.value='Shared';await ui.submit();await b.refresh();
 assert.equal(b.tasks[0].text,'Shared');
 let refreshes=0;b.refresh=async()=>{refreshes++;};
 env.emit('modify',{path:'Projects/B/Eisenhower Tasks.md'});assert.equal(refreshes,0);
 env.emit('modify',{path:a.path});assert.equal(refreshes,1);
});

test('moving a source note rebinds its board and closes a dialog for the old folder',async()=>{
 const env=await vaultSetup(),board=await env.boardAt('Projects/A/Home.md'),ui=openDialog({board});
 ui.name.value='Unsaved';env.emit('rename',{path:'Projects/B/Home.md'},'Projects/A/Home.md');
 await board.refresh();assert.equal(board.path,'Projects/B/Eisenhower Tasks.md');assert(ui.dialog.closed);
 const next=openDialog({board});next.name.value='Moved';await next.submit();
 assert(env.files.has('Projects/B/Eisenhower Tasks.md'));assert(!env.files.has('Projects/A/Eisenhower Tasks.md'));
 const file=env.files.get(board.path);env.files.delete(file.path);file.path='Archive/B/Eisenhower Tasks.md';env.files.set(file.path,file);
 env.emit('rename',{path:'Archive'},'Projects');assert.equal(board.path,'Archive/B/Eisenhower Tasks.md');
});

test('a queued write retains its target after the active note changes',async()=>{
 const env=await vaultSetup();let release;env.plugin.queue=new Promise(resolve=>{release=resolve;});
 const saving=env.plugin.update(raw=>env.addLine(raw,'do','Queued'),'Projects/A/Eisenhower Tasks.md');
 env.activeFile={path:'Projects/B/Home.md'};release();await saving;
 assert(env.files.get('Projects/A/Eisenhower Tasks.md').raw.includes('Queued'));
 assert(!env.files.has('Projects/B/Eisenhower Tasks.md'));
});

test('dedicated tabs retain folder state, reuse matching tabs, and open the correct source file',async()=>{
 const env=await vaultSetup();await env.plugin.openBoard();
 assert.equal(env.leaves.length,1);assert.equal(env.leaves[0].view.getState().sourcePath,'Projects/A/Dashboard.md');
 await env.plugin.openBoard();assert.equal(env.leaves.length,1);
 await env.plugin.openSource();assert.equal(env.opened.at(-1),'Projects/A/Eisenhower Tasks.md');
 env.plugin.app.workspace.activeLeaf=null;env.activeFile={path:'Projects/B/Home.md'};
 await env.plugin.openBoard();assert.equal(env.leaves.length,1);
 env.plugin.app.workspace.activeLeaf=null;
 await env.plugin.app.vault.create('Projects/B/Eisenhower Tasks.md','## Do\n');
 await env.plugin.openBoard();assert.equal(env.leaves.length,2);
 const restored=new env.MatrixView({},env.plugin);await restored.setState(env.leaves[1].view.getState(),{});
 assert.equal(restored.getState().sourcePath,'Projects/B/Home.md');
});

test('saving uses task-date-time order with optional fields and an inline deadline',()=>{
 const {buildTaskText}=setup();
 assert.equal(buildTaskText('Task','2026-10-25','0930'),'Task 📅 2026-10-25 09:30');
 assert.equal(buildTaskText('Task','',''),'Task');
 assert.equal(buildTaskText('Task','','0930'),'Task 09:30');
 assert.equal(buildTaskText('Task [due:: 2026-10-25]','','0930'),'Task 📅 2026-10-25 09:30');
 assert.equal(buildTaskText('Task [due:: 2026-10-25]','2026-10-26',''),'Task 📅 2026-10-26');
});

test('task discovery prefers the current folder, then nearest ancestor, then the wider vault',async()=>{
 const env=await vaultSetup(),create=(path)=>env.plugin.app.vault.create(path,'## Do\n');
 await create('Other/Eisenhower Tasks.md');
 assert.equal(env.plugin.resolveTaskPath('Projects/A/Home.md'),'Other/Eisenhower Tasks.md');
 await create('Eisenhower Tasks.md');
 assert.equal(env.plugin.resolveTaskPath('Projects/A/Home.md'),'Eisenhower Tasks.md');
 await create('Projects/Eisenhower Tasks.md');
 assert.equal(env.plugin.resolveTaskPath('Projects/A/Home.md'),'Projects/Eisenhower Tasks.md');
 await create('Projects/A/eisenhower tasks.md');
 assert.equal(env.plugin.resolveTaskPath('Projects/A/Home.md'),'Projects/A/eisenhower tasks.md');
 assert.equal(env.plugin.resolveTaskPath('projects/a/Home.md'),'Eisenhower Tasks.md');
});

test('wider-vault discovery selects a stable shallow path when several files exist',async()=>{
 const env=await vaultSetup();
 for(const path of ['Z/Deep/Eisenhower Tasks.md','Z/Eisenhower Tasks.md','A/Eisenhower Tasks.md'])await env.plugin.app.vault.create(path,'## Do\n');
 assert.equal(env.plugin.resolveTaskPath('Elsewhere/Home.md'),'A/Eisenhower Tasks.md');
});

test('concurrent first saves from different folders create and share only one task file',async()=>{
 const env=await vaultSetup(),a=await env.boardAt('Projects/A/Home.md'),b=await env.boardAt('Projects/B/Home.md');
 const one=openDialog({board:a}),two=openDialog({board:b});one.name.value='One';two.name.value='Two';
 await Promise.all([one.submit(),two.submit()]);await Promise.all([a.refresh(),b.refresh()]);
 assert.equal(env.files.size,1);assert.equal(a.path,b.path);
 assert.deepEqual(Array.from(a.tasks,t=>t.text),['One','Two']);
 assert.deepEqual(Array.from(b.tasks,t=>t.text),['One','Two']);
 const checkbox=byClass(b.panels.get('do').list.children[0],'task-cb')[0];checkbox.checked=true;await checkbox.onchange();await a.refresh();
 assert.equal(a.tasks[0].done,true);
 await byClass(b.root,'open-source')[0].onclick();assert.equal(env.opened.at(-1),a.path);
});

test('a board switches to a new local task file and falls back after it is deleted or renamed',async()=>{
 const env=await vaultSetup();await env.plugin.app.vault.create('Eisenhower Tasks.md','## Do\n- [ ] Shared\n');
 const board=await env.boardAt('Projects/A/Home.md');assert.equal(board.tasks[0].text,'Shared');
 const local=await env.plugin.app.vault.create('Projects/A/Eisenhower Tasks.md','## Do\n- [ ] Local\n');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(board.loadedPath,local.path);assert.equal(board.tasks[0].text,'Local');
 env.files.delete(local.path);env.emit('delete',local);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(board.loadedPath,'Eisenhower Tasks.md');assert.equal(board.tasks[0].text,'Shared');
 const next=await env.plugin.app.vault.create(local.path,'## Do\n- [ ] Next local\n');await new Promise(resolve=>setImmediate(resolve));
 const old=next.path;env.files.delete(old);next.path='Projects/A/Other.md';env.files.set(next.path,next);env.emit('rename',next,old);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(board.loadedPath,'Eisenhower Tasks.md');assert.equal(board.tasks[0].text,'Shared');
});

test('matrix separators are presentation only for tasks with optional date and time',async()=>{
 for(const [due,time,saved,display]of [
  ['2026-10-30','12:04','Kiểm tra 📅 2026-10-30 12:04','Kiểm tra 📅 2026-10-30 | 12:04'],
  ['2026-10-30','','Kiểm tra 📅 2026-10-30','Kiểm tra 📅 2026-10-30'],
  ['','12:04','Kiểm tra 12:04','Kiểm tra 12:04'],
  ['','','Kiểm tra','Kiểm tra']
 ]){
  const env=setup(),ui=openDialog(env);ui.name.value='Kiểm tra';ui.due.value=due;ui.time.value=time;await ui.submit();
  assert(env.raw.includes('- [ ] '+saved));assert(!env.raw.includes(' | '));
  const panel=env.board.panels.get('do');assert.equal(byClass(panel.list,'task-text')[0].textContent,display);
  const checkbox=byClass(panel.list,'task-cb')[0];checkbox.checked=true;await checkbox.onchange();
  assert(env.raw.includes('- [x] '+saved));assert(!env.raw.includes(' | '));
  assert.equal(byClass(panel.list,'task-text')[0].textContent,display);
 }
});

test('display normalizes old separators without changing saved text or ordinary task names',()=>{
 const env=setup();
 for(const [text,display]of [
  ['Kiểm tra | 📅 2026-10-30 | 12:04','Kiểm tra 📅 2026-10-30 | 12:04'],
  ['Kiểm tra | 📅 2026-10-30','Kiểm tra 📅 2026-10-30'],
  ['Kiểm tra | 12:04','Kiểm tra 12:04'],
  ['Đọc A | B','Đọc A | B'],
  ['Gặp lúc 12:04 tại văn phòng','Gặp lúc 12:04 tại văn phòng']
 ]){
  const raw='## Do\n- [ ] '+text+'\n';env.board.tasks=env.parseBoard(raw).tasks;env.board.render();
  assert.equal(byClass(env.board.root,'task-text')[0].textContent,display);
  assert.equal(env.board.tasks[0].raw,'- [ ] '+text);
 }
});
