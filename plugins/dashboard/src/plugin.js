const DASHBOARD_VIEW='dashboard-view';

class DashboardView extends ItemView {
 constructor(leaf,plugin) {super(leaf);this.plugin=plugin;}
 getViewType(){return DASHBOARD_VIEW;}
 getDisplayText(){return 'Dashboard';}
 getIcon(){return 'layout-dashboard';}
 async onOpen(){
  if(this.plugin.stopped)return;
  this.contentEl.classList.add('db-view');this.contentEl.replaceChildren();
  this.board=new DashboardBoard(this.contentEl,this.plugin);this.addChild(this.board);
 }
 async onClose(){
  if(this.board){this.removeChild(this.board);this.board=null;}
  this.contentEl.classList.remove('db-view');
 }
}
class DashboardSettings extends PluginSettingTab {
 constructor(app,plugin){super(app,plugin);this.dashboard=plugin;}
 display(){
  const plugin=this.dashboard,container=this.containerEl;container.replaceChildren();
  dbElement('h2',container,'Daily notes');
  new Setting(container).setName('Use Daily Notes settings').setDesc('Prefer enabled Periodic Notes, then core Daily Notes. Otherwise detect date-named or property-based daily notes in the vault.')
   .addToggle(toggle=>toggle.setValue(plugin.settings.useDailySettings).onChange(async value=>{await plugin.applySettings({...plugin.settings,useDailySettings:value});if(!plugin.stopped)this.display();}));
  new Setting(container).setName('Daily note folder').setDesc('Used when automatic settings are off. Includes subfolders; leave empty for the vault root.')
   .addText(text=>text.setPlaceholder('Daily').setValue(plugin.settings.dailyFolder).setDisabled(plugin.settings.useDailySettings).onChange(value=>plugin.applySettings({...plugin.settings,dailyFolder:value})));
  new Setting(container).setName('Daily note format').setDesc('Moment date format used when a valid date property is absent. Include nested date folders, for example YYYY/MM/YYYY-MM-DD.')
   .addText(text=>text.setPlaceholder(DAY_FORMAT).setValue(plugin.settings.dailyFormat).setDisabled(plugin.settings.useDailySettings).onChange(value=>plugin.applySettings({...plugin.settings,dailyFormat:value})));
  const effective=resolveDailySettings(this.app,plugin.settings);
  new Setting(container).setName('Current source').setDesc(`${effective.source} · ${effective.folder || 'Vault root'} · ${effective.format}`);
  new Setting(container).setName('Refresh dashboard').setDesc('Rescan daily metadata after changing Daily Notes or Periodic Notes settings. Daily notes are never edited.')
   .addButton(button=>button.setButtonText('Refresh').onClick(()=>{plugin.refresh();this.display();}));
 }
}

