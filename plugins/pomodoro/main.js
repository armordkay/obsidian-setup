const {Plugin, ItemView, MarkdownRenderChild, Notice} = require('obsidian');

const VIEW_TYPE = 'pomodoro-view';
const DEFAULTS = {focusMinutes:25, breakMinutes:5};
const MINUTE = 60000;
const DEFAULT_AUDIO_GAIN = 0.2;
const DEFAULT_BELL_GAIN = 0.25;
function validAudioGain(value) { return Number.isFinite(value) && value >= 0 && value <= 0.3; }

// One live graph. A rapid restart waits for the retiring pair to end, then creates
// fresh oscillators in the context resumed by the latest user gesture.
class BinauralAudio {
 constructor(createContext,onError=()=>{}) {
  this.createContext=createContext; this.onError=onError;
  this.context=null; this.voice=null; this.desired=false; this.disposed=false;
  this.level=DEFAULT_AUDIO_GAIN; this.remaining=()=>Infinity;
 }
 start(level,remaining=()=>Infinity) {
  if (this.disposed) return Promise.resolve();
  this.level=validAudioGain(level) ? level : DEFAULT_AUDIO_GAIN;
  this.remaining=remaining; this.desired=true;
  let context;
  try {
   context=this.context || this.createContext();
   this.context=context;
   context.onstatechange=() => {
    const voice=this.voice;
    if (!voice || voice.context !== context) return;
    if (context.state === 'closed') { this.finishVoice(voice); return; }
    if (context.state !== 'running') {
     if (voice.stopping) this.finishVoice(voice);
     return;
    }
    if (voice.stopping) return;
    const remaining=this.remaining()/1000;
    if (!(remaining > 0)) { void this.stop(); return; }
    // Audio clocks pause during an interruption; keep the stop aligned to focus.
    voice.expiresAt=context.currentTime+remaining;
    this.planLevel(voice);
    voice.left.stop(voice.expiresAt); voice.right.stop(voice.expiresAt);
   };
   // Called synchronously from Start/Resume, before any promise continuation.
   const resumed=context.resume();
   return Promise.resolve(resumed).then(() => {
    if (this.context === context && this.desired && !this.disposed) this.ensureVoice(context);
   }).catch(() => { if (this.context === context) this.fail(context); });
  } catch { this.fail(context); return Promise.resolve(); }
 }
 ensureVoice(context) {
  if (this.voice || !this.desired || this.disposed || this.context !== context) return;
  const remaining=this.remaining()/1000;
  if (!(remaining > 0)) { this.desired=false; void this.closeContext(context); return; }
  const nodes=[];
  try {
   const left=context.createOscillator(); nodes.push(left);
   const right=context.createOscillator(); nodes.push(right);
   const merger=context.createChannelMerger(2); nodes.push(merger);
   const gain=context.createGain(); nodes.push(gain);
   left.type=right.type='sine'; left.frequency.value=134; right.frequency.value=174;
   left.connect(merger,0,0); right.connect(merger,0,1);
   merger.connect(gain); gain.connect(context.destination);
   gain.channelCount=2; gain.channelCountMode='explicit'; gain.channelInterpretation='discrete';
   const time=context.currentTime;
   const voice={context,left,right,merger,gain,nodes,expiresAt:time+remaining,points:[{time,value:0}],ended:0,stopping:false,finished:false};
   voice.done=new Promise(resolve => { voice.resolve=resolve; });
   this.voice=voice;
   left.onended=right.onended=() => { if (++voice.ended === 2) this.finishVoice(voice); };
   gain.gain.setValueAtTime(0,time);
   left.start(time); right.start(time);
   this.planLevel(voice);
   if (Number.isFinite(voice.expiresAt)) { left.stop(voice.expiresAt); right.stop(voice.expiresAt); }
  } catch {
   for (const node of nodes) { try { node.stop?.(); } catch {} try { node.disconnect(); } catch {} }
   if (this.voice?.context === context) { this.voice.finished=true; this.voice.resolve(); this.voice=null; }
   this.fail(context);
  }
 }
 valueAt(voice,time) {
  let previous=voice.points[0];
  for (const point of voice.points.slice(1)) {
   if (time <= point.time) {
    const fraction=point.time === previous.time ? 1 : Math.max(0,(time-previous.time)/(point.time-previous.time));
    return previous.value+(point.value-previous.value)*fraction;
   }
   previous=point;
  }
  return previous.value;
 }
 automate(voice,points) {
  const param=voice.gain.gain, time=voice.context.currentTime;
  const current=this.valueAt(voice,time);
  // All automation belongs to this class, so the fallback can hold the exact
  // interpolated value even in browsers without cancelAndHoldAtTime.
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(time);
  param.cancelScheduledValues(time); param.setValueAtTime(current,time);
  voice.points=[{time,value:current},...points];
  for (const point of points) param.linearRampToValueAtTime(point.value,point.time);
 }
 planLevel(voice) {
  const time=voice.context.currentTime;
  const fadeOut=Math.max(time,voice.expiresAt-0.2);
  const fadeIn=Math.min(time+0.3,fadeOut);
  const points=[];
  if (fadeIn > time) points.push({time:fadeIn,value:this.level});
  if (Number.isFinite(voice.expiresAt)) {
   if (fadeOut > fadeIn) points.push({time:fadeOut,value:this.level});
   points.push({time:Math.max(time,voice.expiresAt),value:0});
  }
  this.automate(voice,points);
 }
 setVolume(level) {
  if (!validAudioGain(level)) return;
  this.level=level;
  if (this.voice && !this.voice.stopping) this.planLevel(this.voice);
 }
 stop(seconds=0.2) {
  this.desired=false;
  const voice=this.voice;
  if (!voice) return this.closeContext(this.context);
  if (voice.stopping) return voice.done;
  voice.stopping=true;
  if (voice.context.state !== 'running') {
   // Suspended contexts are already silent and their audio clocks cannot drain a fade.
   for (const node of [voice.left,voice.right]) { try { node.stop(); } catch {} }
   this.finishVoice(voice);
   return voice.done;
  }
  const now=voice.context.currentTime;
  const end=seconds === 0.2 ? Math.max(now,Math.min(now+seconds,voice.expiresAt)) : now+seconds;
  try {
   this.automate(voice,[{time:end,value:0}]);
   voice.left.stop(end); voice.right.stop(end);
  } catch { this.finishVoice(voice); }
  return voice.done;
 }
 finishVoice(voice) {
  if (voice.finished) return;
  voice.finished=true;
  voice.left.onended=voice.right.onended=null;
  for (const node of voice.nodes) { try { node.disconnect(); } catch {} }
  if (this.voice === voice) this.voice=null;
  if (!voice.stopping) this.desired=false; // Natural focus deadline: never loop into a break.
  if (this.desired && !this.disposed && this.context === voice.context) {
   this.ensureVoice(voice.context); voice.resolve();
  } else { void this.closeContext(voice.context).then(voice.resolve); }
 }
 closeContext(context) {
  if (!context) return Promise.resolve();
  context.onstatechange=null;
  if (this.context === context) this.context=null;
  try { return context.state === 'closed' ? Promise.resolve() : Promise.resolve(context.close()).catch(()=>{}); }
  catch { return Promise.resolve(); }
 }
 fail(context) {
  this.desired=false;
  if (this.voice && this.voice.context === context) this.finishVoice(this.voice);
  else void this.closeContext(context);
  if (!this.disposed) this.onError();
 }
 dispose() { this.disposed=true; return this.stop(); }
}
const BELL_PARTIALS = [[880,0.60,0.30],[1760,0.25,0.20],[2464,0.10,0.12]];
function validBellGain(value) { return Number.isFinite(value) && value >= 0 && value <= 0.3; }

