import { collection, config, fields, singleton } from "@keystatic/core";
import { createElement } from "react";
import { imageUpload } from "./src/admin/image-upload-field";
import { photoLayoutSelect } from "./src/admin/photo-layout-field";
import { photoMetadataDate, photoMetadataISO, photoMetadataText } from "./src/admin/photo-metadata-field";
import { photoDescription } from "./src/admin/photo-description-field";
import { defaultNextOrder } from "./src/admin/default-order-field";
import { projectStatuses } from "./src/lib/project-status";
import { componentPhotoLabel, componentPhotoRelationship } from "./src/admin/component-photo-field";

const requiredText = (label: string, description?: string) =>
  fields.text({ label, description, validation: { isRequired: true } });

const HiddenContentField = () => createElement("span", { hidden: true, "data-keystatic-hidden-field": true });

// Dimensions belong to the prepared asset. Keep serialization and validation,
// but let the photo preparation pipeline maintain them instead of the editor.
const photoDimension = (label: string, defaultValue: number) => {
  const field = fields.integer({ label, defaultValue, validation: { isRequired: true, min: 1 } });
  return { ...field, Input: HiddenContentField };
};

const title = fields.slug({
  name: { label: "标题", validation: { isRequired: true } },
  slug: {
    label: "稳定短名（网址）",
    description: "用于页面网址；建议英文小写加连字符，发布后保持不变。",
  },
});

const publication = {
  description: requiredText("摘要", "用于搜索结果和链接预览，建议用一句话概括。"),
  publishedAt: fields.date({ label: "发布日期", defaultValue: { kind: "today" }, validation: { isRequired: true } }),
  updatedAt: fields.date({ label: "更新日期", description: "记录最后修改时间，不在网页显示。" }),
  draft: fields.checkbox({ label: "草稿（不公开）", defaultValue: true }),
};

const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const automaticDate = (label: string, refresh: boolean) => {
  const field = fields.date({ label, defaultValue: { kind: "today" } });
  return {
    ...field,
    Input: HiddenContentField,
    serialize: (value: string | null) => field.serialize(refresh ? today() : value ?? today()),
  };
};

const componentPhotos = (max: number, description: string) => fields.array(
  componentPhotoRelationship(),
  {
    label: "展示照片",
    description: `${description} 从已有摄影记录中选择，拖动列表调整展示顺序。草稿或已删除的照片不会展示；清空列表可隐藏组件。`,
    itemLabel: ({ value }) => componentPhotoLabel(value),
    validation: { length: { max } },
  },
);

