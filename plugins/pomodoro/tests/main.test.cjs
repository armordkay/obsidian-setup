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
 contains(el){return this===el||this.children.some(child=>child.contains(el));}
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
  constructor(){super();this.saved=[];this.commands=[];
   const handlers=new Map();
   this.app={workspace:{leaves:[],activeLeaf:null,
    getLeavesOfType(type){return this.leaves.filter(leaf=>leaf.view?.getViewType?.()===type);},
    iterateAllLeaves(callback){for(const leaf of this.leaves)callback(leaf);},
    on(name,callback){handlers.set(name,callback);return {off:()=>handlers.delete(name)};},
    trigger(name,...args){handlers.get(name)?.(...args);},
    getLeaf:()=>({setViewState:async state=>{this.openState=state;}}),revealLeaf:async()=>{}}};}
  async loadData(){if(this.loadFailure)throw Error('read failed');return this.data||null;}
  async saveData(data){await this.beforeSave?.(data);if(this.saveFailure)throw Error('disk unavailable');this.saved.push(data);}
  registerView(type,factory){this.viewType=type;this.viewFactory=factory;}
  registerMarkdownCodeBlockProcessor(type,callback){this.blockType=type;this.blockCallback=callback;}
  addRibbonIcon(icon,label,callback){this.ribbon=callback;}
  addCommand(command){this.commands.push(command);}
  registerInterval(id){this.register(()=>intervals.delete(id));}
  registerEvent(ref){this.register(()=>ref.off());}
 }
 class ItemView extends Component {constructor(leaf){super();this.leaf=leaf;this.contentEl=new Element();}}
 class MarkdownRenderChild extends Component {constructor(el){super();this.containerEl=el;}}
 const context={module:{exports:{}},Date:class extends Date{static now(){return now;}},setInterval:fn=>{intervals.set(++nextInterval,fn);return nextInterval;},clearInterval:id=>intervals.delete(id),require:()=>({Plugin,ItemView,MarkdownRenderChild,Notice:class{constructor(text){notices.push(text);}}})};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nthis.api={Timer,formatTime,PomodoroBoard,PomodoroView,PomodoroPlugin:module.exports,BinauralAudio,BellAudio,SessionAudio};',context);
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
test('unloading a renderer removes its subscription without treating it as closing a tab',async()=>{
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
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();assert.equal(p.blockType,'pomodoro');assert.equal(p.commands.length,4);
 const parent=new Component(),el=new Element();p.blockCallback('',el,parent);assert.equal(parent.children.length,1);
 assert((el.className||'').split(' ').includes('pm-board-embed'));
 parent.removeChild(parent.children[0]);assert(!(el.className||'').split(' ').includes('pm-board-embed'));
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
test('switching to another tab keeps the owning Pomodoro tab running in the background',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const leaf={};const view=p.viewFactory(leaf);leaf.view=view;
 const other={view:{}};p.app.workspace.leaves=[leaf,other];p.app.workspace.activeLeaf=leaf;await view.onOpen();
 view.board.startButton.dispatch('click');e.advance(1000);p.app.workspace.activeLeaf=other;p.app.workspace.trigger('layout-change');
 for(const tick of e.intervals.values())tick();assert.equal(p.timer.getState().status,'running');assert.equal(p.timer.getState().remainingMs,1499000);
});
test('closing the owning dashboard pauses and saves progress until resumed',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const leaf={};const view=p.viewFactory(leaf);leaf.view=view;
 p.app.workspace.leaves=[leaf];await view.onOpen();view.board.startButton.dispatch('click');e.advance(1234);
 await view.onClose();await p.saveQueue;assert.equal(p.timer.getState().status,'paused');assert.equal(p.timer.getState().remainingMs,1498766);assert.equal(p.saved.at(-1).timer.status,'paused');
 e.advance(500000);p.timer.tick();assert.equal(p.timer.getState().remainingMs,1498766);
 await view.onOpen();assert.equal(view.board.startButton.textContent,'Tiếp tục');view.board.startButton.dispatch('click');e.advance(1000);p.timer.tick();assert.equal(p.timer.getState().remainingMs,1497766);
});
test('embedded timer survives renderer unload but pauses when its note tab is removed',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const host=new Element(),parent=new Component();
 const leaf={view:{containerEl:host,getViewType:()=> 'markdown'}};p.app.workspace.leaves=[leaf];p.app.workspace.activeLeaf=leaf;
 p.blockCallback('',host,parent);const b=parent.children[0];b.startButton.dispatch('click');e.advance(1000);parent.removeChild(b);
 p.app.workspace.activeLeaf=null;p.app.workspace.trigger('layout-change');assert.equal(p.timer.getState().status,'running');
 e.advance(1000);p.app.workspace.leaves=[];p.app.workspace.trigger('layout-change');await p.saveQueue;
 assert.equal(p.timer.getState().status,'paused');assert.equal(p.timer.getState().remainingMs,1498000);assert.equal(p.saved.at(-1).timer.status,'paused');
});
test('closing a different dashboard does not pause the session owned by another tab',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const a={},b={};const av=p.viewFactory(a),bv=p.viewFactory(b);a.view=av;b.view=bv;
 p.app.workspace.leaves=[a,b];await av.onOpen();await bv.onOpen();av.board.startButton.dispatch('click');
 await bv.onClose();p.app.workspace.leaves=[a];p.app.workspace.trigger('layout-change');assert.equal(p.timer.getState().status,'running');
});
test('a manually resumed restored session binds to its containing tab before that tab closes',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();p.data={version:1,settings:{focusMinutes:25,breakMinutes:5},timer:{phase:'focus',status:'running',remainingMs:1500000,endTime:1500000}};
 await p.onload();const host=new Element(),leaf={view:{containerEl:host}};p.app.workspace.leaves=[leaf];p.blockCallback('',host,new Component());
 p.startTimer();for(const tick of e.intervals.values())tick();e.advance(1000);p.app.workspace.leaves=[];p.app.workspace.trigger('layout-change');
 assert.equal(p.timer.getState().status,'paused');assert.equal(p.timer.getState().remainingMs,1499000);
});

