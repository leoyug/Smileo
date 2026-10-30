/**
 * Shared by Markdown and Astro's Code component; highlighting stays at build time.
 * @satisfies {Partial<import('astro').ShikiConfig>}
 */
export const codeHighlighting = {
  themes: { light: 'github-light-default', dark: 'github-dark-default' },
  defaultColor: false,
  wrap: false,
  transformers: [{
    name: 'site-code-block',
    root(root) {
      const pre = root.children.find(node => node.type === 'element' && node.tagName === 'pre');
      if (!pre) return;
      const language = this.options.lang || 'text';
      const label = ['text', 'txt', 'plaintext'].includes(language) ? '纯文本' : language;
      pre.properties.tabindex = 0;
      pre.properties.ariaLabel = `${label} 代码，可横向滚动`;
      root.children = [{
        type: 'element', tagName: 'figure', properties: { className: ['code-block'] },
        children: [{
          type: 'element', tagName: 'figcaption', properties: { className: ['code-block__header'] },
          children: [{
            type: 'element', tagName: 'span', properties: { className: ['code-block__language'] },
            children: [{ type: 'text', value: label }],
          }, {
            type: 'element', tagName: 'button',
            properties: { type: 'button', className: ['code-block__copy'], hidden: true, ariaLabel: `复制 ${label} 代码`, 'data-code-copy': '' },
            children: [{ type: 'text', value: '复制代码' }],
          }, {
            type: 'element', tagName: 'span',
            properties: { className: ['sr-only'], role: 'status', ariaLive: 'polite', ariaAtomic: 'true', 'data-code-status': '' },
            children: [],
          }],
        }, pre],
      }];
    },
  }],
};
