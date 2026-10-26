const {Plugin, ItemView, MarkdownRenderChild, Notice} = require('obsidian');

const VIEW_TYPE = 'pomodoro-view';
const DEFAULTS = {focusMinutes:25, breakMinutes:5};
const MINUTE = 60000;
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
 constructor(settings, snapshot, now = () => Date.now()) {
  this.now = now;
  this.listeners = new Set();
  this.settings = {
   focusMinutes:validMinutes(settings?.focusMinutes) ? settings.focusMinutes : DEFAULTS.focusMinutes,
   breakMinutes:validMinutes(settings?.breakMinutes) ? settings.breakMinutes : DEFAULTS.breakMinutes
  };
  this.state = this.freshState();
  if (this.validSnapshot(snapshot)) {
   const {phase,status,remainingMs,endTime} = snapshot;
   this.state = {phase,status,remainingMs,endTime:status === 'running' ? endTime : null};
  }
  this.tick();
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
 tick() {
  let changed = false;
  if (this.state.status === 'running' && this.now() >= this.state.endTime) {
   if (this.state.phase === 'focus') {
    this.state = {phase:'break', status:'running', remainingMs:this.duration('break'), endTime:this.state.endTime + this.duration('break')};
   } else {
    this.state = this.freshState();
   }
   if (this.state.status === 'running' && this.now() >= this.state.endTime) this.state = this.freshState();
   changed = true;
  }
  this.emit(changed,changed ? this.state.phase === 'break' ? 'break-started' : 'break-finished' : undefined);
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
 constructor(container,plugin) { super(container); this.plugin=plugin; this.dirty=false; this.inputError=''; }
 onload() {
  this.root = element('section',this.containerEl,undefined,'pomodoro-dashboard');
  this.root.setAttribute('aria-label','Đồng hồ Pomodoro');
  const panel = element('div',this.root,undefined,'pm-panel');
  const header = element('header',panel,undefined,'pm-header');
  element('h2',header,'Pomodoro','pm-title');
  const status = element('div',header,undefined,'pm-status');
  const dot = element('span',status,undefined,'pm-dot'); dot.setAttribute('aria-hidden','true');
  this.status = element('span',status); this.status.setAttribute('role','status');
  const clock = element('div',panel,undefined,'pm-clock');
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
  const controls = element('div',panel,undefined,'pm-controls');
  this.startButton = element('button',controls,'Bắt đầu','pm-primary'); this.startButton.type='button';
  this.resetButton = element('button',controls,'Đặt lại'); this.resetButton.type='button';
  const settings = element('div',panel,undefined,'pm-settings');
  this.focusInput = this.durationField(settings,'Thời gian học');
  this.breakInput = this.durationField(settings,'Thời gian nghỉ');
  this.hint = element('p',panel,undefined,'pm-hint');
  const feedback = this.feedback = element('div',panel,undefined,'pm-feedback');
  this.message = element('p',feedback,undefined,'pm-message'); this.message.setAttribute('role','status');
  this.retryButton = element('button',feedback,'Thử lưu lại'); this.retryButton.type='button';
  this.registerDomEvent(this.startButton,'click',() => {
   const state = this.plugin.timer.getState();
   if (state.status === 'ready' && !this.applyDurations()) return;
   if (state.status === 'running') this.plugin.timer.pause(); else this.plugin.timer.start();
  });
  this.registerDomEvent(this.resetButton,'click',() => {
   this.dirty=false; this.inputError=''; this.plugin.timer.reset();
  });
  this.registerDomEvent(this.retryButton,'click',() => { void this.plugin.persist(); });
  this.plugin.boards.add(this);
  this.unsubscribe = this.plugin.timer.subscribe(state => this.renderState(state));
  this.register(() => this.unsubscribe());
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
  this.focusInput.disabled=locked; this.breakInput.disabled=locked;
  if (!this.dirty || locked) {
   this.focusInput.value=String(state.focusMinutes); this.breakInput.value=String(state.breakMinutes);
   this.focusInput.removeAttribute('aria-invalid'); this.breakInput.removeAttribute('aria-invalid');
   this.dirty=false; this.inputError='';
  }
  text(this.hint,locked ? 'Hết giờ học sẽ tự nghỉ. Đặt lại để chỉnh thời gian.' : 'Hết giờ học, đồng hồ tự bắt đầu thời gian nghỉ.');
  this.renderFeedback();
 }
 renderFeedback() {
  const message = this.inputError || this.plugin.storageError || '';
  text(this.message,message); this.message.hidden=!message;
  this.retryButton.hidden=!this.plugin.storageError;
  this.feedback.hidden=!message;
 }
 onunload() {
  if (this.disposed) return;
  this.disposed=true;
  this.unsubscribe?.(); this.plugin.boards.delete(this); this.root?.remove();
 }
}

class PomodoroView extends ItemView {
 constructor(leaf,plugin) { super(leaf); this.plugin=plugin; }
 getViewType() { return VIEW_TYPE; }
 getDisplayText() { return 'Pomodoro'; }
 getIcon() { return 'timer'; }
 async onOpen() {
  this.contentEl.classList.add('pomodoro-view'); this.contentEl.replaceChildren();
  this.board=new PomodoroBoard(this.contentEl,this.plugin); this.addChild(this.board);
 }
 async onClose() {
  if (this.board) { this.removeChild(this.board); this.board=null; }
  this.contentEl.classList.remove('pomodoro-view');
 }
}

module.exports = class PomodoroPlugin extends Plugin {
 async onload() {
  this.boards=new Set(); this.saveQueue=Promise.resolve(); this.storageError=''; this.stopped=false;
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
  this.timer=new Timer(data?.settings,data?.timer);
  this.unsubscribe=this.timer.subscribe((_state,changed,transition) => {
   if (changed) {
    if (transition === 'break-started') new Notice('Hết giờ học. Bắt đầu nghỉ ngơi.');
    else if (transition === 'break-finished') new Notice('Đã hết giờ nghỉ. Sẵn sàng cho phiên học mới.');
    void this.persist();
   }
  });
  this.register(this.unsubscribe);
  this.registerInterval(setInterval(() => this.timer.tick(),250));
  this.registerView(VIEW_TYPE,leaf => new PomodoroView(leaf,this));
  this.registerMarkdownCodeBlockProcessor('pomodoro',(_source,el,ctx) => { ctx.addChild(new PomodoroBoard(el,this)); });
  this.addRibbonIcon('timer','Pomodoro',() => { void this.openDashboard(); });
  this.addCommand({id:'open-pomodoro',name:'Mở đồng hồ Pomodoro',callback:() => this.openDashboard()});
  this.addCommand({id:'toggle-pomodoro',name:'Bắt đầu / tạm dừng Pomodoro',callback:() => {
   if (this.timer.getState().status === 'running') this.timer.pause(); else this.timer.start();
  }});
  this.addCommand({id:'reset-pomodoro',name:'Đặt lại Pomodoro',callback:() => this.timer.reset()});
  if (this.storageError) new Notice(this.storageError);
 }
 persist() {
  const snapshot=this.timer.serialize();
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
 onunload() {
  this.stopped=true;
  if (this.timer) { void this.persist(); this.unsubscribe?.(); }
  for (const board of [...this.boards]) board.onunload();
  for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.detach();
 }
};
