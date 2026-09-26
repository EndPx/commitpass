import projectData from "./project.json" with { type: "json" };

export const project = Object.freeze(projectData);
export type ProjectMetadata = typeof project;
