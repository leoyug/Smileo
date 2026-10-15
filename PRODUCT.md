# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

主要读者是希望了解 Leo 的工作、判断与长期记录的人，包括潜在合作方、同行与熟人。Leo 是唯一内容维护者，使用本地文件和 Git 完成编辑与发布。

## Product Purpose

Smileo是一份以长期记录为首要目标、兼顾职业展示的中文个人出版物。成功意味着文章、项目、摄影与职业信息都有稳定地址，内容可以多年持续积累，同时保持克制、可信和可维护。

## Positioning

网站把设计工程实践与个人生活记录放在同一套稳定内容模型中：职业展示不是一次性作品集，摄影也不是脱离上下文的图库，而是长期出版档案的一部分。

## Operating Context

内容通过 Astro Content Collections、Markdown/MDX、结构化数据和本地发布资产维护；正式构建为纯静态输出。照片原件仅在本地处理与独立备份中存在，发布前生成限制尺寸并清除敏感元数据的公开资产。

## Capabilities and Constraints

- 首版包含首页、项目、文章、摄影、关于、详情页、RSS 与 404。
- 技术基线为 Astro 6、TypeScript、Content Collections 与静态生成。
- 不引入数据库、托管 CMS、账户系统或无明确需求的客户端状态。Keystatic 仅在本地开发时用于编辑内容，不进入公开静态产物。
- 照片和文章均使用首次发布时确定的稳定地址。
- 摄影页直接排列照片；点击打开灯箱，展示该照片经过核实的详情，再次点击关闭。每张照片都有可直接访问的地址。
- 照片不得公开原件、精确坐标、设备序列号或第三方隐私。

## Brand Commitments

名称为Smileo，公开身份使用 Leo。语言克制、直接、诚实，不虚构成果或把示例内容描述为真实记录。既有视觉身份由 `PERSONAL_SITES_DESIGN_SYSTEM.md` 与 `src/styles/global.css` 约束。

## Evidence on Hand

- 产品与信息架构：`个人网站功能方案.md`
- 稳定领域语言：`CONTEXT.md`
- 设计依据：`PERSONAL_SITES_DESIGN_SYSTEM.md`
- 照片实施与验收：`docs/照片模块构建与上线指南.md`
- Afilmory 决策：`docs/adr/0001-selective-afilmory-adoption.md`
- 当前有 99 张已发布照片，发布资产与两档预览均通过尺寸和隐私元数据审计。所有项目和两篇初版样例文章暂作草稿，待作者确认后发布，逐项状态见 `docs/内容发布核对.md`。

## Product Principles

- 长期可维护优先于短期视觉炫技。
- 内容事实与公开图片资产分离；缺失的拍摄参数不填造假的通用值。
- 稳定地址、可访问性和无 JavaScript 基础浏览属于内容完整性。
- 隐私依靠不上传和构建审计，而不是依靠 `noindex`。
- 照片主导摄影页面，界面退后但保留逐张核实的详情。

## Accessibility & Inclusion

保持语义化标题、44px 最小交互区域、可见焦点、键盘完整可达和准确替代文本。照片灯箱支持焦点锁定、`Esc`、焦点恢复与减少动态效果；详情不得覆盖照片。
