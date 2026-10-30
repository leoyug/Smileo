# Smileo

Smileo 是 Leo 的数字花园，记录生活、设计与学习，分享文字、项目与沿途影像。

访问网站：[Leo 的数字花园](https://smileoleo.com)。

网站基于 Astro 6、TypeScript 和 Content Collections 构建，以静态页面发布。浏览器标签页标题跟随语言偏好：中文显示“Leo 的数字花园”，其他语言显示“Leo's digital garden”；也可在网站的偏好面板中切换标题语言。

## 本地运行

需要 Node.js 和 npm：

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run check         # 内容类型检查和照片发布资产审计
npm run build         # 准备照片、生成字体子集、检查并构建静态网站
npm run preview       # 本地预览构建产物
npm run photos:prepare # 更新照片尺寸并清除上传图片中的敏感元数据
npm run photos:audit  # 单独检查摄影图片尺寸、引用和敏感元数据
npm run media:prepare # 准备照片预览和已发布媒体清单
npm run media:sync -- --dry-run # 查看图片同步计划，不上传
```

开发环境的 `/design-system` 展示正在使用的设计规则和组件；生产环境不公开该页面。`npm run build` 自动重新生成寒蝉宋体子集，完整 OTF 只保存在 `scripts/fonts/source/`，不会作为公开资源发布。

`npm run dev` 会显示所有项目和文章（包括草稿），首页项目区、导航、列表及详情均可调试。`npm run build` 和 `npm run preview` 只展示已发布内容；没有已发布项目时隐藏项目入口。RSS 始终只收录已发布文章。草稿图片调试使用默认的本地媒体地址，开发时保持 `PUBLIC_MEDIA_BASE` 为空。

## 可视化内容后台

运行 `npm run dev` 后，打开终端显示的本地地址，再访问 `/keystatic`（通常是 `http://localhost:4321/keystatic`）。后台按“项目 / 写作 / 摄影”组织，直接在浏览器中编辑标题、正文、封面、照片和发布顺序。「照片组件」分组分别管理首页扇形、首页拖拽及文字悬停的照片，从已有摄影记录中选择并排序。摄影列表和照片组件列表左侧均显示正方形缩略图。修改保存在本机仓库的内容文件与 `public/media/` 图片目录；只有检查、构建并正常发布仓库后，线上网站才会更新。后台仅在开发环境启用，不会被打包到静态网站。

项目的「项目下载（可选）」管理下载地址、文件名与按钮说明；无附件时均留空。项目正文使用编辑器支持的 Markdown；宅畅想官网的成果指标使用三列表格维护，前台呈现数字、百分比与上升箭头，无需在正文中编写 HTML。

已有文件可以在本机的 `/content-import` 批量导入。先选择“项目 / 写作 / 摄影”，再拖入多个文件或选择一个文件夹；支持 Markdown、Word `.docx`、照片及照片 JSON。导入前会预览新建或关联的内容，只有勾选并确认后才写入文件。项目图片按同文件夹或项目短名匹配，文章插图按正文中的相对路径匹配，照片 JSON 按同名短名匹配图片；正文里明确写出的项目或文章链接也会自动建立关联。没有明确依据的内容关系不会猜测。新内容一律存为草稿，照片默认接在现有照片之后。导入后请在 Keystatic 中核对摘要、照片画面描述、项目职责及公开范围。

新内容默认是草稿。完成内容后取消“草稿（不公开）”，设置发布日期并保存。项目勾选“首页及项目页精选”即可进入精选区；“展示顺序”数字越小越靠前。摄影的“展示顺序”从 1 开始，已发布照片不能使用重复数字。标题可改，首次发布后的“稳定短名（网址）”请保持不变。

项目封面、档案叠放图片以及正文插图可直接在各自编辑页上传，文件保存在 `public/media/projects/`；文章插图保存在 `public/media/articles/`；摄影图片保存在 `public/media/photos/`。照片上传后，本地准备脚本会按需要缩至最长边 2400px、压到 2MB 内、转为 WebP 并移除 EXIF/XMP；图片尺寸和方向也会自动写回内容文件。保存后等页面刷新，再运行 `npm run build`，人工核对照片、替代文本与移动端效果。原件仍请自行备份，不要把原件或涉及他人隐私的照片放进公开目录。

后台已将集合、字段和部分界面设为中文。Keystatic 自带的编辑器工具栏和少数按钮仍可能显示英文或不自然的译文。

## 代码结构

```text
src/
├── components/            # 跨页面组件；photos/ 是摄影展示组件
├── content/               # articles、projects、photos、resume
├── content.config.ts      # 内容字段校验
├── data/                  # 导航和非领域视觉数据
├── layouts/               # 页面骨架与元数据
├── lib/                   # 内容查询和摄影数据整理
├── pages/                 # 路由与页面编排
├── scripts/               # 页面交互脚本
└── styles/
    ├── global.css         # 字体、设计变量、基础规则和公共组件
    ├── site.css           # 当前页面的专有样式
    └── site-responsive.css # 对应的响应式规则

public/media/projects/          # 项目封面和档案图片
public/media/articles/          # 文章插图
public/media/photos/            # 摄影网页发布资产
scripts/photos/prepare.mjs      # 新照片压缩和元数据清理
scripts/photos/audit.ts         # 发布图片审计
```

文章、项目和照片的文件名是稳定短名。已公开的地址不要只因标题变化而修改；确需迁移时，应补上跳转。项目详情仍有待核实的展示文案和示例时间，逐项状态与事实来源见[内容发布核对](./docs/内容发布核对.md)。旧的相册、标签和“加载更多”内容模型已移除。

## 更新摄影内容

摄影页直接展示单张照片，点击后打开灯箱，再次点击关闭。照片描述和图片实际尺寸会显示在灯箱中；拍摄日期、地点和相机参数只有核实后才填写。每张照片有独立地址 `/photos/<短名>/`。

1. 自行备份照片原件；不要把原件、精确坐标、设备序列号或第三方隐私放进公开目录。
2. 在 Keystatic 的“摄影”中新建照片、上传图片、填写准确的画面描述与唯一的展示顺序。上传图片保存在 `public/media/photos/`，脚本会准备可公开的图片并填写尺寸和方向。当前限制为最长边不超过 2400px、文件不超过 2MB。
3. 拍摄日期、地点与器材信息只有核实且适合公开时才填写。取消草稿状态后保存。
4. 运行 `npm run build`，再人工检查图片、替代文本、灯箱详情及移动端效果。

具体字段和检查要求见[照片发布指南](./docs/%E7%85%A7%E7%89%87%E6%A8%A1%E5%9D%97%E6%9E%84%E5%BB%BA%E4%B8%8E%E4%B8%8A%E7%BA%BF%E6%8C%87%E5%8D%97.md)。

## 设计和产品依据

- [产品与信息架构](./%E4%B8%AA%E4%BA%BA%E7%BD%91%E7%AB%99%E5%8A%9F%E8%83%BD%E6%96%B9%E6%A1%88.md)
- [设计系统](./PERSONAL_SITES_DESIGN_SYSTEM.md)
- [领域语言](./CONTEXT.md)
- [当前产品约束](./PRODUCT.md)
- [设计说明](./DESIGN.md)

职业履历以 `src/content/resume/main.json` 为唯一结构化来源。当前照片发布资产与预览已通过技术审计；项目和初版样例文章的作者核对情况见[内容发布核对](./docs/内容发布核对.md)。历史版本记录保留在 `docs/releases/`。

网站已于 2026-10-30 恢复公开访问，当前线上版本为 V0.8.0，主地址为 [smileoleo.com](https://smileoleo.com)。主站及图片的暂停规则已关闭；暂停开关和本次部署记录见[站点暂停与恢复](./docs/站点暂停与恢复.md)。提交或重新部署代码不会自动改变暂停规则。

## 图片托管（R2）

本站主地址为 `https://smileoleo.com`，图片域名为 `https://photos.smileoleo.com`，对应 R2 桶 `smileoleo-media`。主站选择 Workers Static Assets；本节的同步命令只处理图片，网站部署另行执行。

Keystatic 和批量导入仍把文件写入 `public/media/`，内容仍保存 `/media/...`。构建会生成 480px、222px 宽的照片预览及 `src/data/media-manifest.json`；预览可以重新生成，不进入 Git。清单只包含已发布内容引用的图片，摄影、文章和项目草稿独占文件均不上传。照片源文件与清单暂时继续保留在 Git。

复制 `.env.example` 为 `.env.local`，填写配置。`SITE_URL` 独立控制 canonical、RSS 与分享链接；`PUBLIC_MEDIA_BASE` 留空时使用本地图片，构建 R2 版本时设为 `https://photos.smileoleo.com`。这些地址在构建时确定，修改后需要重新构建。

推荐将 `PUBLIC_MEDIA_BASE=https://photos.smileoleo.com` 单独写入已忽略的 `.env.production.local`；这样生产构建使用 R2，本地开发继续使用 `.env.local` 中留空的媒体地址。

在 Cloudflare 的 **R2 对象存储 → 概览 → API Tokens → 管理** 中创建 R2 API Token，选择 **Object Read & Write**，范围只选 `smileoleo-media`。将创建结果的 **Access Key ID**、**Secret Access Key** 分别填入 `.env.local` 中的 `R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`，并填写账号 ID 和桶名；无需把 API Token 本身填入。密钥仅用于本机上传，不需要提供给浏览器或普通静态构建环境。环境文件已忽略，不要提交密钥。

日常流程：Keystatic 编辑并确认公开内容 → `npm run publish:prepare` → 检查图片 → 提交内容与清单、推送 → 部署网站。`publish:prepare` 依次构建和同步图片，任一步失败即停止，不自动提交、推送或部署。

```bash
npm run media:sync -- --dry-run # 有凭证时与 R2 对比；无凭证时明确列出本地计划
npm run publish:prepare        # 构建并同步图片，不部署主站
```

同步使用带内容哈希的远端文件名，跳过已经存在的 key；换图会生成新地址，并保留旧对象。仅带哈希的资源设置一年 immutable 缓存。同步按顺序上传，出错即停，可修复后重新执行；不支持远端删除或孤立对象管理。

正文目前支持普通 `![说明](/media/...)`、图片链接及带引号的 HTML `img src`，在构建后的 HTML 中统一改写。引用式图片和 `srcset` 尚未纳入本地引用收集，出现这些写法时会明确报错；复杂 MDX 等有实际内容需求后再扩展。

新环境的 R2 配置顺序是：创建桶 → 生成桶范围凭证 → 在桶的 **Custom Domains** 中连接媒体域名。自定义域名所在 zone 须在同一 Cloudflare 账号下，无需开启 `r2.dev`。之后迁移域名时只调整 `SITE_URL` / `PUBLIC_MEDIA_BASE` 并重新构建。官方参考：[R2 自定义域名](https://developers.cloudflare.com/r2/buckets/public-buckets/)、[R2 凭证](https://developers.cloudflare.com/r2/api/tokens/)。

本阶段不停止跟踪 `public/media/`、不清理 Git 历史，也不从部署包中移除已发布的本地媒体。需要回退时清空 `PUBLIC_MEDIA_BASE` 后重新构建即可。草稿保护仍会从构建结果中移除未发布或未引用的媒体文件。

## 主站托管（Workers Static Assets）

`wrangler.jsonc` 将 `dist/` 作为纯静态资产发布到 `smileo`，通过 Custom Domain 连接 `smileoleo.com`。不需要 Astro 服务端适配器、Worker 代码或运行时密钥；`workers.dev` 和版本预览地址关闭。未知路径使用 `404.html` 并返回 404，目录页保留末尾斜杠，与构建的 canonical 一致。`public/_redirects` 提供旧照片地址的 301 和生产设计系统页的 302。

首次部署前使用 `npx wrangler login` 登录具有该账号 Workers 和域名权限的 Cloudflare 账号。构建仍在本机完成，沿用 Node.js、Python 3（`fonttools`、`brotli`）和现有照片审计依赖，不引入远程构建。

```bash
# 内容、公开范围和生产地址确认后，构建并同步媒体。
SITE_URL=https://smileoleo.com PUBLIC_MEDIA_BASE=https://photos.smileoleo.com npm run publish:prepare
npm run deploy:check # 只验证配置和产物，不上传、不修改域名
npm run deploy:site  # 将当前 dist 上传并绑定主域名，不重新构建或同步媒体
```

`deploy:site` 会公开当前构建；首次上线前须确认发布内容，并完成 PR 审阅及合并。构建后若修改内容或环境变量，重新执行准备步骤，避免发布旧产物。R2 上传凭证仅由本机同步工具使用，不写入 Wrangler 配置或 Workers 变量。

`www.smileoleo.com` 在 Cloudflare zone 中配置 Single Redirect：匹配 `http.host eq "www.smileoleo.com"`，以 301 跳转到 `concat("https://smileoleo.com", http.request.uri.path)`，开启保留查询参数；为 `www` 添加指向 `192.0.2.1` 的代理 A 记录以承接跳转。此规则独立于静态资产，因为 `_redirects` 不支持按来源域名匹配。不要改动 R2 管理的 `photos` 记录。

上线后检查主站 HTTPS、www 路径和查询参数、canonical、RSS、远程图片、旧照片地址以及真实 404。后续回退可重新构建并部署已验证的 Git 提交产物。

官方参考：[静态站点与 404](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)、[静态资产重定向](https://developers.cloudflare.com/workers/static-assets/redirects/)、[Workers 自定义域名](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)、[域名跳转](https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/)。

## 中英文切换

公开页面提供中文和 English 版本，英文地址为原地址前加 `/en/`。在底部偏好面板中选择语言；独立作品集在页头提供切换入口。切换保留当前页面、查询参数和章节锚点，浏览器会记住选择。直接打开语言地址以该地址为准；再次访问首页时恢复已保存的英文偏好。禁用存储时仍能切换，禁用 JavaScript 时英文地址仍包含完整静态内容。

中文内容记录继续作为发布状态、稳定短名、照片与内容关系的唯一来源。英文文章和案例正文位于 `src/i18n/content/articles/`、`src/i18n/content/projects/`，文件名与原记录一致；frontmatter 维护英文标题、摘要和需要翻译的项目字段。`src/i18n/english.json` 维护其余界面、简历和作品集文案，照片英文说明沿用作者维护的英文短名。更新中文文案时同步更新对应译文。

英文页面复用中文页面的组件输出，在静态构建时替换文字、正文、内部链接及元数据；不调用在线翻译服务。正文目录沿用原章节 ID，因此跨语言切换后原章节锚点仍有效。英文 RSS 为 `/en/rss.xml`，页面提供双向 `hreflang` 与独立 canonical。CMS、导入工具和开发设计系统不生成公开英文版本。

`npm run test:i18n` 检查语言路径、正文覆盖、章节和图片对应关系；构建中的 `npm run i18n:audit` 会扫描所有静态英文页面，阻止未翻译正文、元数据、照片数据或可访问名称进入发布结果。未翻译的开发草稿只在中文索引中展示；直接打开对应英文草稿地址时会明确标注。公开英文页面不回退到中文正文。
