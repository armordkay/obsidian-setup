let boardSequence=0;
function dbElement(tag,parent,text,className) {
 const el=parent.ownerDocument.createElement(tag);
 if (className) el.className=className;
 if (text !== undefined) el.textContent=String(text);
 parent.appendChild(el); return el;
}
function dbButton(parent,text,label,className) {
 const button=dbElement('button',parent,text,className); button.type='button';
 if (label) button.setAttribute('aria-label',label);
 return button;
}
function dbText(el,value) { const text=String(value); if (el.textContent !== text) el.textContent=text; }
function dayDescription(day,entry,settings) {
 return entry ? `${day} · Level ${entry.level} · ${settings.level2.property}: ${entry.level2Value} · ${settings.level3.property}: ${entry.level3Value}` : `${day} · No daily note`;
}

class DashboardBoard extends MarkdownRenderChild {
 constructor(container,plugin) {
  super(container); this.plugin=plugin; this.id='db-'+(++boardSequence);
  this.today=localDay(plugin.now()); this.selected=this.today;
  this.detailsVisible=false; this.results=[]; this.activeResult=-1; this.composing=false; this.disposed=false;
 }
 onload() {
  const root=this.root=dbElement('section',this.containerEl,undefined,'vault-dashboard');
  root.setAttribute('aria-label','Dashboard');
  const hero=dbElement('section',root,undefined,'db-hero'); hero.setAttribute('aria-label','Daily overview');
  const searchWrap=dbElement('div',hero,undefined,'db-search-wrap');
  const label=dbElement('label',searchWrap,undefined,'db-search');
  const icon=dbElement('span',label,undefined,'db-search-icon'); icon.setAttribute('aria-hidden','true'); setIcon(icon,'search');
  this.search=dbElement('input',label); this.search.type='search'; this.search.autocomplete='off';
  this.search.placeholder='Search files in your vault…';
  this.search.setAttribute('aria-label','Search files in your vault'); this.search.setAttribute('role','combobox');
  this.search.setAttribute('aria-autocomplete','list'); this.search.setAttribute('aria-expanded','false');
  this.search.setAttribute('aria-controls',this.id+'-results');
  dbElement('kbd',label,'Enter');
  this.resultBox=dbElement('div',searchWrap,undefined,'db-results'); this.resultBox.id=this.id+'-results';
  this.resultBox.setAttribute('role','listbox'); this.resultBox.setAttribute('aria-label','Matching files'); this.resultBox.hidden=true;
  this.searchStatus=dbElement('span',searchWrap,undefined,'db-sr-only'); this.searchStatus.setAttribute('role','status');
  const intro=dbElement('div',hero,undefined,'db-intro');
  const portrait=dbElement('div',intro,undefined,'db-avatar-frame');
  this.avatar=dbElement('img',portrait,undefined,'db-avatar');this.avatar.src=AVATAR_SRC;this.avatar.alt='Sleeping cat';this.avatar.width=1350;this.avatar.height=1350;this.avatar.decoding='async';
  this.registerDomEvent(this.avatar,'error',()=>{if(this.avatar.src!==AVATAR_SRC){this.avatar.src=AVATAR_SRC;this.avatar.alt='Sleeping cat';this.avatar.title='Could not load the saved avatar. Choose another image in Set up.';}});
  const dateBlock=dbElement('div',intro,undefined,'db-date-block');
  this.weekday=dbElement('p',dateBlock,undefined,'db-weekday'); this.heading=dbElement('h1',dateBlock);
  this.clock=dbElement('time',dateBlock,undefined,'db-clock');this.clock.setAttribute('aria-label','Local time');
  const activityPanel=dbElement('section',root,undefined,'db-activity'); activityPanel.setAttribute('aria-label','Daily note activity');
  const activityHeader=dbElement('div',activityPanel,undefined,'db-activity-header');
  dbElement('h2',activityHeader,'Activity Signal');
  this.setupButton=dbButton(activityHeader,'Set up','Set up tracker levels','db-setup-toggle');
  this.setupButton.setAttribute('aria-expanded','false');this.setupButton.setAttribute('aria-controls',this.id+'-setup');
  this.registerDomEvent(this.setupButton,'click',()=>{if(this.setupForm.hidden)this.showSetup();else this.closeSetup();});
  this.buildSetup(activityPanel);
  const summary=dbElement('div',activityPanel,undefined,'db-summary'); this.counts=[];this.countLabels=[];
  for (const label of ['active days',this.plugin.settings.level2.property,this.plugin.settings.level3.property]) {
   const span=dbElement('span',summary); this.counts.push(dbElement('strong',span,'0')); this.countLabels.push(dbElement('span',span,label));
  }
  const scroll=this.heatScroll=dbElement('div',activityPanel,undefined,'db-heat-scroll');
  scroll.setAttribute('aria-label','Scrollable activity heatmap');
  const heat=dbElement('div',scroll,undefined,'db-heat');
  this.months=dbElement('div',heat,undefined,'db-months'); this.months.setAttribute('aria-hidden','true');
  const weekdays=dbElement('div',heat,undefined,'db-row-labels'); weekdays.setAttribute('aria-hidden','true');
  for (const label of ['','Mon','','Wed','','Fri','']) dbElement('span',weekdays,label);
  this.cells=dbElement('div',heat,undefined,'db-cells'); this.cells.setAttribute('role','group'); this.cells.setAttribute('aria-label','Daily activity heatmap');
  const legend=dbElement('div',activityPanel,undefined,'db-legend'); legend.setAttribute('aria-label','Activity levels, low to high');
  dbElement('span',legend,'Less');
  this.legendNodes=[];
  for (const [level,description] of ['No daily note','Daily note exists','Deep work: at least 60 minutes','Wins recorded'].entries()) {
   const swatch=dbElement('span',legend,undefined,'db-swatch db-l'+level); swatch.title=description;
   swatch.setAttribute('aria-label',description);
   this.legendNodes.push(swatch);
  }
  dbElement('span',legend,'More');
  this.empty=dbElement('p',activityPanel,'No daily notes in this view.','db-empty'); this.empty.hidden=true;
  this.detail=dbElement('div',activityPanel,undefined,'db-detail'); this.detail.hidden=true;
  const detailText=dbElement('div',this.detail); this.detailTitle=dbElement('strong',detailText); this.detailBody=dbElement('p',detailText);
  this.openButton=dbButton(this.detail,'Open daily');
  this.registerDomEvent(this.openButton,'click',()=>{const entry=this.plugin.index.get(this.selected);if(entry)void this.plugin.openFile(entry.file);});
  this.feedback=dbElement('div',root,undefined,'db-feedback'); this.feedback.hidden=true;
  this.message=dbElement('p',this.feedback); this.message.setAttribute('role','status');
  this.retry=dbButton(this.feedback,'Retry'); this.registerDomEvent(this.retry,'click',()=>void this.plugin.retry());
  // Suggestions may use the in-progress value; only navigation/commit keys
  // belong exclusively to the IME until composition has finished.
  this.registerDomEvent(this.search,'input',()=>this.queueSearch());
  this.registerDomEvent(this.search,'compositionstart',()=>{this.composing=true;this.clearSearchTimer();});
  this.registerDomEvent(this.search,'compositionend',()=>{this.composing=false;if(this.root.ownerDocument.activeElement===this.search)this.queueSearch();});
  this.registerDomEvent(this.search,'focus',()=>{if(this.search.value.trim())this.runSearch();});
  this.registerDomEvent(this.search,'blur',()=>{this.composing=false;this.hideResults();});
  this.registerDomEvent(this.search,'keydown',event=>this.searchKey(event));
  this.registerDomEvent(this.root,'focusout',event=>{if(!this.root.contains(event.relatedTarget))this.hideResults();});
  this.registerDomEvent(this.root.ownerDocument,'pointerdown',event=>{if(!searchWrap.contains(event.target))this.hideResults();});
  this.registerDomEvent(this.cells,'keydown',event=>this.heatKey(event));
  this.register(()=>this.clearSearchTimer());
  this.register(this.plugin.subscribe(()=>this.render()));
  this.plugin.boards.add(this);
  this.renderHeader(); this.buildHeatmap(); this.render();
  // A narrow pane starts at the most recent week, not one year ago.
  this.heatScroll.scrollLeft=this.heatScroll.scrollWidth;
 }
 buildSetup(parent) {
  const form=this.setupForm=dbElement('form',parent,undefined,'db-setup');form.id=this.id+'-setup';form.hidden=true;form.noValidate=true;
  form.setAttribute('aria-label','Tracker setup');
  const avatarGroup=dbElement('fieldset',form,undefined,'db-rule');dbElement('legend',avatarGroup,'Avatar');
  const avatarRow=dbElement('div',avatarGroup,undefined,'db-avatar-settings');
  this.avatarPreview=dbElement('img',avatarRow,undefined,'db-avatar-preview');this.avatarPreview.alt='Current avatar';
  this.registerDomEvent(this.avatarPreview,'error',()=>{if(this.avatarPreview.src!==AVATAR_SRC)this.avatarPreview.src=AVATAR_SRC;});
  const avatarControls=dbElement('div',avatarRow,undefined,'db-avatar-controls'),avatarActions=dbElement('div',avatarControls,undefined,'db-avatar-actions');
  this.avatarChooseButton=dbButton(avatarActions,'Choose image');this.avatarResetButton=dbButton(avatarActions,'Use default');
  this.avatarInput=dbElement('input',avatarControls);this.avatarInput.type='file';this.avatarInput.accept='.png,.jpg,.jpeg,.webp,.gif';this.avatarInput.hidden=true;this.avatarInput.setAttribute('aria-label','Choose avatar image');
  this.avatarFilename=dbElement('p',avatarControls,undefined,'db-avatar-filename');
  dbElement('p',avatarControls,`PNG, JPEG, WebP or GIF, up to 20 MB. Saved to ${this.plugin.avatarFolder()}.`,'db-avatar-help');
  this.registerDomEvent(this.avatarChooseButton,'click',()=>this.avatarInput.click());
  this.registerDomEvent(this.avatarInput,'change',()=>{
   const file=this.avatarInput.files?.[0];if(!file)return;
   this.pendingAvatar=file;this.avatarReset=false;this.setupError.hidden=true;dbText(this.avatarFilename,file.name);
  });
  this.registerDomEvent(this.avatarResetButton,'click',()=>{
   this.pendingAvatar=null;this.avatarReset=true;this.avatarInput.value='';this.avatarPreview.src=AVATAR_SRC;dbText(this.avatarFilename,'Cat (default)');this.setupError.hidden=true;
  });
  dbElement('p',form,'Level 1: Daily note exists.','db-setup-fixed');this.ruleFields=[];
  for (const level of [2,3]) {
   const group=dbElement('fieldset',form,undefined,'db-rule');dbElement('legend',group,'Level '+level);
   const row=dbElement('div',group,undefined,'db-rule-row');
   const propertyLabel=dbElement('label',row,'Property');const property=dbElement('input',propertyLabel);property.type='text';property.autocomplete='off';property.required=true;
   const typeLabel=dbElement('label',row,'Data type');const type=dbElement('select',typeLabel);
   for(const [value,label] of [['text','Text'],['number','Number']]){const option=dbElement('option',type,label);option.value=value;}
   const thresholdLabel=dbElement('label',row,'Minimum value (≥)');const threshold=dbElement('input',thresholdLabel);threshold.type='number';threshold.step='any';
   property.setAttribute('aria-label',`Level ${level} property`);type.setAttribute('aria-label',`Level ${level} data type`);threshold.setAttribute('aria-label',`Level ${level} minimum value`);
   this.registerDomEvent(type,'change',()=>{thresholdLabel.hidden=type.value!=='number';});
   this.ruleFields.push({property,type,threshold,thresholdLabel});
  }
  this.setupError=dbElement('p',form,undefined,'db-setup-error');this.setupError.id=this.id+'-setup-error';this.setupError.hidden=true;this.setupError.setAttribute('role','alert');
  const actions=dbElement('div',form,undefined,'db-setup-actions');
  this.setupSave=dbButton(actions,'Save',undefined,'db-setup-save');this.setupSave.type='submit';
  this.setupCancel=dbButton(actions,'Cancel');this.registerDomEvent(this.setupCancel,'click',()=>this.closeSetup());
  this.registerDomEvent(form,'submit',event=>{event.preventDefault();void this.saveRules();});
  this.registerDomEvent(form,'keydown',event=>{if(event.key==='Escape'&&!this.savingRules){event.preventDefault();this.closeSetup();}});
 }
 showSetup() {
  this.setupForm.hidden=false;this.setupButton.setAttribute('aria-expanded','true');this.setupError.hidden=true;
  this.pendingAvatar=null;this.avatarReset=false;this.avatarInput.value='';this.avatarPreview.src=this.avatar.src;
  dbText(this.avatarFilename,this.plugin.settings.avatarPath.split('/').pop() || 'Cat (default)');
  for(const [i,field] of this.ruleFields.entries()) {
   const rule=this.plugin.settings['level'+(i+2)];field.property.value=rule.property;field.type.value=rule.type;field.threshold.value=String(rule.threshold);
   field.thresholdLabel.hidden=rule.type!=='number';
   for(const control of [field.property,field.threshold]){control.removeAttribute('aria-invalid');control.removeAttribute('aria-describedby');}
  }
  this.ruleFields[0].property.focus();
 }
 closeSetup() {
  if(this.savingRules)return;
  this.setupForm.hidden=true;this.setupButton.setAttribute('aria-expanded','false');this.setupButton.focus();
 }
 async saveRules() {
  if(this.savingRules||this.disposed)return false;
  const rules={};this.setupError.hidden=true;
  for(const [i,field] of this.ruleFields.entries()) {
   for(const control of [field.property,field.threshold]){control.removeAttribute('aria-invalid');control.removeAttribute('aria-describedby');}
   const property=field.property.value.trim(),type=field.type.value;
   const raw=field.threshold.value.trim(),threshold=type==='number' ? Number(raw) : 0;
   const invalid=!property ? field.property : type==='number'&&(!raw||!Number.isFinite(threshold)) ? field.threshold : null;
   if(invalid){
    dbText(this.setupError,`Level ${i+2}: ${!property ? 'enter a property name.' : 'enter a finite minimum value.'}`);
    this.setupError.hidden=false;invalid.setAttribute('aria-invalid','true');invalid.setAttribute('aria-describedby',this.setupError.id);invalid.focus();return false;
   }
   rules['level'+(i+2)]={property,type,threshold};
  }
  this.savingRules=true;this.setSetupDisabled(true);
  try {
   let avatarPath=this.avatarReset ? '' : this.plugin.settings.avatarPath;
   if(this.pendingAvatar){avatarPath=await this.plugin.importAvatar(this.pendingAvatar);this.pendingAvatar=null;}
   if(this.disposed||this.plugin.stopped)return false;
   const saved=await this.plugin.applySettings({...this.plugin.settings,...rules,avatarPath});
   if(this.disposed)return false;
   this.savingRules=false;this.setSetupDisabled(false);this.render();
   if(saved)this.closeSetup();
   else {dbText(this.setupError,'Changes are active but could not be saved. Press Save to try again.');this.setupError.hidden=false;}
   return saved;
  } catch(error) {
   if(!this.disposed){dbText(this.setupError,error.message || 'Could not import this image. Please try again.');this.setupError.hidden=false;}
   return false;
  } finally {
   this.savingRules=false;if(!this.disposed)this.setSetupDisabled(false);
  }
 }
 setSetupDisabled(disabled) {
  for(const field of this.ruleFields)for(const control of [field.property,field.type,field.threshold])control.disabled=disabled;
  this.setupSave.disabled=disabled;this.setupCancel.disabled=disabled;this.setupButton.disabled=disabled;
  this.avatarChooseButton.disabled=disabled;this.avatarResetButton.disabled=disabled;this.avatarInput.disabled=disabled;
 }
 renderAvatar() {
  const source=this.plugin.avatarSource();
  if(source!==this.avatarRequested){this.avatarRequested=source;this.avatar.src=source;this.avatar.alt=this.plugin.settings.avatarPath ? 'Avatar' : 'Sleeping cat';this.avatar.removeAttribute('title');}
 }
 clearSearchTimer() { if (this.searchTimer) clearTimeout(this.searchTimer); this.searchTimer=null; }
 queueSearch() {
  this.clearSearchTimer(); this.searchTimer=setTimeout(()=>{this.searchTimer=null;this.runSearch();},120);
 }
 hideResults() {
  this.clearSearchTimer();
  this.resultBox.hidden=true; this.search.setAttribute('aria-expanded','false'); this.search.removeAttribute('aria-activedescendant');
 }
 runSearch() {
  if (this.disposed) return;
  const previousPath=this.searchQuery===this.search.value ? this.results[this.activeResult]?.path : null;
  this.searchQuery=this.search.value;this.results=searchFiles(this.plugin.app.vault.getFiles(),this.search.value);
  this.activeResult=previousPath ? this.results.findIndex(file=>file.path===previousPath) : -1;
  this.resultBox.replaceChildren();
  if (!this.search.value.trim()) {this.hideResults();dbText(this.searchStatus,'');return;}
  this.resultBox.hidden=false; this.search.setAttribute('aria-expanded','true');
  dbText(this.searchStatus,this.results.length ? `${this.results.length} matching files` : 'No matching files');
  if (!this.results.length) {
   const empty=dbElement('div',this.resultBox,'No matching files.','db-no-results');
   empty.setAttribute('role','option'); empty.setAttribute('aria-disabled','true');
  }
  this.resultNodes=this.results.map((file,i)=>{
   const option=dbElement('div',this.resultBox,undefined,'db-result'); option.id=this.id+'-result-'+i; option.setAttribute('role','option');
   dbElement('span',option,file.name,'db-result-name'); dbElement('span',option,file.path,'db-result-path');
   // Nodes are replaced on each query; their event closures leave with them.
   option.addEventListener('pointerdown',event=>event.preventDefault());
   option.addEventListener('click',()=>{void this.plugin.openFile(file);this.hideResults();});
   return option;
  });
  this.highlightResult();
 }
 highlightResult() {
  for (const [i,node] of (this.resultNodes || []).entries()) {
   node.setAttribute('aria-selected',String(i === this.activeResult));
  }
  const active=this.resultNodes?.[this.activeResult];
  if (active) {this.search.setAttribute('aria-activedescendant',active.id);active.scrollIntoView?.({block:'nearest'});}
  else this.search.removeAttribute('aria-activedescendant');
 }
 searchKey(event) {
  if (this.composing || event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Escape') {event.preventDefault();event.stopPropagation?.();this.hideResults();return;}
  if (!['ArrowDown','ArrowUp','Enter'].includes(event.key)) return;
  event.preventDefault();event.stopPropagation?.();const pending=Boolean(this.searchTimer), wasHidden=this.resultBox.hidden; this.clearSearchTimer();
  if (pending || wasHidden) this.runSearch();
  if (!this.results.length) return;
  if (event.key === 'Enter') {void this.plugin.openFile(this.results[Math.max(0,this.activeResult)]);this.hideResults();return;}
  if (pending || wasHidden) {this.activeResult=event.key === 'ArrowUp' ? this.results.length-1 : 0;this.highlightResult();return;}
  this.activeResult=this.activeResult<0 ? event.key==='ArrowUp' ? this.results.length-1 : 0 : (this.activeResult+(event.key === 'ArrowDown' ? 1 : -1)+this.results.length)%this.results.length;
  this.highlightResult();
 }
 renderHeader() {
  const date=dayDate(this.today);
  dbText(this.weekday,new Intl.DateTimeFormat('en-US',{weekday:'long'}).format(date));
  this.heading.replaceChildren();
  dbElement('span',this.heading,`${MONTHS[date.getMonth()].slice(0,3)} ${date.getDate()}, `);
  dbElement('span',this.heading,date.getFullYear(),'db-year');
 }
 chooseDay(day) {
  this.selected=day;this.detailsVisible=true;this.renderActivity();
 }
 buildHeatmap() {
  this.range=heatmapDays(this.today); this.months.replaceChildren(); this.cells.replaceChildren(); this.cellNodes=new Map();
  for (const [i,cell] of this.range.entries()) {
   const date=dayDate(cell.day);
   if (cell.inRange && date.getDate()<=7 && i%7===0) {
    const month=dbElement('span',this.months,MONTHS[date.getMonth()].slice(0,3)); month.style.left=`${Math.floor(i/7)/53*100}%`;
   }
   const button=dbButton(this.cells); button.setAttribute('data-day',cell.day); button.tabIndex=cell.day === this.today ? 0 : -1;
   if (!cell.inRange) {button.className='db-padding';button.disabled=true;button.setAttribute('aria-hidden','true');}
   else button.addEventListener('click',()=>this.chooseDay(cell.day));
   this.cellNodes.set(cell.day,button);
  }
 }
 heatKey(event) {
  const day=event.target.getAttribute('data-day');if(!day)return;
  const offset={ArrowLeft:-7,ArrowRight:7,ArrowUp:-1,ArrowDown:1,Home:-dayDate(day).getDay(),End:6-dayDate(day).getDay()}[event.key];
  if (offset === undefined) return;
  const next=shiftDay(day,offset),button=this.cellNodes.get(next);
  event.preventDefault();
  if (!button || button.disabled) return;
  for (const node of this.cellNodes.values()) node.tabIndex=-1;
  button.tabIndex=0;button.focus();this.chooseDay(next);
 }
 renderActivity() {
  let active=0,deep=0,wins=0;
  for (const cell of this.range) {
   if (!cell.inRange) continue;
   const entry=this.plugin.index.get(cell.day), button=this.cellNodes.get(cell.day);
   if(entry){active++;if(entry.level2Met)deep++;if(entry.level3Met)wins++;}
   button.className='db-l'+(entry?.level || 0);
   button.title=dayDescription(cell.day,entry,this.plugin.settings);button.setAttribute('aria-label',button.title);
   button.setAttribute('aria-pressed',String(cell.day===this.selected && this.detailsVisible));
  }
  for (const [i,count] of [active,deep,wins].entries()) dbText(this.counts[i],count);
  for(const [i,rule] of [this.plugin.settings.level2,this.plugin.settings.level3].entries()) {
   const label=ruleLabel(rule);dbText(this.countLabels[i+1],rule.property);
   this.legendNodes[i+2].title=label;this.legendNodes[i+2].setAttribute('aria-label',label);
  }
  this.empty.hidden=active>0;
  this.detail.hidden=!this.detailsVisible;
  if (!this.detailsVisible) return;
  const entry=this.plugin.index.get(this.selected);
  dbText(this.detailTitle,this.selected);
  dbText(this.detailBody,entry ? `${this.plugin.settings.level2.property}: ${entry.level2Value} · ${ruleLabel(this.plugin.settings.level2)} · ${entry.level2Met?'Met':'Not met'}\n${this.plugin.settings.level3.property}: ${entry.level3Value} · ${ruleLabel(this.plugin.settings.level3)} · ${entry.level3Met?'Met':'Not met'}\nLevel ${entry.level}${entry.count>1 ? ' · '+entry.count+' notes; using '+entry.file.path : ''}` : 'No daily note for this date.');
  this.openButton.disabled=!entry;
 }
 render() {
  if(this.disposed)return;
  this.renderAvatar();
  const now=this.plugin.now(),today=localDay(now);
  dbText(this.clock,localTime(now));this.clock.setAttribute('datetime',`${today}T${localTime(now)}`);
  if(today!==this.today){if(this.selected===this.today)this.selected=today;this.today=today;this.renderHeader();this.buildHeatmap();}
  this.renderActivity();
  const error=this.plugin.storageError || this.plugin.index.error;
  this.feedback.hidden=!error;dbText(this.message,error || '');
  if(!this.resultBox.hidden)this.runSearch();
 }
 onunload() {
  if(this.disposed)return;
  this.disposed=true;this.clearSearchTimer();this.plugin.boards.delete(this);this.root?.remove();
 }
}
