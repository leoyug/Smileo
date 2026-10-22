export const projectBadgeVariants = {
  personal: {
    label: "个人项目",
    icon: "/assets/figma/project-badge-personal.svg",
  },
  "case-study": {
    label: "设计案例",
    icon: "/assets/figma/project-badge-case-study.svg",
  },
  experiment: {
    label: "实验探索",
    icon: "/assets/figma/project-badge-experiment.svg",
  },
} as const;

export type ProjectBadgeVariant = keyof typeof projectBadgeVariants;

// Match stable project IDs so sorting or renaming a title does not change its badge.
export const featuredProjectBadges: Partial<Record<string, ProjectBadgeVariant>> = {
  wanderland: "personal",
  "homagine-app": "case-study",
};
