// Development-only translation. Never send photos or saved content to the provider.
const cache = new Map();

export function englishSlug(text) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generatePhotoSlug(description, { fetchImpl = fetch } = {}) {
  if (typeof description !== "string" || !description.trim()) throw new Error("请先填写画面描述。");
  const text = description.trim().replace(/[_\s]+/g, " ");
  if (Buffer.byteLength(text, "utf8") > 500) throw new Error("画面描述过长，请缩短后再生成（最多 500 UTF-8 字节）。");
  if (!/\p{Script=Han}/u.test(text)) {
    const slug = englishSlug(text);
    if (!slug) throw new Error("请填写中文或英文画面描述。");
    return slug;
  }
  if (cache.has(text)) return cache.get(text);
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", "zh-CN|en");
  let data;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("Translation unavailable");
    data = await response.json();
  } catch {
    throw new Error("翻译服务暂时不可用，请重试或手动填写英文短名。");
  }
  if (data.quotaFinished || Number(data.responseStatus) === 429) throw new Error("今日翻译额度已用完，请稍后重试或手动填写英文短名。");
  const translated = data.responseData?.translatedText;
  if (Number(data.responseStatus) !== 200 || typeof translated !== "string" || /\p{Script=Han}/u.test(translated)) {
    throw new Error("未能得到完整英文翻译，请重试或手动填写英文短名。");
  }
  const slug = englishSlug(translated);
  if (!slug) throw new Error("翻译结果无法生成短名，请手动填写英文短名。");
  if (cache.size >= 200) cache.delete(cache.keys().next().value);
  cache.set(text, slug);
  return slug;
}
