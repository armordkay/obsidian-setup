// Browser fixture only. The production plugin never includes this host or data.
(() => {
 window.dashboardErrors=[];
 window.addEventListener('error',event=>window.dashboardErrors.push(event.message));
 window.addEventListener('unhandledrejection',event=>window.dashboardErrors.push(String(event.reason)));
 class Component {
  constructor(){this.cleanups=[];this.children=[];this.loaded=false;}
  register(fn){this.cleanups.push(fn);}
  registerDomEvent(el,event,fn){el.addEventListener(event,fn);this.register(()=>el.removeEventListener(event,fn));}
  addChild(child){this.children.push(child);if(this.loaded)child.load();return child;}
  removeChild(child){child.unload();this.children=this.children.filter(c=>c!==child);}
  load(){if(this.loaded)return;this.loaded=true;this.onload?.();for(const c of this.children)c.load();}
  unload(){if(!this.loaded)return;this.loaded=false;this.onunload?.();for(const c of [...this.children])c.unload();for(const fn of this.cleanups.splice(0))fn();}
 }
 function emitter(){const events=new Map();return {on(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);return {off:()=>events.get(name).delete(fn)};},trigger(name,...args){for(const fn of events.get(name)||[])fn(...args);}};}
 const files=[],cache=new Map(),opened=[],imageFiles=new Map();
 const adapter={
  async readBinary(path){const item=imageFiles.get(path);if(!item||item.type!=='file')throw Error('Missing image');return item.data;},
  async exists(path){return imageFiles.has(path);},
  async mkdir(path){imageFiles.set(path,{type:'folder'});},
  async writeBinary(path,data){imageFiles.set(path,{type:'file',data});},
  getResourcePath(path){
   const item=imageFiles.get(path);if(!item||item.type!=='file')throw Error('Missing image');
   if(!item.url)item.url=URL.createObjectURL(new Blob([item.data],{type:path.endsWith('.png')?'image/png':path.endsWith('.gif')?'image/gif':path.endsWith('.webp')?'image/webp':'image/jpeg'}));
   return item.url;
  }
 };
 function addFile(path,frontmatter){const name=path.split('/').pop(),extension=name.split('.').pop(),file={path,name,extension,basename:name.slice(0,-extension.length-1)};files.push(file);if(frontmatter)cache.set(path,{frontmatter});return file;}
 const now=new Date(2026,9,26,12);
 for(let i=0;i<365;i++){
  const date=new Date(now);date.setDate(now.getDate()-i);
  const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const seed=(i*17+Math.floor(i/7)*11)%29;
  if(seed>5||i===0)addFile(`Daily/${key}.md`,{date:key,deep_work:i===0?90:(seed*13)%151,wins:i===0?'Completed a focused study session.':seed%4===0?'Finished the most important task.':''});
 }
 addFile('Study/Đọc sách.md');addFile('Study/Note-taking methods.md');addFile('Ideas/Obsidian Dashboard.md');addFile('Images/Diagram.png');
 const vault={...emitter(),adapter,configDir:'.obsidian',getFiles:()=>files,getMarkdownFiles:()=>files.filter(f=>f.extension==='md'),getAbstractFileByPath:path=>files.find(f=>f.path===path)||null};
 const metadataCache={...emitter(),getFileCache:file=>cache.get(file.path)};
 const workspace={...emitter(),leaves:[],getLeavesOfType(type){return this.leaves.filter(l=>l.view?.getViewType()===type);},
  getLeaf(){const leaf={
   async setViewState(){this.view=workspace.factory(this);this.view.loaded=true;document.getElementById('host').appendChild(this.view.contentEl);await this.view.onOpen();},
   async openFile(file){opened.push(file.path);document.getElementById('host-status').textContent='Opened: '+file.path;},
   detach(){this.view?.onClose();this.view?.contentEl.remove();workspace.leaves=workspace.leaves.filter(l=>l!==this);}
  };this.leaves.push(leaf);return leaf;},async revealLeaf(){},onLayoutReady(callback){callback();}
 };
 const app={vault,metadataCache,workspace,plugins:{getPlugin:()=>null},internalPlugins:{getPluginById:()=>({enabled:true,instance:{options:{folder:'Daily',format:'YYYY-MM-DD'}}})}};
 class Plugin extends Component {
  constructor(){super();this.app=app;this.manifest={id:'dashboard',dir:'.obsidian/plugins/dashboard'};}
  async loadData(){return null;}async saveData(value){this.saved=value;}
  registerView(type,factory){workspace.factory=factory;}
  registerMarkdownCodeBlockProcessor(type,callback){this.embed=callback;}
  addRibbonIcon(){}addCommand(){}addSettingTab(){}
  registerEvent(ref){this.register(()=>ref.off());}
  registerInterval(id){this.register(()=>clearInterval(id));}
 }
 class ItemView extends Component{constructor(leaf){super();this.leaf=leaf;this.contentEl=document.createElement('div');}}
 class MarkdownRenderChild extends Component{constructor(el){super();this.containerEl=el;}}
 class Notice{constructor(text){document.getElementById('host-status').textContent=text;}}
 class PluginSettingTab{}
 function moment(value,format){const valid=format==='YYYY-MM-DD'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(new Date(value+'T12:00:00').getTime());return {isValid:()=>valid,format:()=>value};}
 function setIcon(el,name){const paths={search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>','chevron-left':'<path d="m14 6-6 6 6 6"/>','chevron-right':'<path d="m10 6 6 6-6 6"/>'};el.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${paths[name]||''}</svg>`;}
 window.module={exports:{}};
 window.require=name=>{if(name!=='obsidian')throw Error('Unexpected module');return {Plugin,ItemView,MarkdownRenderChild,Notice,PluginSettingTab,Setting:class{},moment,setIcon};};
 window.startDashboardPreview=async()=>{
  const plugin=new window.module.exports();plugin.loaded=true;await plugin.onload();plugin.now=()=>new Date(now);await plugin.openDashboard();
  window.dashboardTest={plugin,app,files,cache,opened,addFile,Component,imageFiles};
  document.getElementById('theme').onclick=()=>{const light=document.body.classList.toggle('theme-light');document.body.classList.toggle('theme-dark',!light);};
 };
})();
