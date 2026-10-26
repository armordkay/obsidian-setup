const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class Element {
 constructor(tag='div', doc) {
  this.tag=tag; this.children=[]; this.attributes={}; this.value=''; this.disabled=false;
  this.textContent=''; this.listeners={}; this.style={};
  this.ownerDocument=doc||{createElement:tag=>new Element(tag,this.ownerDocument),createElementNS:(_,tag)=>new Element(tag,this.ownerDocument),activeElement:null};
  this.classList={add:(...items)=>{this.className=[this.className||'',...items].join(' ');},remove:item=>{this.className=(this.className||'').split(' ').filter(x=>x!==item).join(' ');},toggle:(item,on)=>{this.classList.remove(item);if(on)this.classList.add(item);}};
 }
 appendChild(el){this.children.push(el);return el;}
 replaceChildren(...els){this.children=els;}
 setAttribute(k,v){this.attributes[k]=String(v);}
 removeAttribute(k){delete this.attributes[k];}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(x=>x!==fn);}
 dispatch(k){for(const fn of this.listeners[k]||[])fn({preventDefault(){}});}
 focus(){this.ownerDocument.activeElement=this;}
 remove(){this.removed=true;}
}
class Component {
 constructor(){this.cleanups=[];this.children=[];}
 register(fn){this.cleanups.push(fn);}
 registerDomEvent(el,key,fn){el.addEventListener(key,fn);this.register(()=>el.removeEventListener(key,fn));}
 addChild(child){this.children.push(child);child.onload?.();return child;}
 removeChild(child){child.onunload?.();for(const fn of child.cleanups||[])fn();this.children=this.children.filter(x=>x!==child);}
}
function setup() {
 let now=0;const notices=[],intervals=new Map();let nextInterval=0;
 class Plugin extends Component {
  constructor(){super();this.saved=[];this.commands=[];this.app={workspace:{getLeavesOfType:()=>[],getLeaf:()=>({setViewState:async state=>{this.openState=state;}}),revealLeaf:async()=>{}}};}
  async loadData(){if(this.loadFailure)throw Error('read failed');return this.data||null;}
  async saveData(data){await this.beforeSave?.(data);if(this.saveFailure)throw Error('disk unavailable');this.saved.push(data);}
  registerView(type,factory){this.viewType=type;this.viewFactory=factory;}
  registerMarkdownCodeBlockProcessor(type,callback){this.blockType=type;this.blockCallback=callback;}
  addRibbonIcon(icon,label,callback){this.ribbon=callback;}
  addCommand(command){this.commands.push(command);}
  registerInterval(id){this.register(()=>intervals.delete(id));}
 }
 class ItemView extends Component {constructor(leaf){super();this.leaf=leaf;this.contentEl=new Element();}}
 class MarkdownRenderChild extends Component {constructor(el){super();this.containerEl=el;}}
 const context={module:{exports:{}},Date:class extends Date{static now(){return now;}},setInterval:fn=>{intervals.set(++nextInterval,fn);return nextInterval;},clearInterval:id=>intervals.delete(id),require:()=>({Plugin,ItemView,MarkdownRenderChild,Notice:class{constructor(text){notices.push(text);}}})};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nthis.api={Timer,formatTime,PomodoroBoard,PomodoroView,PomodoroPlugin:module.exports};',context);
 return {...context.api,notices,intervals,get now(){return now;},set now(value){now=value;},advance(ms){now+=ms;},plain:value=>JSON.parse(JSON.stringify(value))};
}
function descendants(el){return el.children.flatMap(x=>[x,...descendants(x)]);}
function byClass(el,name){return descendants(el).filter(x=>(x.className||'').split(' ').includes(name));}
function board(env,plugin){const b=new env.PomodoroBoard(new Element(),plugin);b.onload();return b;}

