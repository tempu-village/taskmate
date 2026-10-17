import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface SourceImport {
  dependency: string;
  typeOnly: boolean;
}

const root = fileURLToPath(new URL("../", import.meta.url));
export const sourceRoot = resolve(root, "src");

export function sourceFiles(directory = sourceRoot): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = resolve(directory, entry);
      return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
    });
}

export function sourceImports(file: string): SourceImport[] {
  return importSpecifiers(file)
    .map(({ specifier, typeOnly }) => ({ dependency: resolveRelativeImport(file, specifier), typeOnly }))
    .filter((entry): entry is SourceImport => entry.dependency !== null);
}

export function runtimeDependencies(file: string): string[] {
  return sourceImports(file).filter(({ typeOnly }) => !typeOnly).map(({ dependency }) => dependency);
}

export function relativeDependencies(file: string): string[] {
  return sourceImports(file).map(({ dependency }) => dependency);
}

export function importsPackage(file: string, packageName: string): boolean {
  return importSpecifiers(file).some(({ specifier }) => specifier === packageName);
}

export function projectPath(file: string): string {
  return relative(root, file).replaceAll("\\", "/");
}

function importSpecifiers(file: string): Array<{ specifier: string; typeOnly: boolean }> {
  const source = readFileSync(file, "utf8");
  const imports: Array<{ specifier: string; typeOnly: boolean }> = [];
  const importPattern = /\bimport\s+(type\s+)?(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g;
  const reexportPattern = /\bexport\s+(type\s+)?(?:\*|\{[^}]*\})\s*from\s*["']([^"']+)["']/g;
  for (const pattern of [importPattern, reexportPattern]) {
    for (const match of source.matchAll(pattern)) {
      imports.push({ typeOnly: Boolean(match[1]), specifier: match[2] });
    }
  }
  return imports;
}

function resolveRelativeImport(file: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const candidate = resolve(dirname(file), specifier);
  for (const path of [candidate, `${candidate}.ts`, resolve(candidate, "index.ts")]) {
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  throw new Error(`Cannot resolve ${specifier} from ${projectPath(file)}`);
}
