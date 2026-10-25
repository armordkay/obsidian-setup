const {Plugin, ItemView, MarkdownRenderChild, Modal, Notice, TFile} = require('obsidian');
const TYPE='eisenhower-native-view', PATH='Eisenhower Tasks.md';
const QUADS=[['do','🚨','Do'],['decide','📅','Decide'],['delegate','🤝','Delegate'],['delete','🗑️','Delete']];
function taskPath(sourcePath=''){const slash=sourcePath.lastIndexOf('/');return (slash<0?'':sourcePath.slice(0,slash+1))+PATH;}
function parseBoard(raw){
 const lines=raw.split('\n'), tasks=[],headings=[]; let q=null, fence=null, front=lines[0]?.trim()==='---';
 lines.forEach((line,i)=>{
  const clean=line.replace(/\r$/,'');
  if(front){if(i>0&&clean.trim()==='---')front=false;return;}
  const f=clean.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if(f){if(!fence){if(f[1][0]!=='`'||!f[2].includes('`'))fence=f[1];}else if(f[1][0]===fence[0]&&f[1].length>=fence.length&&!f[2].trim())fence=null;return;}
  if(fence)return;
  const head=clean.match(/^(#{1,2})\s+(.+?)\s*$/);
  if(head){q=head[1]==='##'?QUADS.find(d=>d[0]===head[2].toLowerCase())?.[0]||null:null;headings.push({q,line:i});return;}
  const m=clean.match(/^[-*+] \[([ xX])\] (.*)$/);
  if(q&&m){const id=m[2].match(/\s+\^(em-[\w-]+)\s*$/)?.[1];tasks.push({q,line:i,raw:line,id,text:m[2].replace(/\s+\^em-[\w-]+\s*$/,''),done:m[1].toLowerCase()==='x'});}
 }); return {lines,tasks,headings,unclosed:front?'frontmatter':fence?'code block':null};
}
function addLine(raw,q,text){
 const {lines,headings,unclosed}=parseBoard(raw);const name=QUADS.find(d=>d[0]===q)[2];
 const eol=raw.includes('\r\n')?'\r\n':'\n';
 if(unclosed)throw Error('Close the '+unclosed+' before adding a task.');
 const section=headings.findIndex(heading=>heading.q===q);
 const line='- [ ] '+text;
 if(section<0){return raw.replace(/\s*$/,'')+eol+eol+'## '+name+eol+line+eol;}
 const index=headings[section+1]?.line??(lines.length-(lines.at(-1)===''?1:0));
 lines.splice(index,0,line);return lines.map(value=>value.replace(/\r$/,'')).join(eol);
}
function editLine(raw,task,action){
 const data=parseBoard(raw);const matches=task.id?data.tasks.filter(t=>t.id===task.id):[];
 const current=task.id?(matches.length===1&&matches[0].q===task.q&&matches[0].raw===task.raw?matches[0]:null):data.tasks.find(t=>t.q===task.q&&t.line===task.line&&t.raw===task.raw);
 if(!current)throw Error('This task has changed. Please try again.');
 if(action==='delete')data.lines.splice(current.line,1);
 else data.lines[current.line]=current.raw.replace(/^(\s*[-*+] \[)[ xX](\])/,'$1'+(action?'x':' ')+'$2');
 return data.lines.join('\n');
}
function formatTime(value){return value.replace(/^(\d{2})(\d{0,2})$/,'$1:$2');}
function buildTaskText(name,due,time){
 time=formatTime(time.trim());
 let text=name.trim().replace(/[\r\n]+/g,' ').replace(/\[due::\s*(\d{4}-\d{2}-\d{2})\s*\]/g,'📅 $1');
 if(!text)throw Error('Please enter a task name.');
 due=due||text.match(/📅\s*(\d{4}-\d{2}-\d{2})/)?.[1]||'';
 if(due){const m=due.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)throw Error('Use YYYY-MM-DD for the date.');const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));if(d.getFullYear()!==Number(m[1])||d.getMonth()!==Number(m[2])-1||d.getDate()!==Number(m[3]))throw Error('Invalid date.');text=text.replace(/\s*📅\s*\d{4}-\d{2}-\d{2}/g,'').trim();}
 if(!text)throw Error('Please enter a task name.');
 if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Use HH:mm for the time.');
 return [text,due?'📅 '+due:'',time].filter(Boolean).join(' ');
}
function formatTaskDisplay(text){
 const dated=text.match(/^(.*?)\s+(?:\|\s*)?📅\s*(\d{4}-\d{2}-\d{2})(?:\s+(?:\|\s*)?((?:[01]\d|2[0-3]):[0-5]\d))?$/);
 if(dated&&dated[1].trim())return dated[1].trim()+' 📅 '+dated[2]+(dated[3]?' | '+dated[3]:'');
 const timed=text.match(/^(.+?)\s+\|\s*((?:[01]\d|2[0-3]):[0-5]\d)$/);
 if(timed)return timed[1].trim()+' '+timed[2];
 return text;
}
function element(tag,parent,text,cls){const e=parent.ownerDocument.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;parent.appendChild(e);return e;}
function dateText(date){return String(date.getFullYear()).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
class DatePickerModal extends Modal{
 constructor(app,value,onSelect,onClose){
  super(app);this.selected=value;this.onSelect=onSelect;this.afterClose=onClose;
  let date;try{buildTaskText('Date',value,'');date=value?new Date(value+'T00:00:00'):new Date();}catch{date=new Date();}
  this.month=new Date(date.getFullYear(),date.getMonth(),1);this.initialDate=dateText(date);
 }
 onOpen(){
  this.modalEl.classList.add('em-task-modal','em-calendar-modal');this.modalEl.setAttribute('aria-label','Choose due date');
  this.contentEl.classList.add('native-eisenhower','em-calendar-dialog');
  const header=element('div',this.contentEl,undefined,'em-calendar-header');
  const prev=element('button',header,'‹','em-calendar-nav');prev.type='button';prev.setAttribute('aria-label','Previous month');prev.onclick=()=>this.moveMonth(-1);
  this.heading=element('h2',header,'','em-calendar-heading');this.heading.setAttribute('aria-live','polite');
  const next=element('button',header,'›','em-calendar-nav');next.type='button';next.setAttribute('aria-label','Next month');next.onclick=()=>this.moveMonth(1);
  const week=element('div',this.contentEl,undefined,'em-calendar-week');for(const day of ['Su','Mo','Tu','We','Th','Fr','Sa'])element('span',week,day);
  this.days=element('div',this.contentEl,undefined,'em-calendar-days');this.days.setAttribute('role','group');this.days.setAttribute('aria-label','Days');
  const footer=element('div',this.contentEl,undefined,'em-calendar-footer');
  const today=element('button',footer,'Today','em-calendar-today');today.type='button';today.onclick=()=>this.choose(dateText(new Date()));
  const clear=element('button',footer,'Clear','em-calendar-clear');clear.type='button';clear.onclick=()=>this.choose('');
  this.render(this.initialDate);
 }
 moveMonth(delta){this.month=new Date(this.month.getFullYear(),this.month.getMonth()+delta,1);this.render();}
 choose(value){this.onSelect(value);this.close();}
 render(focusDate){
  const year=this.month.getFullYear(),month=this.month.getMonth();
  this.heading.textContent=this.month.toLocaleDateString('en-US',{month:'long',year:'numeric'});this.days.replaceChildren();
  for(let i=0;i<this.month.getDay();i++)element('span',this.days,'').setAttribute('aria-hidden','true');
  const today=dateText(new Date());
  for(let day=1;day<=new Date(year,month+1,0).getDate();day++){
   const date=new Date(year,month,day),value=dateText(date),button=element('button',this.days,String(day),'em-calendar-day');button.type='button';
   button.setAttribute('aria-label',value);button.setAttribute('aria-pressed',String(value===this.selected));if(value===today)button.setAttribute('aria-current','date');
   button.onclick=()=>this.choose(value);
   button.onkeydown=event=>{
    const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};let offset;
    if(event.key in offsets)offset=offsets[event.key];else if(event.key==='Home')offset=-date.getDay();else if(event.key==='End')offset=6-date.getDay();else return;
    event.preventDefault();const target=new Date(year,month,day+offset);this.month=new Date(target.getFullYear(),target.getMonth(),1);this.render(dateText(target));
   };
   if(value===focusDate)button.focus();
  }
 }
 onClose(){this.contentEl.replaceChildren();this.afterClose();}
}
class AddTaskModal extends Modal{
 constructor(board,q,title,trigger){super(board.plugin.app);this.board=board;this.q=q;this.title=title;this.trigger=trigger;this.saving=false;}
 onOpen(){
  this.modalEl.classList.add('em-task-modal','em-task-modal-'+this.q);
  this.contentEl.classList.add('native-eisenhower','em-task-dialog','q-'+this.q);
  this.modalEl.setAttribute('aria-label','Add task — '+this.title);
  const form=element('form',this.contentEl,undefined,'add-row');
  const nameLabel=element('label',form,undefined,'em-field em-name-field');
  element('span',nameLabel,'Task','em-field-label');
  const input=element('input',nameLabel,undefined,'add-input');input.type='text';input.maxLength=250;input.required=true;
  const dateLabel=element('label',form,undefined,'em-field em-date-field');element('span',dateLabel,'Due date (optional)','em-field-label');
  const dateControl=element('div',dateLabel,undefined,'em-date-control');
  const due=element('input',dateControl,undefined,'add-input em-date');due.type='text';due.placeholder='yyyy-mm-dd';due.maxLength=10;due.autocomplete='off';due.setAttribute('aria-label','Due date (yyyy-mm-dd, optional)');
  const calendar=element('button',dateControl,'📅','em-date-open');calendar.type='button';calendar.setAttribute('aria-label','Open date picker');calendar.setAttribute('aria-haspopup','dialog');
  calendar.onclick=()=>{
   if(this.calendar||this.saving||this.board.dead)return;
   this.calendar=new DatePickerModal(this.board.plugin.app,due.value.trim(),value=>{due.value=value;},()=>{this.calendar=null;if(!this.closing&&!this.board.dead)calendar.focus();});this.calendar.open();
  };
  const timeLabel=element('label',form,undefined,'em-field em-time-field');element('span',timeLabel,'Time (optional)','em-field-label');
  const timeControl=element('div',timeLabel,undefined,'em-time-control');
  const time=element('input',timeControl,undefined,'add-input em-time');time.type='text';time.inputMode='numeric';time.placeholder='HH:mm';time.maxLength=5;time.autocomplete='off';time.setAttribute('aria-label','Time (HH:mm or HHmm, optional)');
  const timePreview=element('span',timeControl,'','em-time-preview');timePreview.setAttribute('aria-hidden','true');
  const timeCaret=element('span',timeControl,undefined,'em-time-caret');timeCaret.setAttribute('aria-hidden','true');
  const caretPrefix=element('span',timeCaret,'','em-time-caret-prefix');
  let composingTime=false,committingTime=false;
  const timePosition=position=>position+(formatTime(time.value)!==time.value&&position>=2?1:0);
  const previewTime=()=>{
   const active=composingTime||committingTime;timeControl.classList.toggle('is-composing',active);
   const formatted=active?formatTime(time.value):'';timePreview.textContent=formatted;
   const position=time.selectionDirection==='backward'?time.selectionStart:time.selectionEnd;
   caretPrefix.textContent=active?formatted.slice(0,timePosition(typeof position==='number'?position:time.value.length)):'';
  };
  const formatTimeInput=()=>{
   if(composingTime||committingTime){previewTime();return;}
   const formatted=formatTime(time.value);if(formatted===time.value)return;
   const start=time.selectionStart,end=time.selectionEnd;
   const mappedStart=typeof start==='number'?timePosition(start):null,mappedEnd=typeof end==='number'?timePosition(end):null;
   time.value=formatted;if(mappedStart!==null&&mappedEnd!==null)time.setSelectionRange(mappedStart,mappedEnd);
  };
  time.oncompositionstart=()=>{clearTimeout(this.timeFormatTimer);composingTime=true;committingTime=false;previewTime();};
  time.oninput=event=>{if(event.isComposing)composingTime=true;if(composingTime||committingTime){previewTime();return;}if(event.inputType?.startsWith('delete')&&/^\d{2}$/.test(time.value))return;formatTimeInput();};
  const commitTimeInput=()=>{
   composingTime=false;committingTime=true;previewTime();clearTimeout(this.timeFormatTimer);
   // Leave the input untouched until the IME's final input event has committed.
   this.timeFormatTimer=setTimeout(()=>{this.timeFormatTimer=null;if(this.closing)return;if(!composingTime){committingTime=false;previewTime();formatTimeInput();}},0);
  };
  time.oncompositionend=commitTimeInput;
  time.onblur=()=>{if(composingTime||committingTime)commitTimeInput();else formatTimeInput();};
  time.onselect=previewTime;time.onclick=previewTime;time.onkeyup=previewTime;
  const clearTime=element('button',timeControl,'Clear','em-time-clear');clearTime.type='button';clearTime.setAttribute('aria-label','Clear time');clearTime.onclick=()=>{clearTimeout(this.timeFormatTimer);composingTime=false;committingTime=false;time.value='';previewTime();time.focus();};
  const add=element('button',form,'Add task','em-save-task');add.type='submit';add.setAttribute('aria-label','Save task');
  add.onpointerdown=()=>time.blur();
  const error=element('p',this.contentEl,'','em-form-error');error.setAttribute('role','alert');
  const lockForm=disabled=>{for(const node of form.querySelectorAll('input,button'))node.disabled=disabled;};
  form.onsubmit=async event=>{
   event.preventDefault();if(this.saving||this.closing||this.board.busy||this.board.dead)return;
   // Enter confirming an IME composition is not an explicit save request.
   if((composingTime||committingTime)&&time.ownerDocument.activeElement===time)return;
   this.saving=true;
   try{
    if(composingTime||committingTime){
     lockForm(true);await new Promise(resolve=>setTimeout(resolve,0));
     if(this.closing||this.board.dead)return;
     clearTimeout(this.timeFormatTimer);composingTime=false;committingTime=false;previewTime();
    }
    formatTimeInput();
    let text;try{text=buildTaskText(input.value,due.value.trim(),time.value.trim());}catch(e){error.textContent=e.message;return;}
    error.textContent='';lockForm(true);let saved=false;
    const path=this.board.path,sourcePath=this.board.sourcePath;
    await this.board.run(async()=>{await this.board.plugin.update(raw=>addLine(raw,this.q,text),path,sourcePath);saved=true;});
    if(saved){if(!this.closing)this.close();}else error.textContent='Could not save the task. Please try again.';
   }finally{this.saving=false;lockForm(false);}
  };
  input.focus();
 }
 onClose(){this.closing=true;clearTimeout(this.timeFormatTimer);this.calendar?.close();this.contentEl.replaceChildren();if(this.board.dialog===this)this.board.dialog=null;if(!this.board.dead&&this.trigger.isConnected)this.trigger.focus();}
}
class Board extends MarkdownRenderChild{
 constructor(container,plugin,sourcePath=''){super(container);this.plugin=plugin;this.sourcePath=sourcePath;this.busy=false;this.revision=0;this.tasks=[];this.panels=new Map();this.dead=false;}
 get path(){return this.plugin.resolveTaskPath?this.plugin.resolveTaskPath(this.sourcePath):taskPath(this.sourcePath);}
 setSourcePath(sourcePath){if(sourcePath===this.sourcePath)return;this.dialog?.close();this.sourcePath=sourcePath;this.refresh();}
 onload(){
 const root=element('div',this.containerEl,undefined,'native-eisenhower');this.root=root;
 const tools=element('div',root,undefined,'matrix-tools');
 const open=element('button',tools,'↗ Open task file','open-source');open.onclick=()=>this.run(()=>this.plugin.openSource(this.path,this.sourcePath));
 this.status=element('div',tools,undefined,'em-sync-status');this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
 this.dot=element('span',this.status,undefined,'sync-dot');this.dot.setAttribute('aria-hidden','true');this.label=element('span',this.status,'Loading');
 const surface=element('div',root,undefined,'em-matrix-surface');
 const wrapper=element('div',surface,undefined,'matrix-wrapper');const ax=element('div',wrapper,undefined,'axis-x');element('span',ax,'Urgent');element('span',ax,'Not Urgent');
 const wrap=element('div',wrapper,undefined,'axis-y-wrap');const ay=element('div',wrap,undefined,'axis-y');element('span',ay,'Important');element('span',ay,'Not Important');const grid=element('div',wrap,undefined,'matrix-grid');
 for(const [q,icon,title]of QUADS){
  const card=element('section',grid,undefined,'quadrant q-'+q);element('div',card,icon,'q-icon');element('div',card,title,'q-title');const list=element('div',card,undefined,'task-list');
  const launcher=element('div',card,undefined,'em-add-launcher');
  const blank=element('button',launcher,'','em-add-placeholder');blank.type='button';blank.setAttribute('aria-label',title+' — add task');blank.setAttribute('aria-haspopup','dialog');
  const add=element('button',launcher,'+','add-btn');add.type='button';add.setAttribute('aria-label',title+' — add task');add.setAttribute('aria-haspopup','dialog');
  const openDialog=trigger=>{if(this.busy||this.dead||this.dialog)return;this.dialog=new AddTaskModal(this,q,title,trigger);this.dialog.open();};
  blank.onclick=()=>openDialog(blank);add.onclick=()=>openDialog(add);
  this.panels.set(q,{card,list});
 }
 this.registerEvent(this.plugin.app.vault.on('modify',file=>{if(file.path===this.path)this.refresh();}));
 this.registerEvent(this.plugin.app.vault.on('create',file=>{if(file.path===this.path||this.loadedPath!==this.path)this.refresh();}));
 this.registerEvent(this.plugin.app.vault.on('delete',file=>{if(file.path===this.loadedPath||file.path===this.path||this.loadedPath!==this.path)this.refresh();}));
 this.registerEvent(this.plugin.app.vault.on('rename',(file,old)=>{
  if(this.sourcePath===old||this.sourcePath.startsWith(old+'/')){this.setSourcePath(file.path+this.sourcePath.slice(old.length));return;}
  if(old===this.loadedPath||file.path===this.path||this.loadedPath!==this.path)this.refresh();
 }));
 this.refresh();
 }
 state(msg,error=false){this.label.textContent=error?'Error':msg;this.status.setAttribute('title',msg);this.status.setAttribute('aria-label',error?'Error: '+msg:msg);this.status.className='em-sync-status'+(error?' is-error':'');this.dot.className='sync-dot '+(error?'error':this.busy?'syncing':'connected');}
 async refresh(){const token=++this.revision,path=this.path;try{const file=this.plugin.app.vault.getAbstractFileByPath(path);if(file&&!(file instanceof TFile))throw Error(path+' is not a file.');const raw=file?await this.plugin.app.vault.read(file):'';if(this.dead||token!==this.revision)return false;this.loadedPath=path;this.tasks=parseBoard(raw).tasks;this.render();if(!this.busy)this.state('Saved');return true;}catch(e){if(!this.dead&&token===this.revision)this.state(e.message,true);return false;}}
 lock(){for(const node of this.root.querySelectorAll('input,button'))node.disabled=this.busy;}
 async run(action){
  if(this.busy||this.dead)return;this.busy=true;this.lock();this.state('Saving…');let failure;
  try{await action();}catch(e){failure=e;new Notice('Could not save: '+e.message);}
  finally{
   let refreshed=false;
   try{if(!this.dead)refreshed=await this.refresh();}
   finally{this.busy=false;if(!this.dead){this.lock();if(failure||refreshed)this.state(failure?'Save failed: '+failure.message:'Saved',!!failure);}}
  }
 }
 render(){
  for(const[q,p]of this.panels){
   const tasks=this.tasks.filter(t=>t.q===q);p.tasks=tasks;
   const signature=JSON.stringify(tasks.map(task=>task.raw));if(p.signature===signature)continue;p.signature=signature;
   p.list.replaceChildren();if(!tasks.length)element('div',p.list,'No tasks yet','empty-hint');
   tasks.forEach((task,index)=>{
    const row=element('div',p.list,undefined,'task-item'+(task.done?' done':''));
    const cb=element('input',row,undefined,'task-cb');cb.type='checkbox';cb.checked=task.done;cb.disabled=this.busy;cb.setAttribute('aria-label','Complete: '+task.text);
    cb.onchange=()=>{const done=cb.checked,current=p.tasks[index],path=this.loadedPath??this.path;return this.run(()=>this.plugin.update(raw=>editLine(raw,current,done),path));};
    element('span',row,formatTaskDisplay(task.text),'task-text');
    const del=element('button',row,'✕','task-del');del.title='Delete';del.disabled=this.busy;del.setAttribute('aria-label','Delete: '+task.text);
    del.onclick=()=>{const current=p.tasks[index],path=this.loadedPath??this.path;return this.run(()=>this.plugin.update(raw=>editLine(raw,current,'delete'),path));};
   });
  }
 }
 onunload(){this.dead=true;this.revision++;this.dialog?.close();this.root?.remove();}
}
class MatrixView extends ItemView{
 constructor(leaf,plugin){super(leaf);this.plugin=plugin;}
 getViewType(){return TYPE;}getDisplayText(){return 'Eisenhower Matrix';}getIcon(){return 'layout-grid';}
 getState(){return {sourcePath:this.board?.sourcePath??this.sourcePath??''};}
 async setState(state,result){this.sourcePath=typeof state?.sourcePath==='string'?state.sourcePath:'';this.board?.setSourcePath(this.sourcePath);await super.setState(state,result);}
 async onOpen(){this.contentEl.classList.add('em-board-view');this.contentEl.replaceChildren();this.board=new Board(this.contentEl,this.plugin,this.sourcePath??this.plugin.app.workspace.getActiveFile()?.path??'');this.addChild(this.board);}
 async onClose(){if(this.board)this.removeChild(this.board);this.contentEl.classList.remove('em-board-view');}
}
module.exports=class EisenhowerPlugin extends Plugin{
 async onload(){
 this.queue=Promise.resolve();this.registerView(TYPE,leaf=>new MatrixView(leaf,this));
 this.addRibbonIcon('layout-grid','Eisenhower Matrix',()=>this.openBoard());
 this.addCommand({id:'open-eisenhower',name:'Open Eisenhower Matrix',callback:()=>this.openBoard()});
 this.addCommand({id:'open-eisenhower-source',name:'Open task Markdown file',callback:()=>this.openSource()});
 this.registerMarkdownCodeBlockProcessor('eisenhower',(source,el,ctx)=>{el.classList.add('em-board-embed');ctx.addChild(new Board(el,this,ctx.sourcePath));});
 }
 resolveTaskPath(sourcePath=''){
  const vault=this.app.vault,local=taskPath(sourcePath);
  const candidates=vault.getMarkdownFiles().filter(file=>file.path.split('/').pop().toLowerCase()===PATH.toLowerCase());
  let folder=local.slice(0,-PATH.length);
  while(true){
   const path=folder+PATH;
   if(vault.getAbstractFileByPath(path))return path;
   const match=candidates.find(file=>file.path.slice(0,file.path.lastIndexOf('/')+1)===folder);if(match)return match.path;
   if(!folder)break;const parent=folder.slice(0,-1).lastIndexOf('/');folder=parent<0?'':folder.slice(0,parent+1);
  }
  candidates.sort((a,b)=>a.path.split('/').length-b.path.split('/').length||(a.path<b.path?-1:a.path>b.path?1:0));
  return candidates[0]?.path||local;
 }
 async ensure(path){const vault=this.app.vault;let file=vault.getAbstractFileByPath(path);if(!file){try{file=await vault.create(path,'# Eisenhower Tasks\n\n## Do\n\n## Decide\n\n## Delegate\n\n## Delete\n');}catch(e){file=vault.getAbstractFileByPath(path);if(!file)throw e;}}if(!(file instanceof TFile))throw Error(path+' is not a file.');return file;}
 update(transform,path,sourcePath){const action=this.queue.then(async()=>{const file=await this.ensure(sourcePath===undefined?path:this.resolveTaskPath(sourcePath));return this.app.vault.process(file,transform);});this.queue=action.catch(()=>{});return action;}
 activeSourcePath(){const view=this.app.workspace.activeLeaf?.view;return view instanceof MatrixView?view.getState().sourcePath:this.app.workspace.getActiveFile()?.path||'';}
 async openSource(path=this.resolveTaskPath(this.activeSourcePath()),sourcePath=this.activeSourcePath()){try{const action=this.queue.then(()=>this.ensure(this.app.vault.getAbstractFileByPath(path)?path:this.resolveTaskPath(sourcePath)));this.queue=action.catch(()=>{});const file=await action;await this.app.workspace.getLeaf(false).openFile(file);}catch(e){new Notice(e.message);}}
 async openBoard(){const sourcePath=this.activeSourcePath(),path=this.resolveTaskPath(sourcePath);let leaf=this.app.workspace.getLeavesOfType(TYPE).find(leaf=>this.resolveTaskPath(leaf.view.getState().sourcePath)===path);if(!leaf){leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:TYPE,active:true,state:{sourcePath}});}await this.app.workspace.revealLeaf(leaf);}
};