test('default timer and second rounding',()=>{
 const e=setup(),t=new e.Timer();assert.equal(e.formatTime(t.getState().remainingMs),'25:00');
 for(const [ms,expected] of [[60001,'01:01'],[60000,'01:00'],[1,'00:01'],[0,'00:00'],[10800000,'180:00']])assert.equal(e.formatTime(ms),expected);
});
test('pause preserves milliseconds and resume gets a fresh deadline',()=>{
 const e=setup(),t=new e.Timer();t.start();e.advance(1234);t.pause();assert.equal(t.getState().remainingMs,1498766);
 e.advance(900000);assert.equal(t.getState().remainingMs,1498766);t.start();e.advance(1498765);t.tick();assert.equal(t.getState().phase,'focus');e.advance(1);t.tick();assert.equal(t.getState().phase,'break');
});
test('late ticks and sleep use the original break deadline',()=>{
 const e=setup(),t=new e.Timer();t.start();e.advance(1560000);t.tick();assert.equal(t.getState().phase,'break');assert.equal(t.getState().remainingMs,240000);assert.equal(t.getState().endTime,1800000);
 e.advance(1000000);t.tick();assert.equal(t.getState().phase,'focus');assert.equal(t.getState().status,'ready');assert.equal(t.getState().remainingMs,1500000);
});
test('pausing at the focus boundary pauses the break',()=>{
 const e=setup(),t=new e.Timer();t.start();e.advance(1500000);t.pause();assert.equal(t.getState().phase,'break');assert.equal(t.getState().status,'paused');assert.equal(t.getState().remainingMs,300000);
});
test('duration validation and reset do not silently alter an active session',()=>{
 const e=setup(),t=new e.Timer();
 for(const value of [0,-1,181,NaN,Infinity,1.5,'25',null])assert.throws(()=>t.setDurations(value,5));
 t.setDurations(180,1);assert.equal(t.getState().remainingMs,10800000);t.start();assert.throws(()=>t.setDurations(1,1));t.pause();assert.throws(()=>t.setDurations(1,1));
 t.reset();assert.equal(t.getState().status,'ready');t.setDurations(1,2);assert.equal(t.getState().remainingMs,60000);
});
test('running and paused snapshots restore and invalid data falls back',()=>{
 const e=setup(),t=new e.Timer();t.start();e.advance(40000);
 let data=e.plain(t.serialize());e.advance(20000);let r=new e.Timer(data.settings,data.timer);assert.equal(r.getState().remainingMs,1440000);
 r.pause();data=e.plain(r.serialize());e.advance(5000000);r=new e.Timer(data.settings,data.timer);assert.equal(r.getState().status,'paused');assert.equal(r.getState().remainingMs,1440000);
 for(const snapshot of [null,{},[],{phase:'break',status:'running',endTime:'bad',remainingMs:100},{phase:'focus',status:'paused',remainingMs:-1},{phase:'break',status:'ready',remainingMs:1}]){
  const safe=new e.Timer({focusMinutes:0,breakMinutes:Infinity},snapshot);assert.equal(safe.getState().status,'ready');assert.equal(safe.getState().remainingMs,1500000);
 }
});
test('restoring after both phases finishes returns to a fresh ready session',()=>{
 const e=setup(),t=new e.Timer();t.start();const data=e.plain(t.serialize());e.advance(9000000);
 const r=new e.Timer(data.settings,data.timer);assert.equal(r.getState().status,'ready');assert.equal(r.getState().phase,'focus');
});
test('snapshot captured exactly on the deadline still starts the break',()=>{
 const e=setup(),t=new e.Timer();t.start();e.advance(1500000);const data=e.plain(t.serialize());
 assert.equal(data.timer.remainingMs,0);const r=new e.Timer(data.settings,data.timer);assert.equal(r.getState().phase,'break');assert.equal(r.getState().remainingMs,300000);
});
test('two boards share state, controls and duration changes',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const a=board(e,p),b=board(e,p);
 a.focusInput.value='30';a.breakInput.value='7';a.focusInput.dispatch('change');assert.equal(p.timer.getState().focusMinutes,30);assert.equal(b.focusInput.value,'30');
 a.startButton.dispatch('click');assert.equal(b.startButton.textContent,'Tạm dừng');assert(a.focusInput.disabled);e.advance(1000);p.timer.tick();assert.equal(b.display.attributes['aria-label'],'29 phút 59 giây');
 b.startButton.dispatch('click');assert.equal(a.startButton.textContent,'Tiếp tục');a.resetButton.dispatch('click');assert.equal(b.startButton.textContent,'Bắt đầu');
});
test('invalid draft blocks starting and reset clears it',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const b=board(e,p);
 b.focusInput.value='';b.focusInput.dispatch('input');b.startButton.dispatch('click');assert.equal(p.timer.getState().status,'ready');assert.equal(b.focusInput.attributes['aria-invalid'],'true');assert(b.message.textContent);
 b.resetButton.dispatch('click');assert.equal(b.focusInput.value,'25');assert.equal(b.focusInput.attributes['aria-invalid'],undefined);
});
test('all digit segments exist and inactive segments are decorative',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const b=board(e,p);
 assert.equal(b.digitNodes.length,4);assert.equal(b.digitNodes[0].paths.length,7);
 assert.equal(b.svg.attributes['aria-hidden'],'true');assert.equal(b.display.attributes['aria-label'],'25 phút 00 giây');
 const before=b.startButton;p.timer.start();e.advance(1000);p.timer.tick();assert.equal(b.startButton,before);
});
test('closing a board removes its subscription and does not stop the shared clock',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const a=board(e,p),b=board(e,p);
 a.onunload();assert(!p.boards.has(a));p.timer.start();e.advance(1000);p.timer.tick();assert.equal(b.display.attributes['aria-label'],'24 phút 59 giây');
 p.onunload();for(const fn of p.cleanups)fn();assert.equal(e.intervals.size,0);assert.equal(p.timer.listeners.size,0);
});
test('failed saves show recovery and later saves clear the error',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const b=board(e,p);p.saveFailure=true;p.timer.start();await p.saveQueue;
 assert(p.storageError);assert(!b.retryButton.hidden);p.saveFailure=false;await p.persist();assert.equal(p.storageError,'');assert(b.retryButton.hidden);
});
test('save queue serializes rapid actions with the latest state last',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();let release,entered;
 const gate=new Promise(resolve=>{release=resolve;});const started=new Promise(resolve=>{entered=resolve;});
 let first=true;p.beforeSave=async()=>{if(first){first=false;entered();await gate;}};
 p.timer.start();await started;e.advance(1000);p.timer.pause();p.timer.reset();assert.equal(p.saved.length,0);release();await p.saveQueue;
 assert.equal(p.saved.length,3);assert.equal(p.saved.at(-1).timer.status,'ready');assert.equal(p.saved.at(-1).timer.remainingMs,1500000);
});
test('load failure is visible and saved versions are checked',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();p.loadFailure=true;await p.onload();assert(p.storageError);assert.equal(p.timer.getState().focusMinutes,25);
 const q=new e.PomodoroPlugin();q.data={version:99,settings:{focusMinutes:1,breakMinutes:1}};await q.onload();assert.equal(q.timer.getState().focusMinutes,25);assert(q.storageError);
});
test('plugin registers commands, embed and reusable dedicated view',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();assert.equal(p.blockType,'pomodoro');assert.equal(p.commands.length,3);
 const parent=new Component(),el=new Element();p.blockCallback('',el,parent);assert.equal(parent.children.length,1);
 await p.openDashboard();assert.equal(p.openState.type,'pomodoro-view');
 const view=p.viewFactory({});await view.onOpen();assert.equal(view.getViewType(),'pomodoro-view');await view.onClose();assert.equal(view.children.length,0);
});
test('reset does not announce the end of a break, actual boundaries announce once',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();p.timer.start();p.timer.reset();assert.equal(e.notices.length,0);
 p.timer.start();e.advance(1500000);p.timer.tick();p.timer.tick();assert.equal(e.notices.length,1);
 e.advance(300000);p.timer.tick();p.timer.tick();assert.equal(e.notices.length,2);
});
test('unloading during a pending load does not register a timer afterwards',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();let release;
 p.loadData=()=>new Promise(resolve=>{release=resolve;});const pending=p.onload();p.onunload();release(null);await pending;
 assert.equal(p.timer,undefined);assert.equal(e.intervals.size,0);assert.equal(p.commands.length,0);
});