export default config({
  storage: { kind: "local" },
  locale: "zh-CN",
  ui: {
    brand: {
      name: "内容管理",
      mark: () => createElement("img", {
        src: "/favicon.svg?v=f9fb16d0d39c", alt: "", width: 32, height: 32,
      }),
    },
    navigation: { "内容": ["projects", "articles", "photos"], "照片组件": ["homeFan", "homeDrag", "textHover"] },
  },
  singletons: {
    homeFan: singleton({
      label: "首页扇形照片",
      path: "src/data/photo-components/home-fan",
      format: "json",
      previewUrl: "/",
      schema: { photos: componentPhotos(7, "用于亮色首页的扇形堆叠，最多选择 7 张。悬停文字使用照片的画面描述。") },
    }),
    homeDrag: singleton({
      label: "首页拖拽照片",
      path: "src/data/photo-components/home-drag",
      format: "json",
      previewUrl: "/",
      schema: { photos: componentPhotos(7, "用于暗色首页的可拖拽照片，最多选择 7 张，支持横图和竖图。") },
    }),
    textHover: singleton({
      label: "文字悬停照片",
      path: "src/data/photo-components/text-hover",
      format: "json",
      previewUrl: "/about",
      schema: { photos: componentPhotos(6, "用于关于页「走走拍拍」的悬停照片与展开图库。请选择 6 张已发布照片；不足 6 张时只显示文字。") },
    }),
  },
  collections: {
    projects: collection({
      label: "项目",
      columns: ["title", "period", "featured", "order", "draft"],
      slugField: "title",
      path: "src/content/projects/*",
      format: { contentField: "content" },
      entryLayout: "content",
      previewUrl: "/projects/{slug}",
      schema: {
        title,
        ...publication,
        publishedAt: automaticDate("发布日期", false),
        updatedAt: automaticDate("更新日期", true),
        period: requiredText("项目时间", "项目实际开展的年份或时间范围，如 2026、2022-2025。"),
        projectType: fields.text({ label: "项目类型", description: "如 App、网页。" }),
        website: fields.text({ label: "项目网址", description: "填写完整的 http 或 https 网址。" }),
        status: fields.select({ label: "项目状态", description: "显示在精选项目卡片上。", options: Object.entries(projectStatuses).map(([value, status]) => ({ value, label: status.label })), defaultValue: "archive" }),
        // Read legacy values without exposing or requiring a separate role field.
        role: { ...fields.text({ label: "我的职责" }), Input: HiddenContentField },
        featured: fields.checkbox({ label: "精选", description: "在首页和项目页的精选区域展示。", defaultValue: false }),
        order: defaultNextOrder({ label: "展示顺序", description: "从 1 开始的唯一位置（含草稿），精选与全部项目共用。新增项目自动排在末尾；修改位置后，其他项目在保存时自动顺移。", validation: { isRequired: true, min: 1 } }, "projects"),
        cover: imageUpload({ label: "项目封面", description: "用于项目卡片、详情页和分享预览。", directory: "public/media/projects", publicPath: "/media/projects/" }),
        archiveImages: fields.array(imageUpload({ label: "档案叠放图片", directory: "public/media/projects", publicPath: "/media/projects/" }), { label: "档案叠放图片（最多选三张）", description: "用于「全部项目」列表的叠图。从上到下依次为：1 最上层、2 中间层、3 最底层，越靠上越在前。新增图片追加到列表末尾，放在已有图片下层；拖动可调整层级。不足三张时，缺少的位置用封面补齐。", itemLabel: ({ value }) => value?.filename || "未上传图片" }),
        privacyNote: fields.text({ label: "匿名化说明", multiline: true }),
        relatedArticles: fields.array(fields.relationship({ label: "相关文章", collection: "articles" }), { label: "相关文章" }),
        content: fields.mdx({ label: "项目正文", extension: "md", options: { image: { directory: "public/media/projects", publicPath: "/media/projects/" } } }),
      },
    }),
    articles: collection({
      label: "写作",
      columns: ["title", "publishedAt", "order", "draft"],
      slugField: "title",
      path: "src/content/articles/*",
      format: { contentField: "content" },
      entryLayout: "content",
      previewUrl: "/writing/{slug}",
      schema: {
        title,
        subtitle: fields.text({ label: "副标题", description: "显示在文章标题下方。" }),
        cover: imageUpload({ label: "文章封面", description: "显示在文章详情顶部，也用于链接分享预览。", directory: "public/media/articles", publicPath: "/media/articles/" }),
        coverAlt: fields.text({ label: "封面描述", description: "供屏幕阅读器描述封面画面；纯装饰图可留空。" }),
        ...publication,
        order: defaultNextOrder({ label: "展示顺序", description: "从 1 开始的唯一位置（含草稿）。新增文章自动排在末尾；修改位置后，其他文章在保存时自动顺移。前台保留年份分组，组内按展示顺序排列。", validation: { isRequired: true, min: 1 } }, "articles"),
        tags: fields.array(fields.text({ label: "标签" }), { label: "标签", itemLabel: ({ value }) => value.trim() || "未填写标签" }),
        category: fields.text({ label: "文章分类", description: "显示在文章日期旁；留空使用第一个标签。" }),
        readingMinutes: fields.integer({ label: "预计阅读分钟", defaultValue: 3, validation: { isRequired: true, min: 1 } }),
        featured: fields.checkbox({ label: "精选", defaultValue: false }),
        relatedProjects: fields.array(fields.relationship({ label: "相关项目", collection: "projects" }), { label: "相关项目" }),
        content: fields.mdx({ label: "文章正文", extension: "md", options: { image: { directory: "public/media/articles", publicPath: "/media/articles/" } } }),
      },
    }),
    photos: collection({
      label: "摄影",
      columns: ["alt", "order", "draft"],
      slugField: "alt",
      path: "src/content/photos/*",
      format: "json",
      previewUrl: "/photos/{slug}",
      schema: {
        src: imageUpload({ label: "照片", description: "保存后压缩并清理敏感元数据。", directory: "public/media/photos", publicPath: "/media/photos/", validation: { isRequired: true } }, true),
        size: photoLayoutSelect({ label: "卡片比例", description: "控制摄影页缩略图比例，随照片方向更新。", options: [{ label: "竖图", value: "tall" }, { label: "横图", value: "short" }], defaultValue: "tall" }, "size"),
        orientation: photoLayoutSelect({ label: "照片方向", description: "由照片宽高自动识别，用于横竖布局。", options: [{ label: "竖图", value: "portrait" }, { label: "横图", value: "landscape" }], defaultValue: "portrait" }, "orientation"),
        alt: photoDescription({ name: { label: "画面描述", description: "供无障碍阅读；默认取文件名，请改为准确的画面描述。", validation: { isRequired: true } }, slug: { label: "稳定短名", description: "用于照片网址，发布后保持不变。" } }),
        order: defaultNextOrder({ label: "展示顺序", description: "从 1 开始的唯一位置（含草稿）。新增照片自动排在末尾；修改位置后，其他照片在保存时自动顺移。", validation: { isRequired: true, min: 1 } }, "photos"),
        draft: fields.checkbox({ label: "草稿", description: "不在网站上公开。", defaultValue: true }),
        width: photoDimension("宽度", 1200),
        height: photoDimension("高度", 1800),
        publicMetadata: fields.object({
          capturedAt: photoMetadataDate({ label: "拍摄日期", description: "从照片信息预填；无法读取时手动填写，发布前请核对。" }),
          place: fields.text({ label: "地点", description: "只填公开范围，避免精确位置。" }),
          camera: photoMetadataText({ label: "相机" }, "camera"),
          lens: photoMetadataText({ label: "镜头" }, "lens"),
          focalLength: photoMetadataText({ label: "焦距" }, "focalLength"),
          aperture: photoMetadataText({ label: "光圈" }, "aperture"),
          shutterSpeed: photoMetadataText({ label: "快门" }, "shutterSpeed"),
          iso: photoMetadataISO({ label: "感光度", validation: { min: 1 } }),
        }, { label: "可公开的拍摄信息" }),
      },
    }),
  },
});