class BellAudio {
 constructor(createContext,onError=()=>{}) {
  this.createContext=createContext; this.onError=onError;
  this.context=null; this.voice=null; this.version=0; this.disposed=false; this.level=DEFAULT_BELL_GAIN;
 }
 async prepare() {
  if (this.disposed) return null;
  let context;
  try {
   context=this.context || this.createContext(); this.context=context;
   context.onstatechange=() => {
    if (context.state === 'closed' || (context.state !== 'running' && this.voice?.stopping)) {
     if (this.voice?.context === context) this.finish(this.voice,false);
     if (context.state === 'closed' && this.context === context) this.context=null;
    }
   };
   // Invoked before awaiting: Start/Next/preview can unlock the silent context.
   await context.resume();
   return !this.disposed && this.context === context ? context : null;
  } catch {
   if (context && this.context !== context) return null;
   if (this.voice) this.finish(this.voice,false);
   await this.close(context);
   if (!this.disposed) this.onError();
   return null;
  }
 }
 async play(level=this.level) {
  const token=++this.version;
  this.level=validBellGain(level) ? level : DEFAULT_BELL_GAIN;
  const ready=this.prepare();
  await this.stopVoice();
  const context=await ready;
  if (!context || this.disposed || token !== this.version) return false;
  const voice={context,nodes:[],partials:[],ended:0,finished:false,stopping:false,level:this.level,from:this.level,time:context.currentTime,end:context.currentTime};
  voice.done=new Promise(resolve=>{voice.resolve=resolve;}); this.voice=voice;
  try {
   const master=context.createGain(); voice.master=master; voice.nodes.push(master);
   master.gain.setValueAtTime(this.level,context.currentTime); master.connect(context.destination);
   const start=context.currentTime;
   for (const offset of [0,0.6,1.2]) for (const [frequency,amplitude,decay] of BELL_PARTIALS) {
    const oscillator=context.createOscillator(); voice.nodes.push(oscillator);
    const gain=context.createGain(); voice.nodes.push(gain);
    const t=start+offset;
    oscillator.type='sine'; oscillator.frequency.value=frequency;
    oscillator.connect(gain); gain.connect(master);
    gain.gain.setValueAtTime(0,t);
    gain.gain.linearRampToValueAtTime(amplitude,t+0.008);
    gain.gain.setTargetAtTime(0,t+0.008,decay);
    gain.gain.setValueAtTime(amplitude*Math.exp(-(1.4-0.008)/decay),t+1.4);
    gain.gain.linearRampToValueAtTime(0,t+1.5);
    const partial={oscillator,gain}; voice.partials.push(partial);
    oscillator.onended=() => {
     oscillator.onended=null; oscillator.disconnect(); gain.disconnect();
     if (++voice.ended === 9) this.finish(voice,!voice.stopping);
    };
    oscillator.start(t); oscillator.stop(t+1.51);
   }
  } catch {
   this.finish(voice,false); void this.close(context);
   if (!this.disposed) this.onError();
  }
  return voice.done;
 }
 currentGain(voice) {
  const fraction=voice.end <= voice.time ? 1 : Math.max(0,Math.min(1,(voice.context.currentTime-voice.time)/(voice.end-voice.time)));
  return voice.from+(voice.level-voice.from)*fraction;
 }
 ramp(voice,level,seconds) {
  const now=voice.context.currentTime,from=this.currentGain(voice),param=voice.master.gain;
  param.cancelScheduledValues(now); param.setValueAtTime(from,now); param.linearRampToValueAtTime(level,now+seconds);
  Object.assign(voice,{from,level,time:now,end:now+seconds});
 }
 setVolume(level) {
  if (!validBellGain(level)) return;
  this.level=level;
  if (this.voice && !this.voice.stopping) this.ramp(this.voice,level,0.02);
 }
 stopVoice(seconds=0.04) {
  const voice=this.voice;
  if (!voice) return Promise.resolve(false);
  if (voice.stopping) return voice.done;
  voice.stopping=true;
  if (voice.context.state !== 'running') { this.finish(voice,false); return voice.done; }
  try {
   this.ramp(voice,0,seconds);
   for (const {oscillator} of voice.partials) oscillator.stop(voice.context.currentTime+seconds);
  } catch { this.finish(voice,false); }
  return voice.done;
 }
 stop() { ++this.version; return this.stopVoice(); }
 finish(voice,completed) {
  if (voice.finished) return;
  voice.finished=true;
  for (const node of voice.nodes) {
   if ('onended' in node) { node.onended=null; try { node.stop(); } catch {} }
   try { node.disconnect(); } catch {}
  }
  if (this.voice === voice) this.voice=null;
  voice.resolve(completed);
 }
 async close(context) {
  if (!context) return;
  context.onstatechange=null;
  if (this.context === context) this.context=null;
  try { if (context.state !== 'closed') await context.close(); } catch {}
 }
 async dispose() {
  this.disposed=true;
  await this.stop(); await this.close(this.context);
 }
}

