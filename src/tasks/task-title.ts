export function normalizeTaskTitleInput(value: string): string {
  return value.replace(/[ \t]*(?:\r\n?|\n)+[ \t]*/g, " ");
}
