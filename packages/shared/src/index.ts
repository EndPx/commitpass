import projectData from "./project.json" with { type: "json" };

export const project = Object.freeze(projectData);
export type ProjectMetadata = typeof project;
export * from "./automation.js";
export * from "./network.js";
export * from "./events.js";
export * from "./event-abi.js";
export { default as monadTestnetDeployment } from "./deployments/monad-testnet.json" with { type: "json" };