// Owns asynchronous hand-offs, never the timer. Every action invalidates older
// work before waiting for a fade or an onended callback.
class SessionAudio {
 constructor(binaural,bell,getState,getSettings) {
  this.binaural=binaural; this.bell=bell; this.getState=getState; this.getSettings=getSettings;
  this.version=0; this.busy=false; this.disposed=false;
 }
 prepare() { if (this.getSettings().bellEnabled) void this.bell.prepare(); }
 startFocus() {
  const state=this.getState();
  if (!this.disposed && !this.busy && this.getSettings().binauralEnabled !== false && state.phase === 'focus' && state.status === 'running') {
   void this.binaural.start(this.getSettings().audioGain,() => {
    const current=this.getState();
    return !this.disposed && current.phase === 'focus' && current.status === 'running' ? current.remainingMs : 0;
   });
  }
 }
 async transition(preview=false) {
  const token=++this.version; this.busy=true;
  const settings=this.getSettings();
  const ready=(settings.bellEnabled || preview) ? this.bell.prepare() : Promise.resolve(null);
  const silence=this.binaural.stop(0.5),previous=this.bell.stop();
  try {
   const [,,context]=await Promise.all([silence,previous,ready]);
   if (token !== this.version || this.disposed) return;
   if (context && (this.getSettings().bellEnabled || preview)) await this.bell.play(this.getSettings().bellGain);
  } catch {
   // Audio failures must never reject into the timer's transition listener.
  } finally {
   if (token === this.version && !this.disposed) { this.busy=false; this.startFocus(); }
  }
 }
 cancel() {
  ++this.version; this.busy=false;
  void this.binaural.stop(); void this.bell.stop();
 }
 async disableBell() {
  const token=++this.version; this.busy=true;
  try { await this.bell.stop(); }
  finally {
   if (token === this.version && !this.disposed) { this.busy=false; this.startFocus(); }
  }
 }
 dispose() {
  this.disposed=true; ++this.version; this.busy=false;
  return Promise.all([this.binaural.dispose(),this.bell.dispose()]);
 }
}

