import chatgptTool from "../assets/tools/chatgpt.png";
import figmaTool from "../assets/tools/figma.png";
import claudeTool from "../assets/tools/claude.png";
import cursorTool from "../assets/tools/cursor.png";
import diaBrowser from "../assets/tools/dia-browser.png";
import grokBot from "../assets/tools/grok-bot.png";

export const navigation = [
  { label: "首页", href: "/", icon: "/assets/figma/nav-home.svg" },
  { label: "作品", href: "/projects", icon: "/assets/figma/nav-projects.svg" },
  { label: "写作", href: "/writing", icon: "/assets/figma/nav-writing.svg" },
  { label: "摄影", href: "/photos", icon: "/assets/figma/nav-photos.svg" },
  { label: "关于我", href: "/about", icon: "/assets/figma/nav-about.svg" },
];

export const aiLogos = [
  { src: "/assets/ai-logos/claude.webp", alt: "Claude" },
  { src: "/assets/ai-logos/chatgpt.webp", alt: "ChatGPT", rotation: 180 },
  { src: "/assets/ai-logos/cursor-dark.webp", alt: "Cursor" },
] as const;

export const everydayTools = [
  { src: chatgptTool, alt: "ChatGPT", description: "梳理想法、开发实现与日常问答。", variant: "rotated" },
  { src: figmaTool, alt: "Figma", description: "界面设计、原型制作与设计协作。", variant: "default" },
  { src: claudeTool, alt: "Claude", description: "长文阅读、写作与规划项目。", variant: "default" },
  { src: cursorTool, alt: "Cursor", description: "借助 AI 编写、理解和修改代码。", variant: "default" },
  { src: diaBrowser, alt: "Dia Browser", description: "主力浏览器，好用的侧边栏。", variant: "cropped" },
  { src: grokBot, alt: "Grok Bot", description: "我的日常助手。", variant: "rounded" },
] as const;
