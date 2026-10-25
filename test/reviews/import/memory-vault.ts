import type { App } from "obsidian";
import { TFile } from "obsidian";

export class MemoryVault {
  readonly files = new Map<string, { file: TFile; content: string }>();
  readonly folders = new Set<string>();
  failModify: ((path: string) => boolean) | null = null;
  failCreate: ((path: string) => boolean) | null = null;
  failProcess: ((path: string) => boolean) | null = null;

  put(path: string, content: string): TFile {
    const file = new TFile();
    file.path = path;
    Object.defineProperty(file, "extension", { get: () => file.path.split(".").pop() ?? "" });
    this.files.set(path, { file, content });
    return file;
  }
  text(path: string): string {
    const entry = this.files.get(path);
    if (!entry) throw new Error(`missing ${path}`);
    return entry.content;
  }
  getFiles(): TFile[] { return [...this.files.values()].map((entry) => entry.file); }
  getMarkdownFiles(): TFile[] { return this.getFiles().filter((file) => file.path.endsWith(".md")); }
  getAbstractFileByPath(path: string): unknown { return this.files.get(path)?.file ?? (this.folders.has(path) ? { path } : null); }
  async read(file: TFile): Promise<string> { return this.text(file.path); }
  async cachedRead(file: TFile): Promise<string> { return this.read(file); }
  async create(path: string, content: string): Promise<TFile> {
    if (this.failCreate?.(path)) throw new Error(`create failed: ${path}`);
    return this.put(path, content);
  }
  async modify(file: TFile, content: string): Promise<void> {
    if (this.failModify?.(file.path)) throw new Error(`modify failed: ${file.path}`);
    this.files.get(file.path)!.content = content;
  }
  async process(file: TFile, change: (content: string) => string): Promise<string> {
    if (this.failProcess?.(file.path)) throw new Error(`process failed: ${file.path}`);
    const entry = this.files.get(file.path)!;
    entry.content = change(entry.content);
    return entry.content;
  }
  async createFolder(path: string): Promise<void> { this.folders.add(path); }

  app(): App {
    return {
      vault: this,
      fileManager: {
        renameFile: async (file: TFile, path: string) => {
          const entry = this.files.get(file.path)!;
          this.files.delete(file.path);
          file.path = path;
          this.files.set(path, entry);
        }
      }
    } as unknown as App;
  }
}