const SEGMENTS = [
 'M12 2H39L44 7L39 12H13L7 7Z',
 'M46 10L50 15V39L45 44L40 39V16Z',
 'M45 46L50 51V75L46 81L40 75V52Z',
 'M13 78H39L44 83L39 88H12L7 83Z',
 'M5 46L10 52V75L4 81L0 75V51Z',
 'M4 10L10 16V39L5 44L0 39V15Z',
 'M12 40H39L44 45L39 50H12L6 45Z'
];
const DIGITS = ['012345','12','01643','01236','1256','02563','023456','012','0123456','012356'];

function validMinutes(value) {
 return Number.isInteger(value) && value >= 1 && value <= 180;
}
function formatTime(ms) {
 const seconds = Math.ceil(Math.max(0, ms) / 1000);
 return String(Math.floor(seconds / 60)).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0');
}

// The deadline is authoritative; intervals only refresh the visible state.
class Timer {
 constructor(settings, snapshot, now = () => Date.now(), restorePaused=false) {
  this.now = now;
  this.listeners = new Set(); this.transitionId=0;
  this.settings = {
   focusMinutes:validMinutes(settings?.focusMinutes) ? settings.focusMinutes : DEFAULTS.focusMinutes,
   breakMinutes:validMinutes(settings?.breakMinutes) ? settings.breakMinutes : DEFAULTS.breakMinutes
  };
  this.state = this.freshState();
  if (this.validSnapshot(snapshot)) {
   const {phase,status,remainingMs,endTime} = snapshot;
   this.state = {phase,status,remainingMs,endTime:status === 'running' ? endTime : null};
  }
  // Rebase checkpoints before ticking so time outside the app never counts.
  if (restorePaused && this.state.status === 'running') this.state.endTime=this.now()+this.state.remainingMs;
  this.tick();
  if (restorePaused) this.pause();
 }
 duration(phase) { return this.settings[phase === 'focus' ? 'focusMinutes' : 'breakMinutes'] * MINUTE; }
 freshState() { return {phase:'focus', status:'ready', remainingMs:this.duration('focus'), endTime:null}; }
 validSnapshot(s) {
  if (!s || !['focus','break'].includes(s.phase) || !['ready','running','paused'].includes(s.status)) return false;
  if (!Number.isFinite(s.remainingMs) || s.remainingMs < 0 || s.remainingMs > this.duration(s.phase)) return false;
  if (s.status === 'ready') return s.phase === 'focus' && s.remainingMs === this.duration('focus');
  if (s.status === 'running') return Number.isFinite(s.endTime) && s.endTime >= 0 && s.endTime <= this.now() + this.duration(s.phase);
  return s.remainingMs > 0;
 }
 getState() {
  return {...this.state, ...this.settings, remainingMs:this.state.status === 'running' ? Math.max(0,this.state.endTime - this.now()) : this.state.remainingMs};
 }
 subscribe(listener) {
  this.listeners.add(listener);
  listener(this.getState(), false);
  return () => this.listeners.delete(listener);
 }
 emit(persist,transition) { for (const listener of this.listeners) listener(this.getState(), persist, transition); }
 switchPhase(state,reason) {
  const from=this.state.phase;
  this.state=state;
  this.emit(true,{id:++this.transitionId,from,to:state.phase,reason});
 }
 tick() {
  if (this.state.status !== 'running' || this.now() < this.state.endTime) { this.emit(false); return; }
  if (this.state.phase === 'focus') {
   this.switchPhase({phase:'break',status:'running',remainingMs:this.duration('break'),endTime:this.state.endTime+this.duration('break')},'deadline');
  } else { this.switchPhase(this.freshState(),'deadline'); }
  if (this.state.status === 'running' && this.now() >= this.state.endTime) this.switchPhase(this.freshState(),'deadline');
 }
 next() {
  if (this.state.status === 'ready') return;
  const phase=this.state.phase === 'focus' ? 'break' : 'focus';
  this.switchPhase({phase,status:'running',remainingMs:this.duration(phase),endTime:this.now()+this.duration(phase)},'next');
 }
 start() {
  this.tick();
  if (this.state.status === 'running') return;
  this.state = {...this.state, status:'running', endTime:this.now() + this.state.remainingMs};
  this.emit(true);
 }
 pause() {
  this.tick();
  if (this.state.status !== 'running') return;
  this.state = {...this.state, status:'paused', remainingMs:this.getState().remainingMs, endTime:null};
  this.emit(true);
 }
 reset() { this.state = this.freshState(); this.emit(true); }
 stop() { this.reset(); }
 setDurations(focusMinutes, breakMinutes) {
  if (!validMinutes(focusMinutes) || !validMinutes(breakMinutes)) throw Error('Nhập số phút nguyên từ 1 đến 180.');
  if (this.state.status !== 'ready') throw Error('Đặt lại đồng hồ trước khi chỉnh thời gian.');
  if (this.settings.focusMinutes === focusMinutes && this.settings.breakMinutes === breakMinutes) return;
  this.settings = {focusMinutes,breakMinutes};
  this.state = this.freshState();
  this.emit(true);
 }
 serialize() {
  const {phase,status,remainingMs,endTime} = this.getState();
  return {version:1, settings:{...this.settings}, timer:{phase,status,remainingMs,endTime}};
 }
}