module.exports=class DashboardPlugin extends Plugin {
 async onload(){
  this.boards=new Set();this.listeners=new Set();this.saveQueue=Promise.resolve();this.avatarQueue=Promise.resolve();this.stopped=false;
  this.storageError='';this.now=()=>new Date();this.lastToday=localDay(this.now());this.lastMinute=localTime(this.now());
  let data=null;
  try {
   data=await this.loadData();
   if(data && data.version!==1){this.storageError='Dashboard settings have an unsupported version. Defaults are in use.';data=null;}
  } catch {this.storageError='Could not load Dashboard settings. Defaults are in use.';}
  if(this.stopped)return;
  this.settings=normalizeSettings(data?.settings);
  await this.migrateAvatar();if(this.stopped)return;
  this.index=new DailyIndex(this.app,this.settings);
  this.register(this.index.subscribe(()=>this.queueNotify()));
  this.registerView(DASHBOARD_VIEW,leaf=>new DashboardView(leaf,this));
  this.registerMarkdownCodeBlockProcessor('dashboard',(_source,el,ctx)=>{
   el.classList.add('db-embed');const board=new DashboardBoard(el,this);
   board.register(()=>el.classList.remove('db-embed'));ctx.addChild(board);
  });
  this.addRibbonIcon('layout-dashboard','Open dashboard',()=>void this.openDashboard());
  this.addCommand({id:'open-dashboard',name:'Open dashboard',callback:()=>this.openDashboard()});
  this.addCommand({id:'refresh-dashboard',name:'Refresh dashboard',callback:()=>this.refresh()});
  this.addSettingTab(new DashboardSettings(this.app,this));
  this.registerEvent(this.app.metadataCache.on('changed',file=>{if(!this.stopped)this.index.update(file);}));
  this.registerEvent(this.app.metadataCache.on('resolved',()=>this.refresh()));
  for(const event of ['create','delete','rename'])this.registerEvent(this.app.vault.on(event,()=>this.queueRefresh()));
  this.registerEvent(this.app.workspace.on('active-leaf-change',()=>this.checkToday()));
  this.registerInterval(setInterval(()=>this.checkToday(),30000));
  this.register(()=>{clearTimeout(this.notifyTimer);clearTimeout(this.refreshTimer);});
  this.index.rebuild();
  this.app.workspace.onLayoutReady(()=>{if(!this.stopped)this.refresh();});
  if(this.storageError)new Notice(this.storageError);
 }
 subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 avatarFolder(){
  const dir=cleanFolder(this.manifest?.dir || `${this.app.vault.configDir || '.obsidian'}/plugins/${this.manifest?.id || 'dashboard'}`);
  return dir+'/images';
 }
 legacyAvatarFolder(){
  const dir=this.avatarFolder().slice(0,-'/images'.length),slash=dir.lastIndexOf('/');
  return (slash>=0 ? dir.slice(0,slash+1) : '')+'images';
 }
 async migrateAvatar(){
  const previous=this.settings.avatarPath;
  if(!previous.startsWith(this.legacyAvatarFolder()+'/'))return;
  try {
   const buffer=await this.app.vault.adapter.readBinary(previous);
   const target=await this.importAvatar({name:previous.split('/').pop(),size:buffer.byteLength,arrayBuffer:async()=>buffer});
   if(this.stopped)return;
   this.settings.avatarPath=target;await this.persist();
  } catch {
   if(!this.stopped)new Notice('Could not move the saved avatar into dashboard/images. The previous image is retained; choose it again in Set up to retry.');
  }
 }
 avatarSource(){
  const path=normalizeAvatarPath(this.settings.avatarPath);
  if(!path || ![this.avatarFolder(),this.legacyAvatarFolder()].some(folder=>path.startsWith(folder+'/')))return AVATAR_SRC;
  try {return this.app.vault.adapter.getResourcePath(path);}catch{return AVATAR_SRC;}
 }
 importAvatar(file){
  const task=this.avatarQueue.then(()=>this.copyAvatar(file));
  this.avatarQueue=task.catch(()=>{});return task;
 }
 async copyAvatar(file){
  if(this.stopped)throw new Error('Dashboard is closed. Reopen it to choose an avatar.');
  const extension=imageExtension(file?.name);
  if(!extension||typeof file.arrayBuffer!=='function')throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
  if(file.size>MAX_AVATAR_BYTES)throw new Error('Choose an image no larger than 20 MB.');
  let buffer;
  try {buffer=await file.arrayBuffer();}catch{throw new Error('Could not read the selected image. Choose it again.');}
  const bytes=new Uint8Array(buffer);
  if(bytes.byteLength>MAX_AVATAR_BYTES)throw new Error('Choose an image no larger than 20 MB.');
  if(imageSignature(bytes)!==(extension==='jpeg'?'jpg':extension))throw new Error('This file does not contain the selected image format.');
  if(this.stopped)throw new Error('Dashboard is closed. Reopen it to choose an avatar.');
  const adapter=this.app.vault.adapter,folder=this.avatarFolder();
  const basename=file.name.split(/[/\\]/).pop().replace(/\.[^.]+$/,'').replace(/[<>:"|?*\u0000-\u001f]/g,'-').replace(/^\.+/,'').trim().slice(0,80) || 'avatar';
  try {
   if(!await adapter.exists(folder))await adapter.mkdir(folder);
   let target;
   for(let attempt=0;attempt<100;attempt++){
    const suffix=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)+'-'+attempt;
    const candidate=`${folder}/${basename}-${suffix}.${extension}`;
    if(!await adapter.exists(candidate)){target=candidate;break;}
   }
   if(!target)throw new Error('No unused filename');
   if(this.stopped)throw new Error('Dashboard closed');
   await adapter.writeBinary(target,buffer);
   if(this.stopped)throw new Error('Dashboard closed');
   return target;
  } catch {throw new Error('Could not copy the image to images. Check that the vault is writable and try again.');}
 }
 queueNotify(){
  if(this.stopped||this.notifyTimer)return;
  this.notifyTimer=setTimeout(()=>{this.notifyTimer=null;if(!this.stopped)for(const listener of this.listeners)listener();},60);
 }
 queueRefresh(){
  if(this.stopped)return;clearTimeout(this.refreshTimer);
  this.refreshTimer=setTimeout(()=>{this.refreshTimer=null;this.refresh();},80);
 }
 refresh(){if(!this.stopped)this.index.rebuild();}
 checkToday(){
  if(this.stopped)return;
  const now=this.now(),today=localDay(now),minute=localTime(now);
  if(today!==this.lastToday||minute!==this.lastMinute){this.lastToday=today;this.lastMinute=minute;this.queueNotify();}
 }
 async applySettings(next){
  if(this.stopped)return false;
  this.settings=normalizeSettings(next);this.index.settings=this.settings;this.refresh();return this.persist();
 }
 persist(){
  const snapshot={version:1,settings:{...this.settings}};
  this.saveQueue=this.saveQueue.then(async()=>{
   try {await this.saveData(snapshot);this.storageError='';return true;}
   catch {this.storageError='Could not save Dashboard settings. Changes work until restart; use Retry to save again.';if(!this.stopped)new Notice(this.storageError);return false;}
   finally {this.queueNotify();}
  });return this.saveQueue;
 }
 async retry(){await this.persist();this.refresh();}
 async openFile(file){
  if(this.stopped)return false;
  const current=this.app.vault.getAbstractFileByPath(file.path);
  if(!current || typeof current.extension!=='string'){new Notice('This file no longer exists. Search again or refresh the dashboard.');this.queueRefresh();return false;}
  try {await this.app.workspace.getLeaf('tab').openFile(current);return true;}
  catch {if(!this.stopped)new Notice('Could not open this file. Please try again.');return false;}
 }
 async openDashboard(){
  if(this.stopped)return;
  if(this.opening)return this.opening;
  this.opening=(async()=>{
   try {
    let leaf=this.app.workspace.getLeavesOfType(DASHBOARD_VIEW)[0];
    if(!leaf){leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:DASHBOARD_VIEW,active:true});}
    if(this.stopped){leaf.detach();return;}
    await this.app.workspace.revealLeaf(leaf);
   } catch {if(!this.stopped)new Notice('Could not open Dashboard. Please try again.');}
  })();
  try {await this.opening;} finally {this.opening=null;}
 }
 onunload(){
  this.stopped=true;clearTimeout(this.notifyTimer);clearTimeout(this.refreshTimer);
  for(const board of [...(this.boards || [])])board.unload();
  this.index?.dispose();this.listeners?.clear();
  for(const leaf of this.app.workspace.getLeavesOfType(DASHBOARD_VIEW))leaf.detach();
 }
};
