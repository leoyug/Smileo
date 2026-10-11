import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePhotoSlug } from './generate.mjs';

test('Chinese description is translated and normalized into a URL slug', async () => {
  const slug = await generatePhotoSlug('公园_电话亭等回音', { fetchImpl: async url => {
    assert.equal(url.searchParams.get('q'), '公园 电话亭等回音');
    assert.equal(url.searchParams.get('langpair'), 'zh-CN|en');
    return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'Park — Phone Booth Waiting for an Echo.' } }) };
  } });
  assert.equal(slug, 'park-phone-booth-waiting-for-an-echo');
});

test('English descriptions need no network request', async () => {
  assert.equal(await generatePhotoSlug("Café: Bird’s Eye View!", { fetchImpl: () => { throw Error('unexpected request'); } }), 'cafe-birds-eye-view');
});

test('empty or oversized descriptions fail before translation', async () => {
  await assert.rejects(generatePhotoSlug('  '), /请先填写/);
  await assert.rejects(generatePhotoSlug('中'.repeat(167)), /过长/);
});

test('provider failures and incomplete translations do not return an invalid slug', async () => {
  await assert.rejects(generatePhotoSlug('测试网络失败', { fetchImpl: async () => { throw Error('offline'); } }), /暂时不可用/);
  await assert.rejects(generatePhotoSlug('测试额度', { fetchImpl: async () => ({ ok: true, json: async () => ({ quotaFinished: true }) }) }), /额度/);
  await assert.rejects(generatePhotoSlug('测试未翻译', { fetchImpl: async () => ({ ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: '仍然是中文' } }) }) }), /完整英文/);
});
