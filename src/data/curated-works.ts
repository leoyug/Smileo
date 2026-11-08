import type { PhotoStackPhoto } from "../lib/photo-stack-types";

const asset = (name: string) => `/assets/figma/curated-works/${name}.webp`;

const exhibitPhotos = [
  ["juju-1", "蓝色封面上的 Jean Jullien 手绘人物", 768, 1024],
  ["juju-3", "展墙上四个冒险角色的线描", 1024, 768],
  ["juju-2", "观众站在手绘的彩色拱门旁", 1200, 1600],
  ["juju-4", "观众在橙色长腿装置下举起双手", 1024, 768],
  ["juju-6", "格线房间里的彩色角色装置", 1024, 768],
  ["juju-5", "绿墙展厅深处的蓝色角色", 768, 1024],
] as const;

const works = [
  {
    id: "contra", title: "Contra Labs", width: 1600, height: 956,
    href: "https://contralabs.com/", alt: "Contra Labs 的古典人物与点阵笔记本",
    summary: "把复古的文艺气质和现代技术揉在一起，用衬线标题、带状标识等古典物件做出了一套完整的视觉语言。",
  },
  {
    id: "rows", title: "Rows", width: 1200, height: 630,
    href: "https://rows.gg/", alt: "Rows 的标志与产品介绍",
    summary: "交互动效做得很棒的小工具，光是 demo 我就玩得停不下来 🤣。",
  },
  {
    id: "juju-cover", detailAsset: "juju-1", title: "《朱朱之城》 · Jean Jullien", width: 1200, height: 1600,
    alt: "蓝色封面上的 Jean Jullien 手绘人物",
    summary: "像是走进了小时候天天幻想的勇者世界，并亲身参与了其中，“去遇见形形色色的旅人，他们都可能成为，你人生故事中的重要篇章”。",
    images: exhibitPhotos.map(([name, alt, width, height]) => ({
      src: asset(name), alt, width, height,
    })),
  },
  {
    id: "riikee", title: "Riikee", width: 1200, height: 630,
    href: "https://riikee.com/zh", alt: "Riikee 写作工具的暖纸色首页",
    summary: "一个能让我安静写作的地方。交互简单，配色舒服，设计也很克制，打开就想写点什么。",
  },
  {
    id: "retro", title: "Retro", width: 420, height: 420,
    href: "https://retro.app/", alt: "Retro 的金属质感标志",
    summary: "一本私人相册，以周为节奏，从日常照片里挑出值得记住的片段。我喜欢它对注意力的分寸感，想起来再打开看看就好。",
  },
  {
    id: "julie", title: "Julie", width: 900, height: 1200,
    alt: "布朗尼乐队《Julie》的人物画封面",
  },
  {
    id: "orbit", title: "Orbit Clocks", width: 1200, height: 630,
    href: "https://clock.ding.one/", alt: "Orbit Clocks 的轨道时钟预览",
    summary: "很有品味的时钟屏保，还可以按自己的喜好搭配，玩出不少有意思的组合。",
  },
];

export const curatedWorks: readonly PhotoStackPhoto[] = works.map(({ id, alt, width, height, detailAsset = id, ...work }) => {
  const previewSrc = asset(id);
  const src = asset(detailAsset);
  return { id, alt, width, height, src, stackSrc: previewSrc, previewSrc, work };
});
