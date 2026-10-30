export const projectBadgeVariants = {
  personal: {
    label: "个人项目",
    icon: "/assets/figma/project-badge-personal.svg",
    tabIcon: "/assets/figma/project-tab-personal.svg",
  },
  "case-study": {
    label: "设计案例",
    icon: "/assets/figma/project-badge-case-study.svg",
    tabIcon: "/assets/figma/project-tab-case-study.svg",
  },
  experiment: {
    label: "实验探索",
    icon: "/assets/figma/project-badge-experiment.svg",
    tabIcon: "/assets/figma/project-tab-experiment.svg",
  },
} as const;

export type ProjectCategory = keyof typeof projectBadgeVariants;

// Match stable project IDs so sorting or renaming a title does not change its badge.
const projectCategories: Partial<Record<string, ProjectCategory>> = {
  wispora: "personal",
  "Zhaichangxiang-App": "case-study",
  "homagine-website": "case-study",
  "yiwo-admin": "case-study",
};

export function getProjectCategory(projectId: string): ProjectCategory {
  return projectCategories[projectId] ?? "experiment";
}
