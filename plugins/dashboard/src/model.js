const DAY_FORMAT = 'YYYY-MM-DD';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DEFAULT_SETTINGS = {useDailySettings:true,dailyFolder:'',dailyFormat:DAY_FORMAT};
const MAX_AVATAR_BYTES=20*1024*1024;
function localTime(date){return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;}
const DEFAULT_RULES = {
 level2:{property:'deep_work',type:'number',threshold:60},
 level3:{property:'wins',type:'text',threshold:0}
};

function dayDate(day) {
 const parts=day.split('-').map(Number), date=new Date(0);
 date.setHours(12,0,0,0); date.setFullYear(parts[0],parts[1]-1,parts[2]);
 return date;
}
function localDay(date) {
 if (!date || !Number.isFinite(date.getTime())) return null;
 return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function parseDay(value) {
 // YAML libraries can return an actual Date for an unquoted date property.
 if (Object.prototype.toString.call(value) === '[object Date]') {
  return Number.isFinite(value.getTime()) ? parseDay(value.toISOString().slice(0,10)) : null;
 }
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
 const date=dayDate(value);
 return localDay(date) === value ? value : null;
}
function shiftDay(day,delta) {
 const date=dayDate(day); date.setDate(date.getDate()+delta); return localDay(date);
}
function ruleValue(frontmatter,rule) {
 return frontmatter && Object.prototype.hasOwnProperty.call(frontmatter,rule.property) ? frontmatter[rule.property] : undefined;
}
function ruleMatches(frontmatter,rule) {
 const value=ruleValue(frontmatter,rule);
 if (rule.type === 'text') return typeof value === 'string' && value.trim().length>0;
 return rule.type === 'number' && typeof value === 'number' && Number.isFinite(value) && Number.isFinite(rule.threshold) && value>=rule.threshold;
}
function ruleLabel(rule) { return rule.type === 'text' ? `${rule.property} has text` : `${rule.property} ≥ ${rule.threshold}`; }
function ruleDisplay(frontmatter,rule) {
 const value=ruleValue(frontmatter,rule);
 return rule.type === 'text' ? typeof value === 'string' && value.trim() ? value.trim() : 'No text' : typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Not a number';
}
function activity(frontmatter,rules=DEFAULT_RULES) {
 const value=frontmatter?.deep_work;
 const deepWork=typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
 const wins=typeof frontmatter?.wins === 'string' ? frontmatter.wins.trim() : '';
 return {level:ruleMatches(frontmatter,rules.level3) ? 3 : ruleMatches(frontmatter,rules.level2) ? 2 : 1,deepWork,wins};
}
function heatmapDays(today) {
 const first=shiftDay(today,-364), firstSunday=shiftDay(first,-dayDate(first).getDay());
 return Array.from({length:371},(_,i) => {
  const day=shiftDay(firstSunday,i);
  return {day,inRange:day >= first && day <= today,future:day > today};
 });
}
function normalizedText(value) {
 return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
}
function pathOrder(a,b) { return a < b ? -1 : a > b ? 1 : 0; }
function searchFiles(files,query,limit=20) {
 const phrase=normalizedText(query).trim(); if (!phrase) return [];
 const terms=phrase.split(/\s+/);
 return files.map(file => {
  const path=normalizedText(file.path), name=normalizedText(file.name), base=normalizedText(file.basename || file.name.replace(/\.[^.]+$/,''));
  if (!terms.every(term=>path.includes(term))) return null;
  const rank=base === phrase || name === phrase ? 0 : name.startsWith(phrase) ? 1 : name.includes(phrase) ? 2 : 3;
  return {file,rank};
 }).filter(Boolean).sort((a,b)=>a.rank-b.rank || a.file.path.length-b.file.path.length || pathOrder(a.file.path,b.file.path)).slice(0,limit).map(item=>item.file);
}
function cleanFolder(value) {
 if (typeof value !== 'string') return '';
 const parts=value.trim().replace(/\\/g,'/').split('/').filter(Boolean);
 return parts.some(part=>part === '.' || part === '..') ? '' : parts.join('/');
}
function normalizeSettings(value) {
 const raw=value && typeof value === 'object' && !Array.isArray(value) ? value : {};
 return {
  useDailySettings:typeof raw.useDailySettings === 'boolean' ? raw.useDailySettings : true,
  dailyFolder:cleanFolder(raw.dailyFolder),
  dailyFormat:typeof raw.dailyFormat === 'string' && raw.dailyFormat.trim() ? raw.dailyFormat.trim() : DAY_FORMAT,
  avatarPath:normalizeAvatarPath(raw.avatarPath),
  level2:normalizeRule(raw.level2,DEFAULT_RULES.level2),
  level3:normalizeRule(raw.level3,DEFAULT_RULES.level3)
 };
}
function imageExtension(name) { return typeof name === 'string' ? name.match(/\.(png|jpe?g|webp|gif)$/i)?.[1].toLowerCase() || '' : ''; }
function normalizeAvatarPath(value) {
 if(typeof value!=='string'||/^(?:[/\\]|[a-z]+:)/i.test(value)||!imageExtension(value))return '';
 return cleanFolder(value);
}
function imageSignature(bytes) {
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value))return 'png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 const text=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
 if(bytes.length>=6&&['GIF87a','GIF89a'].includes(text(0,6)))return 'gif';
 if(bytes.length>=12&&text(0,4)==='RIFF'&&text(8,12)==='WEBP')return 'webp';
 return '';
}
function normalizeRule(value,fallback) {
 const raw=value && typeof value === 'object' && !Array.isArray(value) ? value : {};
 return {
  property:typeof raw.property === 'string' && raw.property.trim() ? raw.property.trim() : fallback.property,
  type:raw.type === 'text' || raw.type === 'number' ? raw.type : fallback.type,
  threshold:typeof raw.threshold === 'number' && Number.isFinite(raw.threshold) ? raw.threshold : fallback.threshold
 };
}
