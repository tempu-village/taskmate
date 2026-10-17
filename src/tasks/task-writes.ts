import type { Task } from "./domain";

export async function failedTaskWrites(tasks: readonly Task[], write: (task: Task) => Promise<unknown>): Promise<Task[]> {
  const results = await Promise.allSettled(tasks.map((task) => write(task)));
  return tasks.filter((_, index) => results[index]?.status === "rejected");
}
