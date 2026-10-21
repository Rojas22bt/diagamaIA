import type { Severity } from '../types';

/** Only touches the view DOM. Never calls cell.attr/set or emits model events. */
export function highlightViews(elements: readonly Element[], severity: Severity): () => void {
  const className = `validation-highlight-${severity}`;
  const added = elements.filter(element => !element.classList.contains(className));
  added.forEach(element => element.classList.add(className));
  return () => added.forEach(element => element.classList.remove(className));
}

