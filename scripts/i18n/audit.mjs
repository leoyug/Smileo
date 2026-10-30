import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';

const cjk = /[\u3400-\u9fff]/;
const missing = new Map();
let pages = 0;
const linkTargets = new Set();
const problems = [];
const attrs = node => Object.fromEntries((node?.attrs||[]).map(a=>[a.name,a.value]));
const record = (text, file) => { if (cjk.test(text) && text.trim() !== '中文') missing.set(text.trim(),file); };
function walk(node,file,skip=false) {
  const attributes = Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
  skip ||= ['script','style','pre','code'].includes(node.tagName) || attributes.lang==='zh-CN';
  if (!skip) {
    if(node.nodeName==='#text')record(node.value,file);
    for(const name of ['alt','title','aria-label','placeholder','data-tooltip-description','data-empty-default','data-empty-experiment'])if(attributes[name])record(attributes[name],file);
    if(node.tagName==='meta' && ['description','og:title','og:description','og:site_name','twitter:title','twitter:description'].includes(attributes.name||attributes.property))record(attributes.content,file);
  }
  if(node.tagName==='script'&&attributes.type==='application/json'){
    const value=JSON.parse((node.childNodes||[]).map(n=>n.value||'').join(''));
    const check=v=>{if(typeof v==='string')record(v,file);else if(Array.isArray(v))v.forEach(check);else if(v&&typeof v==='object')Object.values(v).forEach(check)};
    check(value);
  }
  for(const child of node.childNodes||[])walk(child,file,skip);
  if(node.content)walk(node.content,file,skip);
}
async function visit(directory){for(const entry of await readdir(directory,{withFileTypes:true})){
 const file=path.join(directory,entry.name);
 if(entry.isDirectory())await visit(file);
 else if(entry.name.endsWith('.html')){
  const html=await readFile(file,'utf8');
  // Framework redirect documents contain no translated page content.
  if(!html.includes('data-route-main'))continue;
  if(!/<html[^>]+lang="en"/.test(html))throw Error('English page has wrong language: '+file);
  pages++;
  const root=parse(html);walk(root,file);
  const elements=[];const collect=node=>{elements.push(node);for(const child of node.childNodes||[])collect(child);};collect(root);
  const get=(tag,name,value)=>elements.find(node=>node.tagName===tag&&attrs(node)[name]===value);
  const canonical=attrs(get('link','rel','canonical')).href;
  const expected='/'+path.relative('dist',file).replace(/index\.html$/,'').replace(/\.html$/,'');
  if(!canonical || new URL(canonical).pathname.replace(/\/$/,'')!==expected.replace(/\/$/,''))problems.push(file+': incorrect English canonical');
  for(const language of ['zh-CN','en','x-default'])if(!get('link','hreflang',language))problems.push(file+': missing '+language+' alternate');
  if(attrs(get('meta','property','og:locale')).content!=='en_US')problems.push(file+': wrong Open Graph locale');
  const ids=new Set(elements.map(node=>attrs(node).id).filter(Boolean));
  for(const node of elements){
   if(node.tagName!=='a')continue;
   const a=attrs(node),href=a.href||'';
   if(/^\/(?:about|projects|writing|photos|resume|portfolio|thanks|experiments|inspiration|404|rss\.xml)(?:[/?#]|$)/.test(href)&&!('data-language-switch' in a))problems.push(file+': untranslated internal link '+href);
   if(href.startsWith('#')&&!ids.has(decodeURIComponent(href.slice(1))))problems.push(file+': missing fragment '+href);
   if(/^\/en(?:\/|$)/.test(href))linkTargets.add(new URL(href,'https://example.test').pathname);
  }
 }
}}
await visit('dist/en');
for(const target of linkTargets){
 const file=path.join('dist',decodeURIComponent(target));
 const candidates=target.endsWith('.xml')?[file]:[path.join(file,'index.html'),file+'.html'];
 if(!(await Promise.all(candidates.map(file=>access(file).then(()=>true,()=>false)))).some(Boolean))problems.push('Missing English route: '+target);
}
if(problems.length)throw Error(problems.join('\n'));
if(missing.size){for(const [text,file]of missing)console.error(file+' | '+text);throw Error(`${missing.size} untranslated English strings`);}
console.log(`English publication audit passed: ${pages} pages, localized content, accessible labels, metadata, anchors and internal routes verified.`);
