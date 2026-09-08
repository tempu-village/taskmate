import type { Project } from "./domain";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function parseValue(raw: string): string | null {
  const value = raw.trim();
  if (!value || value === "null") return null;
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function properties(content: string): Record<string, string | null> {
  const match = content.match(FRONTMATTER);
  if (!match) return {};
  const result: Record<string, string | null> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1 || line.startsWith(" ")) continue;
    result[line.slice(0, separator).trim()] = parseValue(line.slice(separator + 1));
  }
  return result;
}

export function parseProjectMarkdown(path: string, content: string): Project | null {
  const props = properties(content);
  if (props.type !== "taskmate-project" || !props.id || !props.name) return null;
  return {
    path,
    id: props.id,
    name: props.name,
    createdAt: props["created-at"] ?? "",
    updatedAt: props["updated-at"] ?? "",
    lastUsedAt: props["last-used-at"]
  };
}

export function encodeProject(project: Project): string {
  return [
    "---",
    "type: taskmate-project",
    `id: ${JSON.stringify(project.id)}`,
    `name: ${JSON.stringify(project.name)}`,
    `created-at: ${JSON.stringify(project.createdAt)}`,
    `updated-at: ${JSON.stringify(project.updatedAt)}`,
    `last-used-at: ${project.lastUsedAt ? JSON.stringify(project.lastUsedAt) : "null"}`,
    "---",
    "",
    `# ${project.name}`,
    ""
  ].join("\n");
}

export function projectFileName(name: string, id: string): string {
  const readable = name
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 80)
    .trim() || "project";
  return `${readable}--${id.slice(0, 8)}.md`;
}
