import type { TaskFilters } from "./domain";

const EMPTY_FILTERS: TaskFilters = {
  priorities: [],
  labels: [],
  search: "",
  includeCompleted: false
};

export class TaskFilterState {
  private filters: TaskFilters = { ...EMPTY_FILTERS };

  value(): TaskFilters {
    return {
      priorities: [...this.filters.priorities],
      labels: [...this.filters.labels],
      search: "",
      includeCompleted: this.filters.includeCompleted
    };
  }

  replace(filters: TaskFilters): void {
    this.filters = {
      priorities: [...filters.priorities],
      labels: [...filters.labels],
      search: "",
      includeCompleted: filters.includeCompleted
    };
  }

  clear(): void {
    this.filters = { ...EMPTY_FILTERS };
  }

  count(): number {
    return this.filters.priorities.length
      + this.filters.labels.length
      + Number(this.filters.includeCompleted);
  }
}
