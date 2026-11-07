// Obsidian adds createEl helpers to the window and to every Node. jsdom lacks them, so DOM tests install a minimal copy.
type ElementInfo = { cls?: string | string[]; text?: string; attr?: Record<string, string>; type?: string; parent?: Node };

function create<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, info: ElementInfo | string = {}): HTMLElementTagNameMap[K] {
  const options = typeof info === "string" ? { cls: info } : info;
  const element = doc.createElement(tag);
  const classes = Array.isArray(options.cls) ? options.cls : options.cls ? options.cls.split(" ") : [];
  if (classes.length > 0) element.classList.add(...classes);
  if (options.text !== undefined) element.textContent = options.text;
  if (options.type !== undefined) element.setAttribute("type", options.type);
  Object.entries(options.attr ?? {}).forEach(([name, value]) => element.setAttribute(name, value));
  options.parent?.appendChild(element);
  return element;
}

if (typeof document !== "undefined") {
  const target = globalThis as Record<string, unknown>;
  target.createEl ??= (tag: keyof HTMLElementTagNameMap, info?: ElementInfo | string) => create(document, tag, info);
  target.createSpan ??= (info?: ElementInfo | string) => create(document, "span", info);
  target.createDiv ??= (info?: ElementInfo | string) => create(document, "div", info);
  const proto = Node.prototype as unknown as Record<string, unknown>;
  proto.createEl ??= function (this: Node, tag: keyof HTMLElementTagNameMap, info: ElementInfo | string = {}) {
    const options = typeof info === "string" ? { cls: info } : info;
    return create(this.ownerDocument ?? document, tag, { ...options, parent: this });
  };
  proto.instanceOf ??= function (this: Node, type: new () => unknown) { return this instanceof type; };
}
