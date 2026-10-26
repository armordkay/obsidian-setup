function resolveDailySettings(app,settings) {
 if (!settings.useDailySettings) return {folder:settings.dailyFolder,format:settings.dailyFormat,source:'custom'};
 // Optional adapters mirror the Daily Notes integration already used by Calendar.
 const periodic=app.plugins?.getPlugin?.('periodic-notes')?.settings?.daily;
 if (periodic?.enabled) return {folder:cleanFolder(periodic.folder),format:periodic.format || DAY_FORMAT,source:'periodic'};
 const core=app.internalPlugins?.getPluginById?.('daily-notes');
 if (core?.enabled && core.instance?.options) {
  const options=core.instance.options;
  return {folder:cleanFolder(options.folder),format:options.format || DAY_FORMAT,source:'core'};
 }
 return {folder:'',format:DAY_FORMAT,source:'fallback'};
}
function parseDailyPath(relative,format) {
 const parsed=moment(relative,format,true);
 return parsed.isValid() && parsed.format(format) === relative ? parseDay(parsed.format(DAY_FORMAT)) : null;
}

class DailyIndex {
 constructor(app,settings,parseFormat=parseDailyPath) {
  this.app=app; this.settings=settings; this.parseFormat=parseFormat;
  this.paths=new Map(); this.days=new Map(); this.listeners=new Set(); this.disposed=false;
  this.config=resolveDailySettings(app,settings); this.error='';
 }
 record(file) {
  if (file.extension !== 'md') return null;
  const {folder,format,source}=this.config;
  if (folder && !file.path.startsWith(folder+'/')) return null;
  const relative=file.path.slice(folder ? folder.length+1 : 0,-3);
  const frontmatter=this.app.metadataCache.getFileCache(file)?.frontmatter || {};
  const filenameDay=this.parseFormat(relative,format);
  const propertyDay=parseDay(frontmatter.date);
  if (source === 'fallback' && !filenameDay && !['deep_work','wins',this.settings.level2.property,this.settings.level3.property].some(key=>Object.prototype.hasOwnProperty.call(frontmatter,key))) return null;
  const day=propertyDay || filenameDay;
  if (!day) return null;
  return {file,day,canonical:filenameDay === day,...activity(frontmatter,this.settings),
   level2Met:ruleMatches(frontmatter,this.settings.level2),level3Met:ruleMatches(frontmatter,this.settings.level3),
   level2Value:ruleDisplay(frontmatter,this.settings.level2),level3Value:ruleDisplay(frontmatter,this.settings.level3)};
 }
 rebuild() {
  if (this.disposed) return;
  try {
   this.config=resolveDailySettings(this.app,this.settings);
   const paths=new Map();
   for (const file of this.app.vault.getMarkdownFiles()) {
    const entry=this.record(file); if (entry) paths.set(file.path,entry);
   }
   this.paths=paths; this.error=''; this.regroup();
  } catch { this.error='Could not read daily notes. Refresh the dashboard to try again.'; }
  this.emit();
 }
 update(file) {
  if (this.disposed) return;
  try {
   this.paths.delete(file.path);
   const entry=this.record(file); if (entry) this.paths.set(file.path,entry);
   this.error=''; this.regroup();
  } catch { this.error='Could not update daily notes. Refresh the dashboard to try again.'; }
  this.emit();
 }
 regroup() {
  const days=new Map();
  const entries=[...this.paths.values()].sort((a,b)=>Number(b.canonical)-Number(a.canonical) || pathOrder(a.file.path,b.file.path));
  for (const entry of entries) {
   const current=days.get(entry.day);
   if (current) current.count++;
   else days.set(entry.day,{...entry,count:1});
  }
  this.days=days;
 }
 get(day) { return this.days.get(day) || null; }
 subscribe(listener) { this.listeners.add(listener); return ()=>this.listeners.delete(listener); }
 emit() { if (!this.disposed) for (const listener of this.listeners) listener(); }
 dispose() { this.disposed=true; this.listeners.clear(); this.paths.clear(); this.days.clear(); }
}
