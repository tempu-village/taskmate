import type { Task } from "../tasks/domain";

export class TaskSelection {
  private active = false;
  private selected = new Set<string>();
  private scope = new Set<string>();

  isActive(): boolean {
    return this.active;
  }

  selectedIds(): ReadonlySet<string> {
    return this.selected;
  }

  selectedCount(): number {
    return this.selected.size;
  }

  scopeSize(): number {
    return this.scope.size;
  }

  selectedTasks(tasks: readonly Task[]): Task[] {
    return tasks.filter((task) => this.selected.has(task.id));
  }

  start(scopeIds: Iterable<string>): void {
    this.scope = new Set(scopeIds);
    this.selected = new Set();
    this.active = true;
  }

  toggle(id: string): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  toggleAll(): void {
    this.selected = this.selected.size === this.scope.size ? new Set() : new Set(this.scope);
  }

  retainExisting(existingIds: Iterable<string>): void {
    const existing = new Set(existingIds);
    this.scope = new Set([...this.scope].filter((id) => existing.has(id)));
    this.selected = new Set([...this.selected].filter((id) => this.scope.has(id)));
  }

  restrictTo(ids: Iterable<string>): void {
    this.scope = new Set(ids);
    this.selected = new Set(this.scope);
  }

  exit(): void {
    this.active = false;
    this.selected = new Set();
    this.scope = new Set();
  }
}
