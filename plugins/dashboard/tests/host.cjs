const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

class Element {
 constructor(tag='div',doc){
  this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.listeners={};this.style={};
  this.className='';this.value='';this.disabled=false;this.hidden=false;this._text='';this.scrollWidth=790;
  this.ownerDocument=doc;this.classList={
   add:(...names)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...names])].join(' ');},
   remove:(...names)=>{this.className=this.className.split(' ').filter(n=>!names.includes(n)).join(' ');},
   contains:name=>this.className.split(' ').includes(name)
  };
 }
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 appendChild(el){el.parentElement=this;this.children.push(el);return el;}
 replaceChildren(...els){for(const child of this.children)child.parentElement=null;this._text='';this.children=[];for(const el of els)this.appendChild(el);}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 removeAttribute(name){delete this.attributes[name];}
 contains(el){return this===el||this.children.some(child=>child.contains(el));}
 addEventListener(name,fn){(this.listeners[name]??=new Set()).add(fn);}
 removeEventListener(name,fn){this.listeners[name]?.delete(fn);}
 dispatch(name,props={}){
  const event={target:this,preventDefault(){this.defaultPrevented=true;},...props};
  for(let node=this;node;node=node.parentElement)for(const fn of node.listeners[name]||[])fn(event);
  return event;
 }
 focus(){this.ownerDocument.activeElement=this;}
 click(){this.dispatch('click');}
 scrollIntoView(){this.scrolled=true;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null;}
}
function emitter(){
 const events=new Map();
 return {events,on(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);return {off:()=>events.get(name).delete(fn)};},trigger(name,...args){for(const fn of events.get(name)||[])fn(...args);}};
}
class Component {
 constructor(){this.cleanups=[];this.children=[];this.loaded=false;}
 register(fn){this.cleanups.push(fn);}
 registerDomEvent(el,name,fn){el.addEventListener(name,fn);this.register(()=>el.removeEventListener(name,fn));}
 addChild(child){this.children.push(child);if(this.loaded)child.load();return child;}
 removeChild(child){child.unload();this.children=this.children.filter(c=>c!==child);}
 load(){if(this.loaded)return;this.loaded=true;this.onload?.();for(const child of this.children)child.load();}
 unload(){if(!this.loaded)return;this.loaded=false;this.onunload?.();for(const child of [...this.children])child.unload();for(const fn of this.cleanups.splice(0))fn();}
}
function file(path){const name=path.split('/').at(-1),extension=name.includes('.')?name.split('.').at(-1):'';return {path,name,basename:name.slice(0,-extension.length-1),extension};}
function setup(){
 const doc=new Element('document');doc.ownerDocument=doc;doc.createElement=tag=>new Element(tag,doc);doc.activeElement=null;
 const files=[],cache=new Map(),notices=[],timers=new Map(),intervals=new Map(),disk=new Map();let clock=0;
 const adapter={async readBinary(path){const item=disk.get(path);if(!item||item.type!=='file')throw Error('Missing image');return Uint8Array.from(item.data).buffer;},async exists(path){return disk.has(path);},async mkdir(path){disk.set(path,{type:'folder'});},async writeBinary(path,data){if(this.failWrites)throw Error('read only');disk.set(path,{type:'file',data:new Uint8Array(data)});},getResourcePath:path=>'app://vault/'+encodeURI(path)};
 const vault={...emitter(),adapter,configDir:'.obsidian',getFiles:()=>files,getMarkdownFiles:()=>files.filter(f=>f.extension==='md'),getAbstractFileByPath:path=>files.find(f=>f.path===path)||null};
 const metadataCache={...emitter(),getFileCache:file=>cache.get(file.path)};
 const workspace={...emitter(),leaves:[],opened:[],
  getLeavesOfType(type){return this.leaves.filter(l=>l.view?.getViewType?.()===type);},
  getLeaf(){const leaf={
   async setViewState(state){this.view=workspace.viewFactory(this);this.view.loaded=true;await this.view.onOpen();},
   async openFile(file){if(workspace.openFailure)throw Error('open failed');workspace.opened.push(file.path);},
   detach(){this.view?.onClose();workspace.leaves=workspace.leaves.filter(l=>l!==this);}
  };workspace.leaves.push(leaf);return leaf;},
  async revealLeaf(leaf){this.revealed=leaf;},onLayoutReady(fn){this.layoutReady=fn;}
 };
 const app={vault,metadataCache,workspace,plugins:{getPlugin:()=>null},internalPlugins:{getPluginById:()=>null}};
 class Plugin extends Component {
  constructor(){super();this.app=app;this.manifest={id:'dashboard',dir:'.obsidian/plugins/dashboard'};this.saved=[];this.commands=[];}
  async loadData(){if(this.loadFailure)throw Error('read failed');return this.data;}
  async saveData(value){await this.beforeSave?.(value);if(this.saveFailure)throw Error('disk failed');this.saved.push(value);}
  registerView(type,factory){this.viewType=type;workspace.viewFactory=factory;}
  registerMarkdownCodeBlockProcessor(type,callback){this.blockType=type;this.blockCallback=callback;}
  addCommand(command){this.commands.push(command);}
  addRibbonIcon(icon,label,callback){this.ribbon=callback;}
  addSettingTab(tab){this.settingsTab=tab;}
  registerEvent(ref){this.register(()=>ref.off());}
  registerInterval(id){this.register(()=>intervals.delete(id));}
 }
 class ItemView extends Component {constructor(leaf){super();this.leaf=leaf;this.contentEl=doc.createElement('div');}}
 class MarkdownRenderChild extends Component {constructor(el){super();this.containerEl=el;}}
 class PluginSettingTab {constructor(app,plugin){this.app=app;this.plugin=plugin;this.containerEl=doc.createElement('div');}}
 class Setting {
  setName(){return this;}setDesc(){return this;}
  addToggle(callback){callback(this);return this;}addText(callback){callback(this);return this;}addButton(callback){callback(this);return this;}
  setValue(){return this;}setDisabled(){return this;}setPlaceholder(){return this;}setButtonText(){return this;}onChange(){return this;}onClick(){return this;}
 }
 function moment(input,format){
  let day=null;
  if(format==='YYYY-MM-DD'&&/^\d{4}-\d{2}-\d{2}$/.test(input))day=input;
  if(format==='YYYY/MM/YYYY-MM-DD'&&/^\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}$/.test(input))day=input.slice(-10);
  if(format==='DD-MM-YYYY'&&/^\d{2}-\d{2}-\d{4}$/.test(input))day=input.slice(6)+'-'+input.slice(3,5)+'-'+input.slice(0,2);
  const valid=day&&Number.isFinite(new Date(day+'T12:00:00').getTime())&&new Date(day+'T12:00:00').toISOString().slice(0,10)===day;
  return {isValid:()=>Boolean(valid),format:fmt=>!valid?'Invalid date':fmt.replace(/YYYY/g,day.slice(0,4)).replace(/MM/g,day.slice(5,7)).replace(/DD/g,day.slice(8))};
 }
 const context={module:{exports:{}},Date,Intl,console,
  setTimeout:fn=>{timers.set(++clock,fn);return clock;},clearTimeout:id=>timers.delete(id),
  setInterval:fn=>{intervals.set(++clock,fn);return clock;},clearInterval:id=>intervals.delete(id),
  require:()=>({Plugin,ItemView,MarkdownRenderChild,PluginSettingTab,Setting,Notice:class{constructor(text){notices.push(text);}},moment,setIcon:(el,icon)=>{el.icon=icon;}})
 };
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nthis.api={DashboardPlugin:module.exports,DashboardBoard,DailyIndex,normalizeSettings,resolveDailySettings,parseDailyPath,localDay};',context);
 return {...context.api,app,doc,files,cache,notices,timers,intervals,disk,Component,
  add(path,frontmatter){const f=file(path);files.push(f);if(frontmatter)cache.set(path,{frontmatter});return f;},
  flush(){for(let i=0;timers.size&&i<20;i++){const jobs=[...timers];timers.clear();for(const [,fn]of jobs)fn();}if(timers.size)throw Error('Timers did not settle');},
  board(plugin){const board=new context.api.DashboardBoard(doc.createElement('div'),plugin);board.load();return board;},
  plain:value=>JSON.parse(JSON.stringify(value))
 };
}
module.exports={setup,Element,Component};
