import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importsPackage, projectPath, runtimeDependencies, sourceFiles, sourceImports, sourceRoot } from "./import-graph";

// Folder-level dependency rules from docs/engineering/design/architecture.md.
// Every folder may also use the folders in `sharedFolders`.
const allowedFolderDependencies: Record<string, readonly string[]> = {
  tasks: [],
  projects: ["tasks"],
  labels: ["tasks"],
  "task-editor": ["labels", "projects", "tasks"],
  "task-list": ["task-editor", "labels", "projects", "tasks"],
  reviews: ["tasks"],
  "settings.ts": [],
  i18n: [],
  shared: []
};
const sharedFolders = ["i18n", "shared"];
const compositionRoot = resolve(sourceRoot, "main.ts");
const compositionRootTypeReferences = ["task-list", "reviews", "settings.ts"];

describe("Module boundaries", () => {
  it("keeps the runtime TypeScript import graph acyclic", () => {
    const graph = new Map(sourceFiles().map((file) => [file, runtimeDependencies(file)]));
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (file: string, path: string[]): void => {
      if (visiting.has(file)) {
        const cycleStart = path.indexOf(file);
        throw new Error(`Runtime import cycle: ${[...path.slice(cycleStart), file].map(projectPath).join(" -> ")}`);
      }
      if (visited.has(file)) return;
      visiting.add(file);
      for (const dependency of graph.get(file) ?? []) visit(dependency, [...path, file]);
      visiting.delete(file);
      visited.add(file);
    };

    for (const file of graph.keys()) visit(file, []);
  });

  it("assigns every source file outside the composition root to a known folder", () => {
    const unknown = sourceFiles()
      .filter((file) => file !== compositionRoot && !(sourceFolder(file) in allowedFolderDependencies))
      .map(projectPath);

    expect(unknown).toEqual([]);
  });

  it("keeps folder dependencies one-way", () => {
    const violations = sourceFiles()
      .filter((file) => file !== compositionRoot)
      .flatMap((file) => {
        const folder = sourceFolder(file);
        const allowed = new Set([folder, ...sharedFolders, ...(allowedFolderDependencies[folder] ?? [])]);
        return sourceImports(file)
          .filter(({ dependency }) => dependency !== compositionRoot && !allowed.has(sourceFolder(dependency)))
          .map(({ dependency }) => `${projectPath(file)} -> ${projectPath(dependency)}`);
      });

    expect(violations).toEqual([]);
  });

  it("references the composition root only through type imports from known Adapters", () => {
    const violations = sourceFiles()
      .flatMap((file) => sourceImports(file)
        .filter(({ dependency }) => dependency === compositionRoot)
        .filter(({ typeOnly }) => !typeOnly || !compositionRootTypeReferences.includes(sourceFolder(file)))
        .map(({ typeOnly }) => `${projectPath(file)} -> src/main.ts${typeOnly ? " (type)" : ""}`));

    expect(violations).toEqual([]);
  });

  it("keeps the Task core independent of Obsidian except its repository", () => {
    const violations = sourceFiles(resolve(sourceRoot, "tasks"))
      .filter((file) => file !== resolve(sourceRoot, "tasks/repository.ts") && importsPackage(file, "obsidian"))
      .map(projectPath);

    expect(violations).toEqual([]);
  });
});

function sourceFolder(file: string): string {
  return projectPath(file).slice("src/".length).split("/")[0];
}