// Audio clocks and onended are controlled separately from the timer's UI ticks.
class AudioContextFake {
 constructor(){this.currentTime=0;this.state='suspended';this.nodes=[];this.destination={};this.closed=0;this.resumes=0;}
 resume(){this.resumes++;this.state='running';return this.pendingResume||Promise.resolve();}
 close(){this.closed++;this.state='closed';return Promise.resolve();}
 node(kind){
  const node={kind,connections:[],disconnected:false,connect(...args){this.connections.push(args);},disconnect(){this.disconnected=true;}};
  this.nodes.push(node);return node;
 }
 createOscillator(){const node=this.node('oscillator');Object.assign(node,{frequency:{value:0},start(time){this.startTime=time;},stop(time=0){this.stopTime=time;}});return node;}
 createChannelMerger(count){const node=this.node('merger');node.inputs=count;return node;}
 createGain(){const node=this.node('gain'),calls=[];node.gain={calls,setValueAtTime:(...args)=>calls.push(['set',...args]),linearRampToValueAtTime:(...args)=>calls.push(['ramp',...args]),cancelScheduledValues:(...args)=>calls.push(['cancel',...args]),setTargetAtTime:(...args)=>calls.push(['target',...args])};return node;}
 advance(time){this.currentTime=time;for(const node of [...this.nodes])if(node.kind==='oscillator'&&!node.ended&&node.stopTime<=time){node.ended=true;node.onended?.();}}
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('audio uses only synchronized sine oscillators and explicit left/right merger routing',async()=>{
 const {BinauralAudio}=setup(),context=new AudioContextFake(),audio=new BinauralAudio(()=>context);
 const started=audio.start(.05,()=>60000);assert.equal(context.resumes,1);await started;
 const [left,right,merger,gain]=context.nodes;
 assert.equal(context.nodes.length,4);assert.equal(left.type,'sine');assert.equal(right.type,'sine');
 assert.equal(left.frequency.value,134);assert.equal(right.frequency.value,174);assert.equal(merger.inputs,2);
 assert.deepEqual(left.connections,[[merger,0,0]]);assert.deepEqual(right.connections,[[merger,0,1]]);
 assert.deepEqual(merger.connections,[[gain]]);assert.deepEqual(gain.connections,[[context.destination]]);
 assert.equal(gain.channelCount,2);assert.equal(gain.channelCountMode,'explicit');assert.equal(gain.channelInterpretation,'discrete');
 assert.equal(left.startTime,right.startTime);assert.equal(left.startTime,0);
 assert.ok(gain.gain.calls.some(([kind,value,time])=>kind==='set'&&value===0&&time===0));
 assert.ok(gain.gain.calls.some(([kind,value,time])=>kind==='ramp'&&value===.05&&time===.3));
 assert.equal(left.stopTime,60);assert.equal(right.stopTime,60);
});
test('pause fades for 0.2 seconds before stopping, disconnecting and closing',async()=>{
 const {BinauralAudio}=setup(),context=new AudioContextFake(),audio=new BinauralAudio(()=>context);await audio.start(.05);
 context.advance(1);const voice=audio.voice,done=audio.stop();assert.equal(context.closed,0);
 near(voice.left.stopTime,1.2);assert.equal(voice.gain.gain.calls.at(-1)[1],0);
 context.advance(1.19);assert.equal(context.closed,0);context.advance(1.2);await done;
 assert.equal(context.closed,1);assert.equal(audio.voice,null);assert.ok(context.nodes.every(node=>node.disconnected));
});
test('rapid Stop Start waits for the old pair to end, never overlaps oscillators',async()=>{
 const {BinauralAudio}=setup(),context=new AudioContextFake(),audio=new BinauralAudio(()=>context);await audio.start(.05);
 context.advance(1);const first=audio.voice;audio.stop();await audio.start(.08);
 assert.equal(audio.voice,first);assert.equal(context.nodes.length,4);
 context.advance(1.2);assert.notEqual(audio.voice,first);assert.equal(context.nodes.length,8);assert.equal(context.closed,0);
 assert.ok(first.left.ended&&first.right.ended);assert.ok(audio.voice.left.startTime>=first.left.stopTime);
 assert.equal(audio.voice.left.frequency.value,134);assert.equal(audio.level,.08);
 const done=audio.dispose();context.advance(1.4);await done;await audio.start(.05);assert.equal(context.nodes.length,8);
});
test('the last Stop wins even with a queued restart',async()=>{
 const {BinauralAudio}=setup(),context=new AudioContextFake(),audio=new BinauralAudio(()=>context);await audio.start(.05);
 audio.stop();await audio.start(.05);const done=audio.stop();context.advance(.2);await done;
 assert.equal(context.nodes.length,4);assert.equal(context.closed,1);assert.equal(audio.voice,null);
});
test('stopping during a pending resume prevents a late graph and a later start uses a fresh context',async()=>{
 const {BinauralAudio}=setup(),contexts=[new AudioContextFake(),new AudioContextFake()];let resolve;
 contexts[0].pendingResume=new Promise(r=>{resolve=r;});let index=0;const audio=new BinauralAudio(()=>contexts[index++]);
 const pending=audio.start(.05);await audio.stop();await audio.start(.05);resolve();await pending;
 assert.equal(contexts[0].nodes.length,0);assert.equal(contexts[0].closed,1);assert.equal(contexts[1].nodes.length,4);
});
test('natural focus deadline stops audio without a timer callback or restarting into rest',async()=>{
 const {BinauralAudio}=setup(),context=new AudioContextFake(),audio=new BinauralAudio(()=>context);await audio.start(.05,()=>1000);
 const voice=audio.voice;assert.ok(voice.gain.gain.calls.some(([kind,value,time])=>kind==='ramp'&&value===.05&&time===.8));
 assert.deepEqual(voice.gain.gain.calls.at(-1),['ramp',0,1]);context.advance(1);await voice.done;
 assert.equal(context.closed,1);assert.equal(context.nodes.length,4);assert.equal(audio.desired,false);
});
test('volume changes hold the interpolated gain, retain deadline fade and ignore invalid values',async()=>{
 const {BinauralAudio}=setup(),context=new AudioContextFake(),audio=new BinauralAudio(()=>context);await audio.start(.05,()=>10000);
 context.advance(.15);audio.setVolume(.08);const voice=audio.voice;
 near(voice.points[0].value,.025);near(voice.points[1].time,.45);assert.equal(voice.points[1].value,.08);
 assert.equal(voice.points.at(-1).time,10);assert.equal(voice.points.at(-1).value,0);
 audio.setVolume(-1);audio.setVolume(NaN);audio.setVolume(.31);assert.equal(audio.level,.08);
 audio.setVolume(0);assert.equal(audio.level,0);assert.ok(voice.points.every(point=>point.value>=0));
 audio.stop();const scheduled=voice.left.stopTime;audio.setVolume(.1);assert.equal(voice.left.stopTime,scheduled);assert.equal(voice.points.at(-1).value,0);
});
test('suspended contexts close immediately on stop because their clock cannot drain the fade',async()=>{
 const {BinauralAudio}=setup(),context=new AudioContextFake(),audio=new BinauralAudio(()=>context);await audio.start(.05);
 context.state='suspended';await audio.stop();assert.equal(context.closed,1);assert.ok(context.nodes.every(node=>node.disconnected));
});
test('creation, resume and partial graph failures report errors and release resources',async()=>{
 const {BinauralAudio}=setup();let errors=0;
 const unsupported=new BinauralAudio(()=>{throw Error('unsupported');},()=>errors++);await unsupported.start(.05);
 const rejected=new AudioContextFake();rejected.resume=()=>Promise.reject(Error('blocked'));
 await new BinauralAudio(()=>rejected,()=>errors++).start(.05);assert.equal(rejected.closed,1);
 const partial=new AudioContextFake();partial.createGain=()=>{throw Error('failed');};
 const audio=new BinauralAudio(()=>partial,()=>errors++);await audio.start(.05);
 assert.equal(errors,3);assert.equal(partial.closed,1);assert.ok(partial.nodes.every(node=>node.disconnected));assert.equal(audio.voice,null);
});
test('gain settings persist and restore independently of duration settings',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();
 assert.equal(p.audioGain,.2);p.setAudioGain(.075,true);await p.saveQueue;assert.equal(p.saved.at(-1).audio.gain,.075);
 const restored=new e.PomodoroPlugin();restored.data=p.saved.at(-1);await restored.onload();assert.equal(restored.audioGain,.075);assert.equal(restored.audio.context,null);
 const invalid=new e.PomodoroPlugin();invalid.data={version:1,audio:{version:2,gain:1}};await invalid.onload();assert.equal(invalid.audioGain,.2);
});
test('audio follows focus, pause, reset, rest, owning tab closure and plugin unload',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const contexts=[];
 p.audio.createContext=()=>{const context=new AudioContextFake();contexts.push(context);return context;};const b=board(e,p);
 const leaf={view:{containerEl:b.containerEl}};p.app.workspace.leaves=[leaf];p.app.workspace.activeLeaf=leaf;
 b.startButton.dispatch('click');await new Promise(setImmediate);assert.equal(contexts.length,1);assert.ok(p.audio.voice);
 b.startButton.dispatch('click');assert.equal(p.audio.voice.stopping,true);contexts[0].advance(.2);await new Promise(setImmediate);
 b.startButton.dispatch('click');await new Promise(setImmediate);assert.equal(contexts.length,2);
 e.advance(25*60000);p.timer.tick();assert.equal(p.timer.getState().phase,'break');assert.equal(p.audio.desired,false);
 contexts[1].advance(.5);await new Promise(setImmediate);p.timer.pause();b.startButton.dispatch('click');await new Promise(setImmediate);assert.equal(contexts.length,2);
 p.timer.reset();b.startButton.dispatch('click');await new Promise(setImmediate);assert.equal(contexts.length,3);
 p.app.workspace.leaves=[];p.app.workspace.trigger('layout-change');assert.equal(p.audio.desired,false);contexts[2].advance(.2);await new Promise(setImmediate);
 p.app.workspace.leaves=[leaf];b.startButton.dispatch('click');await new Promise(setImmediate);assert.equal(contexts.length,4);
 p.onunload();assert.equal(p.audio.disposed,true);contexts[3].advance(.2);await new Promise(setImmediate);assert.equal(contexts[3].closed,1);
});
test('unavailable audio leaves the timer usable and reports a recoverable error',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const b=board(e,p);b.startButton.dispatch('click');
 assert.equal(p.timer.getState().status,'running');assert.ok(b.message.textContent.includes('Không phát được âm thanh'));
 b.startButton.dispatch('click');assert.equal(p.timer.getState().status,'paused');
});
test('an audio interruption during fade closes resources and resumed audio keeps the focus deadline',async()=>{
 const {BinauralAudio}=setup(),context=new AudioContextFake(),audio=new BinauralAudio(()=>context);let remaining=10000;
 await audio.start(.05,()=>remaining);context.advance(1);remaining=2000;
 context.state='suspended';context.onstatechange();context.state='running';context.onstatechange();assert.equal(audio.voice.expiresAt,3);
 const done=audio.stop();context.state='suspended';context.onstatechange();await done;
 assert.equal(context.closed,1);assert.equal(context.onstatechange,null);assert.ok(context.nodes.every(node=>node.disconnected));
});
test('a failed resume of a live context cannot leave a stale voice blocking retry',async()=>{
 const {BinauralAudio}=setup(),contexts=[new AudioContextFake(),new AudioContextFake()];let index=0,errors=0;
 const audio=new BinauralAudio(()=>contexts[index++],()=>errors++);await audio.start(.05);
 contexts[0].resume=()=>Promise.reject(Error('context lost'));await audio.start(.05);
 assert.equal(audio.voice,null);assert.equal(contexts[0].closed,1);assert.equal(errors,1);
 await audio.start(.05);assert.equal(contexts[1].nodes.length,4);
 contexts[1].state='closed';contexts[1].onstatechange();assert.equal(audio.voice,null);assert.equal(audio.context,null);
});
test('repeated Start reuses the live graph and cancelAndHold browsers preserve a smooth envelope',async()=>{
 const {BinauralAudio}=setup(),context=new AudioContextFake(),audio=new BinauralAudio(()=>context);
 await audio.start(.05);await audio.start(.05);assert.equal(context.nodes.length,4);
 const calls=[];audio.voice.gain.gain.cancelAndHoldAtTime=time=>calls.push(time);
 context.advance(.15);audio.setVolume(.075);assert.deepEqual(calls,[.15]);near(audio.voice.points[0].value,.025);
});
test('restored running focus stays silent until an explicit user action',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();p.data={version:1,settings:{focusMinutes:25,breakMinutes:5},timer:{phase:'focus',status:'running',remainingMs:1500000,endTime:1500000},audio:{version:2,gain:.075}};
 await p.onload();const b=board(e,p);for(const tick of e.intervals.values())tick();
 assert.equal(p.audio.context,null);assert.equal(p.audioGain,.075);assert.equal(p.timer.getState().status,'paused');
 p.timer.pause();const context=new AudioContextFake();p.audio.createContext=()=>context;b.startButton.dispatch('click');
 await new Promise(setImmediate);assert.ok(p.audio.voice);assert.equal(p.audio.level,.075);
});