function element(tag,parent,text,className) {
 const el = parent.ownerDocument.createElement(tag);
 if (className) el.className = className;
 if (text !== undefined) el.textContent = text;
 parent.appendChild(el);
 return el;
}
function svgElement(tag,parent,attributes) {
 const el = parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg',tag);
 for (const [key,value] of Object.entries(attributes)) el.setAttribute(key,value);
 parent.appendChild(el);
 return el;
}
function text(el,value) { if (el.textContent !== value) el.textContent = value; }

class PomodoroBoard extends MarkdownRenderChild {
 constructor(container,plugin,ownerLeaf=null) { super(container); this.plugin=plugin; this.ownerLeaf=ownerLeaf; this.dirty=false; this.inputError=''; }
 onload() {
  this.root = element('section',this.containerEl,undefined,'pomodoro-dashboard');
  this.root.setAttribute('aria-label','Đồng hồ Pomodoro');
  const panel = element('div',this.root,undefined,'pm-panel');
  const header = element('header',panel,undefined,'pm-header');
  element('h2',header,'Pomodoro','pm-title');
  this.status = element('span',header,undefined,'pm-sr-only'); this.status.setAttribute('role','status');
  const body = element('div',panel,undefined,'pm-body');
  const timer = element('div',body,undefined,'pm-timer');
  const clock = element('div',timer,undefined,'pm-clock');
  const lcd = element('div',clock,undefined,'pm-lcd');
  this.phase = element('div',lcd,undefined,'pm-phase');
  this.display = element('div',lcd,undefined,'pm-display');
  this.display.setAttribute('role','img');
  this.svg = svgElement('svg',this.display,{'aria-hidden':'true',class:'pm-digits',preserveAspectRatio:'xMidYMid meet'});
  const next = element('p',lcd,undefined,'pm-next');
  element('span',next,'Tiếp theo:');
  this.nextLabel = element('span',next);
  element('span',next,'·').setAttribute('aria-hidden','true');
  this.nextTime = element('span',next,undefined,'pm-next-time');
  const controls = element('div',timer,undefined,'pm-controls');
  this.startButton = element('button',controls,'Bắt đầu','pm-primary'); this.startButton.type='button';
  this.resetButton = element('button',controls,'Đặt lại'); this.resetButton.type='button';
  this.nextButton = element('button',controls,'Chuyển phiên'); this.nextButton.type='button';
  this.registerDomEvent(this.nextButton,'click',() => this.plugin.nextTimer(this));
  const setup = element('div',body,undefined,'pm-setup');
  const toggle=element('label',setup,undefined,'pm-binaural-toggle');
  element('span',toggle,'Binaural beats');
  this.binauralInput=element('input',toggle); this.binauralInput.type='checkbox';
  this.binauralInput.setAttribute('role','switch'); this.binauralInput.setAttribute('aria-label','Binaural beats');
  this.binauralInput.setAttribute('title','Tai nghe stereo · tắt Mono audio. Chỉ bật/tắt âm binaural; chuông vẫn reo.');
  element('span',toggle,undefined,'pm-switch-track').setAttribute('aria-hidden','true');
  this.registerDomEvent(this.binauralInput,'change',() => this.plugin.setBinauralEnabled(this.binauralInput.checked,this));
  const settings = element('div',setup,undefined,'pm-settings');
  this.focusInput = this.durationField(settings,'Thời gian học');
  this.breakInput = this.durationField(settings,'Thời gian nghỉ');
  const feedback = this.feedback = element('div',setup,undefined,'pm-feedback');
  this.message = element('p',feedback,undefined,'pm-message'); this.message.setAttribute('role','status');
  this.retryButton = element('button',feedback,'Thử lưu lại'); this.retryButton.type='button';
  this.registerDomEvent(this.startButton,'click',() => {
   const state = this.plugin.timer.getState();
   if (state.status === 'ready' && !this.applyDurations()) return;
   if (state.status === 'running') this.plugin.timer.pause(); else this.plugin.startTimer(this);
  });
  this.registerDomEvent(this.resetButton,'click',() => {
   this.dirty=false; this.inputError=''; this.plugin.timer.reset();
  });
  this.registerDomEvent(this.retryButton,'click',() => { void this.plugin.persist(); });
  this.plugin.boards.add(this);
  this.unsubscribe = this.plugin.timer.subscribe(state => this.renderState(state));
  this.register(() => this.unsubscribe());
  this.renderAudio();
 }
 durationField(parent,labelText) {
  const label = element('label',parent,undefined,'pm-field');
  element('span',label,labelText);
  const wrap = element('span',label,undefined,'pm-input-wrap');
  const input = element('input',wrap);
  input.type='number'; input.min='1'; input.max='180'; input.step='1'; input.required=true;
  input.setAttribute('aria-label',labelText+' (1 đến 180 phút)');
  element('span',wrap,'phút');
  this.registerDomEvent(input,'input',() => { this.dirty=true; });
  this.registerDomEvent(input,'change',() => this.applyDurations());
  return input;
 }
 applyDurations() {
  const focus = Number(this.focusInput.value), rest = Number(this.breakInput.value);
  const focusValid = validMinutes(focus), restValid = validMinutes(rest);
  for (const [el,valid] of [[this.focusInput,focusValid],[this.breakInput,restValid]]) {
   if (valid) el.removeAttribute('aria-invalid'); else el.setAttribute('aria-invalid','true');
  }
  if (!focusValid || !restValid) {
   this.dirty=true; this.inputError='Nhập số phút nguyên từ 1 đến 180.'; this.renderFeedback();
   (!focusValid ? this.focusInput : this.breakInput).focus();
   return false;
  }
  try {
   this.dirty=false; this.inputError='';
   this.plugin.timer.setDurations(focus,rest);
   this.renderState(this.plugin.timer.getState());
   return true;
  } catch (error) {
   this.inputError=error.message; this.renderFeedback(); return false;
  }
 }
 buildDigits(value) {
  this.svg.replaceChildren(); this.digitNodes=[];
  let x=1;
  for (const char of value) {
   const group = svgElement('g',this.svg,{transform:`translate(${x} 1)`});
   if (char === ':') {
    for (const cy of [31,61]) svgElement('circle',group,{cx:6,cy,r:3});
    x += 22;
   } else {
    const paths = SEGMENTS.map(d => svgElement('path',group,{d,'stroke-width':1.2,'stroke-linejoin':'round'}));
    this.digitNodes.push({paths}); x += 60;
   }
  }
  this.svg.setAttribute('viewBox',`0 0 ${x-8} 94`);
  this.digitCount=value.length;
 }
 renderState(state) {
  if (this.disposed) return;
  const value = formatTime(state.remainingMs);
  if (value !== this.lastTime) {
   if (this.digitCount !== value.length) this.buildDigits(value);
   let index=0;
   for (const char of value) {
    if (char === ':') continue;
    this.digitNodes[index++].paths.forEach((path,i) => path.setAttribute('class',DIGITS[Number(char)].includes(String(i)) ? 'pm-segment-active' : 'pm-segment-hidden'));
   }
   const [minutes,seconds] = value.split(':');
   this.display.setAttribute('aria-label',`${Number(minutes)} phút ${seconds} giây`);
   this.lastTime=value;
  }
  const isBreak=state.phase === 'break';
  text(this.phase,isBreak ? 'Nghỉ ngơi' : 'Tập trung');
  text(this.status,state.status === 'ready' ? 'Sẵn sàng' : state.status === 'paused' ? 'Tạm dừng' : isBreak ? 'Đang nghỉ' : 'Đang học');
  text(this.startButton,state.status === 'ready' ? 'Bắt đầu' : state.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng');
  text(this.nextLabel,isBreak ? 'Tập trung' : 'Nghỉ ngơi');
  text(this.nextTime,formatTime((isBreak ? state.focusMinutes : state.breakMinutes)*MINUTE));
  const locked = state.status !== 'ready';
  this.focusInput.disabled=locked; this.breakInput.disabled=locked; this.nextButton.disabled=state.status === 'ready';
  if (!this.dirty || locked) {
   this.focusInput.value=String(state.focusMinutes); this.breakInput.value=String(state.breakMinutes);
   this.focusInput.removeAttribute('aria-invalid'); this.breakInput.removeAttribute('aria-invalid');
   this.dirty=false; this.inputError='';
  }
  this.renderFeedback();
 }
 renderFeedback() {
  const message = this.inputError || this.plugin.storageError || this.plugin.audioError || '';
  text(this.message,message); this.message.hidden=!message;
  this.retryButton.hidden=!this.plugin.storageError;
  this.feedback.hidden=!message;
 }
 renderAudio() {
  this.binauralInput.checked=this.plugin.binauralEnabled;
 }
 onunload() {
  if (this.disposed) return;
  this.disposed=true;
  this.unsubscribe?.(); this.plugin.boards.delete(this); this.root?.remove();
  this.containerEl.classList.remove('pm-board-embed');
 }
}

class PomodoroView extends ItemView {
 constructor(leaf,plugin) { super(leaf); this.plugin=plugin; }
 getViewType() { return VIEW_TYPE; }
 getDisplayText() { return 'Pomodoro'; }
 getIcon() { return 'timer'; }
 async onOpen() {
  this.contentEl.classList.add('pomodoro-view'); this.contentEl.replaceChildren();
  this.board=new PomodoroBoard(this.contentEl,this.plugin,this.leaf); this.addChild(this.board);
 }
 async onClose() {
  if (!this.plugin.stopped && (!this.plugin.ownerLeaf || this.plugin.ownerLeaf === this.leaf)) {
   this.plugin.timer.pause(); this.plugin.sounds.cancel(); this.plugin.ownerLeaf=null;
  }
  if (this.board) { this.removeChild(this.board); this.board=null; }
  this.contentEl.classList.remove('pomodoro-view');
 }
}

module.exports = class PomodoroPlugin extends Plugin {
 async onload() {
  this.boards=new Set(); this.saveQueue=Promise.resolve(); this.storageError=''; this.stopped=false; this.ownerLeaf=null;
  let data=null;
  try {
   data=await this.loadData();
   if (data && data.version !== 1) {
    this.storageError='Dữ liệu Pomodoro không tương thích. Đang dùng thời gian mặc định.'; data=null;
   }
  } catch {
   this.storageError='Không đọc được dữ liệu Pomodoro. Đang dùng thời gian mặc định.';
  }
  if (this.stopped) return;
  this.timer=new Timer(data?.settings,data?.timer,undefined,true);
  const currentAudio=data?.audio?.version === 2;
  this.audioGain=currentAudio && validAudioGain(data.audio.gain) ? data.audio.gain : DEFAULT_AUDIO_GAIN;
  this.binauralEnabled=typeof data?.audio?.binauralEnabled === 'boolean' ? data.audio.binauralEnabled : true;
  this.audioError='';
  this.bellEnabled=currentAudio && typeof data?.audio?.bellEnabled === 'boolean' ? data.audio.bellEnabled : true;
  this.bellGain=currentAudio && validBellGain(data.audio.bellGain) ? data.audio.bellGain : DEFAULT_BELL_GAIN;
  this.audio=new BinauralAudio(() => this.createAudioContext(),() => {
   if (!this.stopped) {
    this.audioError='Không phát được âm thanh. Tạm dừng rồi Tiếp tục để thử lại.';
    for (const board of this.boards) board.renderFeedback();
   }
  });
  this.bell=new BellAudio(() => this.createAudioContext(),() => {
   if (!this.stopped) {
    this.audioError='Không phát được chuông. Tạm dừng rồi Tiếp tục để thử lại; đồng hồ vẫn chạy.';
    for (const board of this.boards) board.renderFeedback();
   }
  });
  this.sounds=new SessionAudio(this.audio,this.bell,() => this.timer.getState(),() => ({audioGain:this.audioGain,binauralEnabled:this.binauralEnabled,bellEnabled:this.bellEnabled,bellGain:this.bellGain}));
  this.unsubscribe=this.timer.subscribe((_state,changed,transition) => {
   if (transition) void this.sounds.transition();
   else if (changed && _state.status !== 'running') this.sounds.cancel();
   if (changed) {
    if (_state.status === 'ready' && !transition) this.ownerLeaf=null;
    if (transition?.reason === 'next') new Notice(transition.to === 'focus' ? 'Bắt đầu phiên học mới.' : 'Bắt đầu nghỉ ngơi.');
    else if (transition?.to === 'break') new Notice('Hết giờ học. Bắt đầu nghỉ ngơi.');
    else if (transition?.to === 'focus') new Notice('Đã hết giờ nghỉ. Sẵn sàng cho phiên học mới.');
    void this.persist();
   }
  });
  this.register(this.unsubscribe);
  this.registerInterval(setInterval(() => { this.checkOwner(); this.timer.tick(); },250));
  this.registerEvent(this.app.workspace.on('layout-change',() => this.checkOwner()));
  this.registerEvent(this.app.workspace.on('quit',tasks => {
   const pending=this.shutdown();
   tasks.add(() => pending);
  }));
  this.registerView(VIEW_TYPE,leaf => new PomodoroView(leaf,this));
  this.registerMarkdownCodeBlockProcessor('pomodoro',(_source,el,ctx) => {
   el.classList.add('pm-board-embed');
   ctx.addChild(new PomodoroBoard(el,this));
  });
  this.addRibbonIcon('timer','Pomodoro',() => { void this.openDashboard(); });
  this.addCommand({id:'open-pomodoro',name:'Mở đồng hồ Pomodoro',callback:() => this.openDashboard()});
  this.addCommand({id:'toggle-pomodoro',name:'Bắt đầu / tạm dừng Pomodoro',callback:() => {
   if (this.timer.getState().status === 'running') this.timer.pause(); else this.startTimer();
  }});
  this.addCommand({id:'reset-pomodoro',name:'Đặt lại Pomodoro',callback:() => this.timer.reset()});
  this.addCommand({id:'next-pomodoro',name:'Chuyển sang phiên tiếp theo',callback:() => this.nextTimer()});
  if (this.storageError) new Notice(this.storageError);
 }
 findOwnerLeaf(board) {
  if (board.ownerLeaf) return board.ownerLeaf;
  let found=null;
  this.app.workspace.iterateAllLeaves(leaf => {
   const container=leaf.view?.containerEl || leaf.view?.contentEl;
   if (container?.contains(board.root)) found=leaf;
  });
  return found;
 }
 createAudioContext() {
  const win=this.audioWindow || globalThis,Constructor=win.AudioContext || win.webkitAudioContext;
  if (!Constructor) throw Error('Web Audio is unavailable');
  return new Constructor();
 }
 prepareSound(board) {
  this.audioWindow=board?.containerEl.ownerDocument.defaultView || globalThis;
  this.audioError='';
  for (const current of this.boards) current.renderFeedback();
  this.sounds.prepare();
 }
 startTimer(board) {
  if (this.stopped) return;
  this.prepareSound(board);
  const owner=(board && this.findOwnerLeaf(board)) || this.app.workspace.activeLeaf || null;
  this.timer.start(); this.ownerLeaf=owner;
  this.sounds.startFocus();
 }
 nextTimer(board) {
  if (this.stopped) return;
  if (this.timer.getState().status === 'ready') return;
  this.prepareSound(board);
  this.ownerLeaf=(board && this.findOwnerLeaf(board)) || this.app.workspace.activeLeaf || this.ownerLeaf;
  this.timer.next();
 }
 previewBell(board) {
  this.prepareSound(board);
  if (this.timer.getState().status !== 'running') {
   this.ownerLeaf=(board && this.findOwnerLeaf(board)) || this.app.workspace.activeLeaf || null;
  }
  void this.sounds.transition(true);
 }
 setBellSettings({enabled,gain},save=false,board) {
  if (typeof enabled === 'boolean') {
   this.bellEnabled=enabled;
   if (enabled) this.prepareSound(board);
   else this.sounds.disableBell();
  }
  if (validBellGain(gain)) { this.bellGain=gain; this.bell.setVolume(gain); }
  for (const current of this.boards) current.renderAudio();
  if (save) void this.persist();
 }
 setBinauralEnabled(enabled,board) {
  this.binauralEnabled=enabled;
  if (!enabled) void this.audio.stop();
  else {
   this.audioWindow=board?.containerEl.ownerDocument.defaultView || globalThis;
   this.audioError=''; this.sounds.startFocus();
  }
  for (const current of this.boards) { current.renderAudio(); current.renderFeedback(); }
  void this.persist();
 }
 setAudioGain(value,save=false) {
  if (!validAudioGain(value)) return;
  this.audioGain=value; this.audio.setVolume(value);
  for (const board of this.boards) board.renderAudio();
  if (save) void this.persist();
 }
 checkOwner() {
  if (this.stopped) return;
  if (this.timer.getState().status !== 'running' && !this.sounds.busy && !this.bell.voice && !this.audio.voice) return;
  if (!this.ownerLeaf) {
   // A restored timer may be loaded before its note renderer is attached.
   for (const board of this.boards) {
    this.ownerLeaf=this.findOwnerLeaf(board);
    if (this.ownerLeaf) break;
   }
   return;
  }
  let present=false;
  this.app.workspace.iterateAllLeaves(leaf => { if (leaf === this.ownerLeaf) present=true; });
  if (!present) { this.ownerLeaf=null; this.timer.pause(); this.sounds.cancel(); }
 }
 persist() {
  const snapshot=this.timer.serialize();
  // Save a paused checkpoint even during a live session. Forced termination
  // may skip quit/unload; reopening must still require an explicit Continue.
  if (snapshot.timer.status === 'running' && snapshot.timer.remainingMs > 0) {
   snapshot.timer.status='paused'; snapshot.timer.endTime=null;
  }
  snapshot.audio={version:2,binauralEnabled:this.binauralEnabled,gain:this.audioGain,bellEnabled:this.bellEnabled,bellGain:this.bellGain};
  this.saveQueue=this.saveQueue.then(async () => {
   try {
    await this.saveData(snapshot);
    this.storageError='';
   } catch {
    const message='Không lưu được Pomodoro. Đồng hồ vẫn chạy; nhấn Thử lưu lại.';
    if (!this.storageError && !this.stopped) new Notice(message);
    this.storageError=message;
   }
   if (!this.stopped) for (const board of this.boards) board.renderFeedback();
  });
  return this.saveQueue;
 }
 async openDashboard() {
  if (this.stopped) return;
  if (this.opening) return this.opening;
  this.opening=(async () => {
   try {
    const workspace=this.app.workspace;
    let leaf=workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
     leaf=workspace.getLeaf('tab');
     await leaf.setViewState({type:VIEW_TYPE,active:true});
    }
    if (!this.stopped) await workspace.revealLeaf(leaf);
   } catch { if (!this.stopped) new Notice('Không mở được Pomodoro. Hãy thử lại.'); }
  })();
  try { await this.opening; } finally { this.opening=null; }
 }
 shutdown() {
  if (this.shutdownTask) return this.shutdownTask;
  this.stopped=true;
  this.unsubscribe?.();
  this.timer?.pause();
  this.shutdownTask=Promise.all([this.sounds?.dispose(),this.timer ? this.persist() : Promise.resolve()]);
  return this.shutdownTask;
 }
 onunload() {
  void this.shutdown();
  for (const board of [...this.boards]) board.onunload();
  for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.detach();
 }
};
