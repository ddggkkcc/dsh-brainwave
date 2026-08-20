/** Pure drawer operations shared by the service and contract tests. */
import type { StashItem } from './storage.js'

export function normalizeStashText(text: string): string | undefined {
  const normalized = text.trim()
  return normalized.length === 0 ? undefined : normalized
}

export function appendStashItem(items: readonly StashItem[] | undefined, item: StashItem): StashItem[] {
  return [...(items ?? []), item]
}

export function removeStashItem(items: readonly StashItem[] | undefined, id: string): StashItem[] | undefined {
  if (items === undefined) return undefined
  const next = items.filter(item => item.id !== id)
  return next.length === 0 ? undefined : next
}
