// This project's DOM types give "input" listeners a plain Event, while the newer ones the Community scorecard uses
// give an InputEvent, so an `as InputEvent` cast is required here but flagged there. Reading the flag through `in`
// needs no cast with either.
export function isComposingInput(event: Event): boolean {
  return "isComposing" in event && event.isComposing === true;
}