const flushAudio=()=>new Promise(setImmediate);
test('bell schedules exactly three identical strikes and all nine specified partial envelopes',async()=>{
 const {BellAudio}=setup(),context=new AudioContextFake(),bell=new BellAudio(()=>context);
 const done=bell.play(.1);await flushAudio();const voice=bell.voice;
 assert.equal(voice.partials.length,9);assert.equal(context.nodes.length,19);
 assert.deepEqual(voice.master.connections,[[context.destination]]);
 assert.deepEqual(voice.master.gain.calls,[['set',.1,0]]);
 for(let i=0;i<9;i++){
  const {oscillator,gain}=voice.partials[i],t=Math.floor(i/3)*.6;
  const [frequency,amplitude,decay]=[[880,.6,.3],[1760,.25,.2],[2464,.1,.12]][i%3];
  assert.equal(oscillator.type,'sine');assert.equal(oscillator.frequency.value,frequency);
  near(oscillator.startTime,t);near(oscillator.stopTime,t+1.51);
  assert.deepEqual(oscillator.connections,[[gain]]);assert.deepEqual(gain.connections,[[voice.master]]);
  assert.deepEqual(gain.gain.calls,[['set',0,t],['ramp',amplitude,t+.008],['target',0,t+.008,decay],['set',amplitude*Math.exp(-(1.4-.008)/decay),t+1.4],['ramp',0,t+1.5]]);
 }
 context.advance(1.51);assert.ok(voice.partials.slice(0,3).every(({oscillator,gain})=>oscillator.disconnected&&gain.disconnected));assert.equal(voice.master.disconnected,false);
 context.advance(2.71);assert.equal(await done,true);assert.equal(bell.voice,null);assert.ok(context.nodes.every(node=>node.disconnected));
 await bell.dispose();assert.equal(context.closed,1);
});
test('replacing a bell cancels even future strikes, fades briefly and starts one fresh sequence',async()=>{
 const {BellAudio}=setup(),context=new AudioContextFake(),bell=new BellAudio(()=>context);
 const first=bell.play();await flushAudio();const old=bell.voice;context.advance(.1);
 const second=bell.play(.2);await flushAudio();assert.equal(bell.voice,old);assert.equal(old.stopping,true);
 for(const {oscillator} of old.partials)near(oscillator.stopTime,.14);
 assert.deepEqual(old.master.gain.calls.at(-1),['ramp',0,.14]);
 context.advance(.14);await flushAudio();assert.equal(await first,false);assert.notEqual(bell.voice,old);
 near(bell.voice.partials[0].oscillator.startTime,.14);assert.equal(context.nodes.length,38);
 context.advance(2.85);assert.equal(await second,true);await bell.dispose();
});
test('bell pending resume can be canceled or disposed without late playback or leaked contexts',async()=>{
 const {BellAudio}=setup(),context=new AudioContextFake();let resume;
 context.pendingResume=new Promise(resolve=>{resume=resolve;});const bell=new BellAudio(()=>context);
 const done=bell.play();await bell.stop();await bell.dispose();resume();
 assert.equal(await done,false);assert.equal(context.nodes.length,0);assert.equal(context.closed,1);
 assert.equal(await bell.play(),false);
});
test('bell gain adjusts live within 0–0.30, including mute, and never overrides a cancellation fade',async()=>{
 const {BellAudio}=setup(),context=new AudioContextFake(),bell=new BellAudio(()=>context);bell.play();await flushAudio();
 bell.setVolume(.3);assert.equal(bell.level,.3);assert.deepEqual(bell.voice.master.gain.calls.at(-1),['ramp',.3,.02]);
 bell.setVolume(.31);bell.setVolume(-1);bell.setVolume(NaN);assert.equal(bell.level,.3);
 context.advance(.01);bell.setVolume(0);near(bell.voice.from,.275);assert.equal(bell.voice.level,0);
 const stopped=bell.stop();const calls=bell.voice.master.gain.calls.length;bell.setVolume(.2);assert.equal(bell.voice.master.gain.calls.length,calls);
 context.advance(.05);await stopped;await bell.dispose();
});
test('bell cleans up partial graphs, rejected resume and interruptions during cancellation',async()=>{
 const {BellAudio}=setup();let errors=0;const partial=new AudioContextFake();
 const original=partial.createGain.bind(partial);let calls=0;partial.createGain=()=>{if(++calls===4)throw Error('allocation failed');return original();};
 const bell=new BellAudio(()=>partial,()=>errors++);assert.equal(await bell.play(),false);
 assert.ok(partial.nodes.every(node=>node.disconnected));assert.equal(partial.closed,1);assert.equal(errors,1);
 const rejected=new AudioContextFake();rejected.resume=()=>Promise.reject(Error('blocked'));
 assert.equal(await new BellAudio(()=>rejected,()=>errors++).play(),false);assert.equal(rejected.closed,1);assert.equal(errors,2);
 const context=new AudioContextFake(),interrupted=new BellAudio(()=>context);interrupted.play();await flushAudio();
 const stopped=interrupted.stop();context.state='suspended';context.onstatechange();await stopped;await interrupted.dispose();assert.equal(context.closed,1);
});
test('timer emits one common transition per boundary or Next, never for ordinary controls',()=>{
 const e=setup(),timer=new e.Timer(),transitions=[];timer.subscribe((_state,_changed,event)=>{if(event)transitions.push(event);});
 timer.start();timer.pause();timer.start();timer.reset();timer.next();assert.equal(transitions.length,0);
 timer.start();e.advance(1500000);timer.tick();timer.tick();assert.equal(transitions.length,1);assert.equal(transitions[0].to,'break');
 timer.next();assert.equal(transitions.length,2);assert.equal(transitions[1].to,'focus');assert.equal(transitions[1].reason,'next');
 assert.equal(timer.getState().remainingMs,1500000);timer.stop();assert.equal(transitions.length,2);
 timer.start();e.advance(1800000);timer.tick();assert.equal(transitions.length,4);assert.equal(timer.getState().status,'ready');
});
function soundHarness(){
 const e=setup(),calls=[],contexts=[],state={phase:'focus',status:'running',remainingMs:60000},settings={audioGain:.05,bellEnabled:true,bellGain:.1};
 const audio=new e.BinauralAudio(()=>{const context=new AudioContextFake();contexts.push(context);calls.push('binaural');return context;});
 const bellContext=new AudioContextFake(),bell=new e.BellAudio(()=>{calls.push('bell-context');return bellContext;});
 const sounds=new e.SessionAudio(audio,bell,()=>state,()=>settings);
 return {e,calls,contexts,state,settings,audio,bell,bellContext,sounds};
}
test('transition fades binaural for 0.5s then rings, without changing the new timer deadline',async()=>{
 const h=soundHarness();h.sounds.startFocus();await flushAudio();h.contexts[0].advance(1);
 h.state.phase='break';const done=h.sounds.transition();await flushAudio();
 near(h.audio.voice.left.stopTime,1.5);assert.equal(h.bell.voice,null);assert.equal(h.state.remainingMs,60000);
 h.contexts[0].advance(1.5);await flushAudio();assert.equal(h.bell.voice.partials.length,9);
 h.bellContext.advance(2.71);await done;assert.equal(h.audio.voice,null);assert.equal(h.contexts.length,1);
 await h.sounds.dispose();
});
test('a new focus starts binaural only after the bell and uses the remaining timer time',async()=>{
 const h=soundHarness(),done=h.sounds.transition();await flushAudio();assert.equal(h.contexts.length,0);
 h.state.remainingMs=57000;h.bellContext.advance(2.71);await done;await flushAudio();
 assert.equal(h.contexts.length,1);assert.equal(h.audio.voice.expiresAt,57);assert.equal(h.sounds.busy,false);
 const disposed=h.sounds.dispose();h.contexts[0].advance(.2);await disposed;
});
test('successive transitions invalidate an old hand-off and cancel the old bell before ringing again',async()=>{
 const h=soundHarness();const first=h.sounds.transition();await flushAudio();const old=h.bell.voice;
 h.state.phase='break';const second=h.sounds.transition();await flushAudio();assert.equal(old.stopping,true);
 h.bellContext.advance(.04);await flushAudio();assert.notEqual(h.bell.voice,old);assert.equal(h.contexts.length,0);
 h.bellContext.advance(2.75);await Promise.all([first,second]);assert.equal(h.contexts.length,0);await h.sounds.dispose();
});
test('Reset/Stop/Pause and unload invalidate a pending binaural restart even if the bell finishes later',async()=>{
 for(const action of ['reset','stop','pause','unload']){
  const h=soundHarness(),done=h.sounds.transition();await flushAudio();
  if(action==='unload'){const disposed=h.sounds.dispose();h.bellContext.advance(.04);await disposed;}
  else {h.state.status=action==='pause'?'paused':'ready';h.sounds.cancel();h.bellContext.advance(.04);}
  await done;assert.equal(h.contexts.length,0,action);assert.equal(h.bell.voice,null,action);
 }
});
test('disabled bell produces no graph and preview still works without starting a ready timer',async()=>{
 const h=soundHarness();h.settings.bellEnabled=false;h.state.status='ready';await h.sounds.transition();assert.equal(h.bell.context,null);
 const preview=h.sounds.transition(true);await flushAudio();assert.equal(h.bell.voice.partials.length,9);
 h.bellContext.advance(2.71);await preview;assert.equal(h.contexts.length,0);assert.equal(h.state.status,'ready');await h.sounds.dispose();
});
test('plugin bell controls synchronize and persist; Next changes phase immediately while ringing is pending',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const a=board(e,p),b=board(e,p);
 const bellContext=new AudioContextFake();p.bell.createContext=()=>bellContext;
 p.audio.createContext=()=>new AudioContextFake();assert.equal(p.bellEnabled,true);assert.equal(p.bellGain,.25);
 p.setBellSettings({gain:.2});p.setBellSettings({enabled:false},true,a);await p.saveQueue;
 assert.equal(p.bellEnabled,false);assert.equal(p.saved.at(-1).audio.bellEnabled,false);assert.equal(p.saved.at(-1).audio.bellGain,.2);
 const restored=new e.PomodoroPlugin();restored.data=p.saved.at(-1);await restored.onload();assert.equal(restored.bellEnabled,false);assert.equal(restored.bellGain,.2);
 p.setBellSettings({enabled:true},true,a);a.startButton.dispatch('click');await flushAudio();
 a.nextButton.dispatch('click');assert.equal(p.timer.getState().phase,'break');assert.equal(p.timer.getState().status,'running');assert.equal(p.timer.getState().remainingMs,300000);
 assert.equal(p.audio.voice.stopping,true);p.audio.context.advance(.5);await flushAudio();assert.ok(p.bell.voice);
 p.timer.reset();bellContext.advance(.04);await flushAudio();assert.equal(p.audio.voice,null);
 p.onunload();await flushAudio();assert.equal(bellContext.closed,1);
});
test('a second transition or Reset during the binaural fade cannot release a stale bell later',async()=>{
 for(const reset of [false,true]){
  const h=soundHarness();h.sounds.startFocus();await flushAudio();const first=h.sounds.transition();
  h.state.phase='break';const second=reset?null:h.sounds.transition();if(reset){h.state.status='ready';h.sounds.cancel();}
  h.contexts[0].advance(.5);await flushAudio();
  if(reset){assert.equal(h.bell.voice,null);await first;}
  else {assert.equal(h.bellContext.nodes.length,19);h.bellContext.advance(2.71);await Promise.all([first,second]);}
  assert.equal(h.contexts.length,1);await h.sounds.dispose();
 }
});
test('plugin sends automatic and Next boundaries to one dispatcher without Start/Pause/Reset rings',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();let rings=0;
 p.sounds={prepare(){},startFocus(){},transition(){rings++;return Promise.resolve();},cancel(){},dispose(){return Promise.resolve();}};
 p.startTimer();p.timer.pause();p.startTimer();p.timer.reset();assert.equal(rings,0);
 p.startTimer();e.advance(1500000);p.timer.tick();p.timer.tick();assert.equal(rings,1);
 p.nextTimer();assert.equal(rings,2);p.timer.pause();p.timer.start();p.timer.stop();p.timer.reset();assert.equal(rings,2);
});
test('autoplay failure and invalid saved bell settings never prevent the next timer phase',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();p.data={version:1,audio:{bellEnabled:'yes',bellGain:.31}};await p.onload();
 assert.equal(p.bellEnabled,true);assert.equal(p.bellGain,.25);
 const context=new AudioContextFake();context.resume=()=>Promise.reject(Error('autoplay'));
 p.bell.createContext=()=>context;p.timer.start();e.advance(1500000);p.timer.tick();await flushAudio();
 assert.equal(p.timer.getState().phase,'break');assert.equal(p.timer.getState().remainingMs,300000);
 assert.equal(context.closed,1);assert.ok(p.audioError.includes('Không phát được chuông'));assert.equal(p.sounds.busy,false);
});

