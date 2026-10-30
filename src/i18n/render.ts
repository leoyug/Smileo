import { parse, parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';
import matter from 'gray-matter';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import english from './english.json';
import { codeHighlighting } from '../lib/code-highlighting.mjs';
import { languagePath, withoutLanguage } from './runtime';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const catalog: Record<string, string> = english;
const files = import.meta.glob<string>('./content/**/*.md', { query: '?raw', import: 'default', eager: true });
const originals = import.meta.glob<string>('../content/{articles,projects}/*.md', { query: '?raw', import: 'default', eager: true });
const processor = createMarkdownProcessor({ shikiConfig: codeHighlighting });
export const translations = Object.fromEntries(Object.entries(files).map(([path, raw]) => {
  const entry = matter(raw);
  return [path.replace('./content/', '').replace(/\.md$/, ''), entry];
}));
for (const [key, entry] of Object.entries(translations)) {
  const original = originals[`../content/${key}.md`];
  if (!original) continue;
  const source = matter(original);
  for (const field of ['title', 'description', 'subtitle', 'projectType', 'role', 'tools', 'period']) {
    if (typeof source.data[field] === 'string' && typeof entry.data[field] === 'string') catalog[source.data[field]] = entry.data[field];
  }
  const translatedImages = new Map([...entry.content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map(m => [m[2], m[1]]));
  for (const match of source.content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    const alt = translatedImages.get(match[2]);
    if (alt) catalog[match[1]] = alt;
  }
}

export function translateText(value: string, additions: Record<string, string> = {}): string {
  const core = value.trim();
  const translated = additions[core] ?? catalog[core];
  if (translated !== undefined) return value.replace(core, translated);
  if (core.includes('｜')) return core.split('｜').map(s => translateText(s, additions)).join(' | ');
  if (core.startsWith('查看项目，')) return core.split('，').map(s=>translateText(s, additions)).join(', ');
  for (const [zh, en] of [['查看照片：', 'View photo: '], ['选择照片：', 'Select photo: '], ['复制邮箱地址：', 'Copy email: '], ['已复制邮箱地址：', 'Email copied: ']]) {
    if (core.startsWith(zh)) return en + translateText(core.slice(zh.length), additions);
  }
  if (core.endsWith('项目封面')) return `${translateText(core.slice(0, -4), additions)} project cover`;
  if (core.endsWith('的职业经历、项目经验与技能。')) return `${translateText(core.split('的职业')[0])}'s experience, projects, and skills.`;
  if (/^复制 .+ 代码$/.test(core)) return `Copy ${core.slice(3, -3)} code`;
  if (core.endsWith(' 代码，可横向滚动')) return `${translateText(core.slice(0, -' 代码，可横向滚动'.length))} code; scroll horizontally`;
  if (/^\d{4}[-—]至今$/.test(core)) return core.replace(/[-—]至今$/, '–present');
  if (/^[。；，、：！？]+$/.test(core)) return core.replaceAll('。', '.').replaceAll('；', ';').replaceAll('，', ',').replaceAll('、', ',').replaceAll('：', ':').replaceAll('！','!').replaceAll('？','?');
  return value;
}
const isElement = (node: Node): node is Element => 'tagName' in node;
const attr = (node: Node, name: string) => isElement(node) ? node.attrs.find(a => a.name === name)?.value : undefined;
const setAttr = (node: Node, name: string, value: string) => {
  if (!isElement(node)) return;
  const item = node.attrs.find(a => a.name === name);
  if (item) item.value = value; else node.attrs.push({name, value});
};
const hasClass = (node: Node, name: string) => (attr(node, 'class') ?? '').split(/\s+/).includes(name);
function walk(node: Node, visit: (node: Node) => void) {
  visit(node);
  if ('childNodes' in node) for (const child of [...node.childNodes]) walk(child, visit);
  if ('content' in node) walk(node.content, visit);
}
function text(node: Node): string {
  if (node.nodeName === '#text') return (node as DefaultTreeAdapterMap['textNode']).value;
  return 'childNodes' in node ? node.childNodes.map(text).join('') : '';
}
function setText(node: Node, value: string) {
  if ('childNodes' in node) node.childNodes = [{nodeName: '#text', value, parentNode: node}];
}
function replaceChildren(node: Node, html: string) {
  if (!('childNodes' in node)) return;
  node.childNodes = parseFragment(html).childNodes;
  for (const child of node.childNodes) child.parentNode = node;
}
const pageHref = (href: string) => /^\/(?!\/)(?:$|[?#]|(?:about|projects|writing|photos|resume|portfolio|thanks|experiments|inspiration|404)(?:\/|[?#]|$)|rss\.xml(?:[?#]|$))/.test(href);
function translateData(value: unknown): unknown {
  if (typeof value === 'string') return translateText(value);
  if (Array.isArray(value)) return value.map(translateData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateData(item)]));
  return value;
}
const rendered = new Map<string, Promise<string>>();
function englishBody(key: string) {
  if (!rendered.has(key)) rendered.set(key, processor.then(p=>p.render(translations[key].content)).then(result=>result.code));
  return rendered.get(key)!;
}

export async function localizePage(html: string, pathname: string, site: URL | undefined): Promise<string> {
  const root = parse(html);
  const base = withoutLanguage(pathname);
  const path = base.replace(/^\//, '').replace(/\/$/, '');
  const key = path.replace(/^writing\//, 'articles/');
  const entry = translations[key];
  const headings: Record<string, string> = {};
  const elements: Node[] = [];
  walk(root, node=>elements.push(node));
  const body = elements.find(node=>hasClass(node,'article__body'));
  if (body && isElement(body) && /^(writing|projects)\//.test(path)) {
    if (!entry && !import.meta.env.DEV) throw new Error(`Missing English translation: ${key}`);
    if (entry) {
      const originalHeadings: Node[] = [];
      walk(body, node=>{if (isElement(node) && /^h[1-6]$/.test(node.tagName)) originalHeadings.push(node);});
      replaceChildren(body, await englishBody(key));
      let index = 0;
      walk(body, node=>{
        if (!isElement(node) || !/^h[1-6]$/.test(node.tagName)) return;
        const original = originalHeadings[index++];
        if (original) { headings[text(original)] = text(node); const id = attr(original,'id'); if (id) setAttr(node,'id',id); }
      });
    } else {
      setAttr(body,'lang','zh-CN');
      replaceChildren(body, '<p lang="en">This unpublished draft has not been translated yet.</p>' + serialize(body));
    }
  }
  if (import.meta.env.DEV) {
    for (const node of elements) {
      const href=attr(node,'href');
      if (isElement(node) && hasClass(node,'content-row') && href?.startsWith('/writing/') && !translations[href.replace('/writing/','articles/')] && node.parentNode && 'childNodes' in node.parentNode)
        node.parentNode.childNodes=node.parentNode.childNodes.filter(child=>child!==node);
    }
    for (const node of elements) if (isElement(node) && hasClass(node,'writing-year') && 'childNodes' in node) {
      let hasEntry=false; walk(node,child=>{if(hasClass(child,'content-row'))hasEntry=true;});
      if (!hasEntry && node.parentNode && 'childNodes' in node.parentNode) node.parentNode.childNodes=node.parentNode.childNodes.filter(child=>child!==node);
    }
  }
  // Replace character-by-character photo labels as a whole, retaining the animation hooks.
  walk(root, node=>{
    if (!hasClass(node,'photo-fan-stack__label')) return;
    const caption = translateText(text(node));
    const sample = 'childNodes' in node ? node.childNodes.find(isElement) : undefined;
    const scope = sample?.attrs.filter(a=>a.name!=='style').map(a=>`${a.name}="${a.value}"`).join(' ') ?? '';
    replaceChildren(node,[...caption].map((char,index)=>`<span ${scope} style="--label-delay:calc(${index / Math.max(1,caption.length-1)} * var(--duration-very-slow))">${char === ' ' ? '&#160;' : char.replaceAll('&','&amp;').replaceAll('<','&lt;')}</span>`).join(''));
  });
  const translatedAttributes = new Set(['alt','title','aria-label','placeholder','data-tooltip-description','data-empty-default','data-empty-experiment','data-title-en']);
  function localize(node: Node, skip = false) {
    if (isElement(node)) {
      if (node.tagName === 'script') {
        if (attr(node,'type') === 'application/json') {
          try { setText(node, JSON.stringify(translateData(JSON.parse(text(node)))).replaceAll('<','\\u003c')); } catch { /* Preserve unrelated structured data. */ }
        }
        return;
      }
      if (node.tagName === 'style') return;
      skip ||= attr(node,'lang') === 'zh-CN';
      for (const item of node.attrs) {
        if (translatedAttributes.has(item.name) && !skip) item.value = translateText(item.value, headings);
        if (item.name === 'href' && pageHref(item.value)) item.value = languagePath(item.value,'en');
        if (item.name === 'data-preference-group' && item.value === 'language') {
          const selected = attr(node,'data-preference-value') === 'en';
          setAttr(node,'aria-checked',String(selected));
          setAttr(node,'class',selected ? 'is-selected' : '');
        }
      }
      if (attr(node,'data-language-switch') !== undefined) { setAttr(node,'href',base); setText(node,'中文'); }
      if (node.tagName === 'code' || node.tagName === 'pre') return;
      if (attr(node,'data-preference-group') === 'language') setAttr(node,'data-language-href',languagePath(base,attr(node,'data-preference-value') === 'en'?'en':'zh-CN'));
      if (node.tagName === 'meta') {
        const name = attr(node,'name') ?? attr(node,'property');
        const value = attr(node,'content') ?? '';
        if (name === 'og:locale') setAttr(node,'content','en_US');
        else if (name === 'og:url') setAttr(node,'content',new URL(languagePath(base,'en'),site).href);
        else if (['description','og:title','og:description','og:site_name','twitter:title','twitter:description'].includes(name ?? '')) setAttr(node,'content',translateText(value));
      }
      if (node.tagName === 'link') {
        if (attr(node,'rel') === 'canonical') setAttr(node,'href',new URL(languagePath(base,'en'),site).href);
      }
    }
    if (!skip && node.nodeName === '#text') {
      const leaf = node as DefaultTreeAdapterMap['textNode'];
      leaf.value = translateText(leaf.value,headings);
    }
    if ('childNodes' in node) for (const child of node.childNodes) localize(child,skip);
    if ('content' in node) localize(node.content,skip);
  }
  // Change root language before visiting children, so Chinese source text is translated.
  const htmlNode = elements.find(node=>isElement(node)&&node.tagName==='html')!;
  setAttr(htmlNode,'lang','en');
  localize(root);
  // Add only the word boundaries English requires across preserved inline components.
  function wordBoundaries(node: Node) {
    if (isElement(node) && (['script','style','code','pre'].includes(node.tagName) || hasClass(node,'photo-fan-stack__label'))) return;
    if ('childNodes' in node) {
      let previous: DefaultTreeAdapterMap['textNode'] | undefined;
      let whitespace: DefaultTreeAdapterMap['textNode'][] = [];
      for (const child of [...node.childNodes]) {
        wordBoundaries(child);
        const leaves: DefaultTreeAdapterMap['textNode'][]=[];
        const gather = (n: Node) => { if (isElement(n) && ['script','style','code','pre','template'].includes(n.tagName)) return; if(n.nodeName==='#text')leaves.push(n as DefaultTreeAdapterMap['textNode']); else if('childNodes' in n) n.childNodes.forEach(gather); }; gather(child);
        const first=leaves.find(n=>n.value.trim());
        if (previous && first) {
          if (/^[.,;:!?]|^'s\b/.test(first.value.trim())) { previous.value=previous.value.trimEnd(); first.value=first.value.trimStart(); whitespace.forEach(n=>n.value=''); }
          else if (/[\p{L}\p{N},;:!?]$/u.test(previous.value.trimEnd()) && /^[\p{L}\p{N}]/u.test(first.value.trimStart())) {
            previous.value=previous.value.trimEnd(); first.value=first.value.trimStart(); whitespace.forEach(n=>n.value='');
            // The boundary belongs outside inline-block components, where it stays visible.
            node.childNodes.splice(node.childNodes.indexOf(child),0,{nodeName:'#text',value:' ',parentNode:node});
          }
        }
        const last=[...leaves].reverse().find(n=>n.value.trim());
        if(last) { previous=last; whitespace=[]; } else whitespace.push(...leaves);
      }
    }
  }
  wordBoundaries(root);
  return serialize(root);
}
