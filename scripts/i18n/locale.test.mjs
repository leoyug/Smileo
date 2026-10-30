import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import matter from 'gray-matter';
import { languageFromPath, languagePath, withoutLanguage } from '../../src/i18n/runtime.ts';

test('language paths preserve the original slug, query and fragment', () => {
  for (const path of ['/', '/about/', '/projects/Zhaichangxiang-App?view=full#overview', '/photos/quiet-city-street-in-the-evening/']) {
    const en = languagePath(path,'en');
    assert.equal(languageFromPath(en),'en');
    assert.equal(languagePath(en,'zh-CN'),path);
    assert.equal(languagePath(en,'en'),en);
  }
  assert.equal(withoutLanguage('/energy'),'/energy');
  assert.equal(languageFromPath('/enough'),'zh-CN');
});

test('every published article and project has complete English metadata and matching images/headings', async () => {
  for (const kind of ['articles','projects']) {
    for (const name of await readdir(`src/content/${kind}`)) {
      if(!name.endsWith('.md'))continue;
      const source = matter(await readFile(`src/content/${kind}/${name}`,'utf8'));
      if(source.data.draft || source.data.hidden)continue;
      const english = matter(await readFile(`src/i18n/content/${kind}/${name}`,'utf8'));
      assert.ok(english.data.title && english.data.description,`${kind}/${name}: metadata`);
      assert.equal(english.content.trim().length===0,source.content.trim().length===0,`${name}: preserve intentionally empty content`);
      assert.equal((english.content.match(/^#{2,6} /gm)||[]).length,(source.content.match(/^#{2,6} /gm)||[]).length,`${name}: heading parity`);
      const images = value => [...value.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]);
      assert.deepEqual(images(english.content),images(source.content),`${name}: image parity`);
      assert.ok(!/[\u3400-\u9fff]/.test(english.content),`${name}: untranslated text`);
    }
  }
});