test('closing the dashboard during a ready-state bell preview cancels all audio',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const leaf={},view=p.viewFactory(leaf);leaf.view=view;
 p.app.workspace.leaves=[leaf];p.app.workspace.activeLeaf=leaf;await view.onOpen();
 const context=new AudioContextFake();p.bell.createContext=()=>context;
 p.previewBell(view.board);await flushAudio();assert.ok(p.bell.voice);assert.equal(p.timer.getState().status,'ready');
 await view.onClose();assert.equal(p.bell.voice.stopping,true);
 context.advance(.04);await flushAudio();assert.equal(p.bell.voice,null);assert.equal(p.sounds.busy,false);
});
test('closing an embedded preview tab cancels audio even when the timer is ready',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const host=new Element(),leaf={view:{containerEl:host}};
 p.app.workspace.leaves=[leaf];p.app.workspace.activeLeaf=leaf;const component=new Component();p.blockCallback('',host,component);
 const context=new AudioContextFake();p.bell.createContext=()=>context;p.previewBell(component.children[0]);await flushAudio();
 p.app.workspace.leaves=[];p.app.workspace.trigger('layout-change');assert.equal(p.bell.voice.stopping,true);
 context.advance(.04);await flushAudio();assert.equal(p.bell.voice,null);
});
test('closing an unrelated dashboard leaves the ready preview playing in its own tab',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const a={detach(){}},b={detach(){}},av=p.viewFactory(a),bv=p.viewFactory(b);a.view=av;b.view=bv;
 p.app.workspace.leaves=[a,b];p.app.workspace.activeLeaf=a;await av.onOpen();await bv.onOpen();
 const context=new AudioContextFake();p.bell.createContext=()=>context;p.previewBell(av.board);await flushAudio();
 await bv.onClose();assert.equal(p.bell.voice.stopping,false);p.onunload();context.advance(.04);await flushAudio();
});
test('disabling a ringing bell waits for its cancellation fade before restarting focus audio',async()=>{
 const h=soundHarness(),transition=h.sounds.transition();await flushAudio();assert.ok(h.bell.voice);
 h.settings.bellEnabled=false;h.sounds.disableBell();await flushAudio();
 assert.equal(h.bell.voice.stopping,true);assert.equal(h.contexts.length,0);
 h.sounds.startFocus();await flushAudio();assert.equal(h.contexts.length,0);
 h.bellContext.advance(.04);await flushAudio();assert.equal(h.contexts.length,1);assert.equal(h.bell.voice,null);
 await transition;const disposed=h.sounds.dispose();h.contexts[0].advance(.2);await disposed;
});
test('closing the owning note after natural break completion stops the ready-state notification',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();p.data={version:1,timer:{phase:'break',status:'running',remainingMs:1000,endTime:1000}};await p.onload();
 const host=new Element(),leaf={view:{containerEl:host}};p.app.workspace.leaves=[leaf];p.app.workspace.activeLeaf=leaf;p.ownerLeaf=leaf;
 p.blockCallback('',host,new Component());const context=new AudioContextFake();p.bell.createContext=()=>context;
 p.timer.start();e.advance(1000);p.timer.tick();await flushAudio();assert.equal(p.timer.getState().status,'ready');assert.ok(p.bell.voice);
 p.app.workspace.leaves=[];p.app.workspace.trigger('layout-change');assert.equal(p.bell.voice.stopping,true);
 context.advance(.04);await flushAudio();assert.equal(p.bell.voice,null);
});
test('Reset or unload during disabling a bell cannot revive binaural after the fade',async()=>{
 for(const unload of [false,true]){
  const h=soundHarness(),transition=h.sounds.transition();await flushAudio();h.settings.bellEnabled=false;
  const disabled=h.sounds.disableBell();let disposed;
  if(unload)disposed=h.sounds.dispose();else {h.state.status='ready';h.sounds.cancel();}
  h.bellContext.advance(.04);await Promise.all([transition,disabled,disposed]);assert.equal(h.contexts.length,0);
 }
});
test('Binaural beats switch sits above durations and replaces the two audio setup sections',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const b=board(e,p);
 assert.ok(b.binauralInput);assert.equal(b.binauralInput.attributes.role,'switch');assert.equal(b.binauralInput.checked,true);
 const controls=descendants(b.root);assert.ok(controls.indexOf(b.binauralInput)<controls.indexOf(b.focusInput));
 assert.equal(byClass(b.root,'pm-audio-control').length,0);assert.equal(b.gainInput,undefined);assert.equal(b.previewButton,undefined);
 assert.equal(p.audioGain,.2);assert.equal(p.bellGain,.25);
});
test('disabling binaural keeps timer and transition bells active, persists and never restarts after a bell',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const b=board(e,p),other=board(e,p),contexts=[];
 p.audio.createContext=()=>{const c=new AudioContextFake();contexts.push(c);return c;};const bellContext=new AudioContextFake();p.bell.createContext=()=>bellContext;
 b.startButton.dispatch('click');await flushAudio();b.binauralInput.checked=false;b.binauralInput.dispatch('change');
 assert.equal(p.audio.desired,false);assert.equal(other.binauralInput.checked,false);assert.equal(p.timer.getState().status,'running');
 contexts[0].advance(.2);await flushAudio();b.nextButton.dispatch('click');await flushAudio();assert.ok(p.bell.voice);
 bellContext.advance(2.71);await flushAudio();b.nextButton.dispatch('click');await flushAudio();bellContext.advance(5.42);await flushAudio();
 assert.equal(contexts.length,1);assert.equal(p.timer.getState().phase,'focus');assert.equal(p.audio.voice,null);
 await p.saveQueue;assert.equal(p.saved.at(-1).audio.binauralEnabled,false);
 const restored=new e.PomodoroPlugin();restored.data=p.saved.at(-1);await restored.onload();assert.equal(restored.binauralEnabled,false);
 b.binauralInput.checked=true;b.binauralInput.dispatch('change');await flushAudio();assert.equal(contexts.length,2);assert.equal(p.audio.level,.2);
 p.timer.reset();contexts[1].advance(.2);await flushAudio();
});
test('legacy audio settings upgrade to the requested gains and keep transition bells enabled',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();p.data={version:1,audio:{gain:.05,bellGain:.1,bellEnabled:false}};
 await p.onload();assert.equal(p.audioGain,.2);assert.equal(p.bellGain,.25);assert.equal(p.bellEnabled,true);assert.equal(p.binauralEnabled,true);
 await p.persist();const restored=new e.PomodoroPlugin();restored.data=p.saved.at(-1);await restored.onload();assert.equal(restored.audioGain,.2);assert.equal(restored.bellGain,.25);
});
test('binaural switch never starts audio while ready, paused or resting',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const b=board(e,p);let creations=0;
 p.audio.createContext=()=>{creations++;return new AudioContextFake();};
 p.setBinauralEnabled(false,b);p.setBinauralEnabled(true,b);await flushAudio();assert.equal(creations,0);
 p.timer.start();p.timer.pause();p.setBinauralEnabled(false,b);p.setBinauralEnabled(true,b);await flushAudio();assert.equal(creations,0);
 p.timer.next();p.setBinauralEnabled(false,b);p.setBinauralEnabled(true,b);await flushAudio();assert.equal(p.timer.getState().phase,'break');assert.equal(creations,0);
});
test('switch changes during a bell respect the final choice without overlapping audio',async()=>{
 for(const enabled of [false,true]){
  const h=soundHarness();h.settings.binauralEnabled=true;const done=h.sounds.transition();await flushAudio();
  h.settings.binauralEnabled=enabled;if(!enabled)h.audio.stop();else h.sounds.startFocus();
  assert.equal(h.contexts.length,0);h.bellContext.advance(2.71);await done;await flushAudio();assert.equal(h.contexts.length,enabled?1:0);
  const disposed=h.sounds.dispose();if(enabled)h.contexts[0].advance(.2);await disposed;
 }
});
test('quitting the app pauses immediately, waits for storage and resumes only on demand after reopening',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const b=board(e,p),context=new AudioContextFake(),bellContext=new AudioContextFake();
 p.audio.createContext=()=>context;p.bell.createContext=()=>bellContext;b.startButton.dispatch('click');await flushAudio();e.advance(32123);
 const tasks=[];p.app.workspace.trigger('quit',{add(callback){tasks.push(callback());}});
 assert.equal(p.timer.getState().status,'paused');assert.equal(p.timer.getState().remainingMs,1467877);
 context.advance(.2);await Promise.all(tasks);await p.saveQueue;
 assert.equal(p.saved.at(-1).timer.status,'paused');assert.equal(context.closed,1);assert.equal(bellContext.closed,1);
 e.advance(86400000);const reopened=new e.PomodoroPlugin();reopened.data=p.saved.at(-1);await reopened.onload();
 assert.equal(reopened.timer.getState().status,'paused');assert.equal(reopened.timer.getState().remainingMs,1467877);
 for(const tick of e.intervals.values())tick();assert.equal(reopened.timer.getState().remainingMs,1467877);
 reopened.audio.createContext=()=>new AudioContextFake();reopened.bell.createContext=()=>new AudioContextFake();
 reopened.startTimer();assert.equal(reopened.timer.getState().status,'running');
});
test('unload pauses focus or break and saves the remaining time before disposing',async()=>{
 for(const phase of ['focus','break']){
  const e=setup(),p=new e.PomodoroPlugin();await p.onload();p.timer.start();if(phase==='break')p.timer.next();
  e.advance(1234);p.onunload();await p.saveQueue;
  assert.equal(p.saved.at(-1).timer.status,'paused');assert.equal(p.saved.at(-1).timer.phase,phase);
  assert.equal(p.saved.at(-1).timer.remainingMs,(phase==='focus'?1500000:300000)-1234);
 }
});
test('unclean shutdown or old running snapshots never count elapsed time while the app was closed',async()=>{
 const e=setup();e.advance(86400000);const p=new e.PomodoroPlugin();
 p.data={version:1,settings:{focusMinutes:25,breakMinutes:5},timer:{phase:'focus',status:'running',remainingMs:1200000,endTime:1500000}};
 await p.onload();assert.equal(p.timer.getState().status,'paused');assert.equal(p.timer.getState().phase,'focus');assert.equal(p.timer.getState().remainingMs,1200000);
});
test('switching binaural off stops both oscillators, disconnects every node and closes its context',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();const b=board(e,p),context=new AudioContextFake(),bellContext=new AudioContextFake();
 p.audio.createContext=()=>context;p.bell.createContext=()=>bellContext;b.startButton.dispatch('click');await flushAudio();
 const old=p.audio.voice;b.binauralInput.checked=false;b.binauralInput.dispatch('change');
 assert.equal(old.stopping,true);near(old.left.stopTime,.2);near(old.right.stopTime,.2);
 context.advance(.2);await flushAudio();assert.equal(p.audio.voice,null);assert.equal(p.audio.context,null);assert.equal(context.closed,1);
 assert.ok(context.nodes.every(node=>node.disconnected));assert.ok(old.left.ended&&old.right.ended);assert.equal(p.timer.getState().status,'running');
 b.nextButton.dispatch('click');await flushAudio();assert.ok(p.bell.voice);assert.equal(bellContext.closed,0);
});
test('live checkpoints are paused on disk while the current session keeps running in background',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();p.timer.start();e.advance(54321);await p.persist();
 const checkpoint=p.saved.at(-1);assert.equal(checkpoint.timer.status,'paused');assert.equal(checkpoint.timer.endTime,null);
 assert.equal(checkpoint.timer.remainingMs,1445679);assert.equal(p.timer.getState().status,'running');
 e.advance(86400000);const reopened=new e.PomodoroPlugin();reopened.data=checkpoint;await reopened.onload();
 assert.equal(reopened.timer.getState().status,'paused');assert.equal(reopened.timer.getState().remainingMs,1445679);
});
test('shutdown repeated through quit and unload cannot resume, duplicate saves or duplicate audio disposal',async()=>{
 const e=setup(),p=new e.PomodoroPlugin();await p.onload();p.timer.start();e.advance(1000);
 const first=p.shutdown(),second=p.shutdown();assert.equal(first,second);await first;
 const count=p.saved.length;p.onunload();await p.saveQueue;assert.equal(p.saved.length,count);
 p.startTimer();p.nextTimer();assert.equal(p.timer.getState().status,'paused');assert.equal(p.timer.getState().remainingMs,1499000);
});
