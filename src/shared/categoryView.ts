import type { CategoryDefinition } from './types'

type CategoryViewDestination = 'rightPanel' | 'mainEditor'

export function findCategory(
  categories: CategoryDefinition[],
  id: string | null | undefined
): CategoryDefinition | undefined {
  if (!id) return undefined
  return categories.find((c) => c.id === id)
}

function getCategoryViewDestination(
  category: CategoryDefinition | undefined
): CategoryViewDestination {
  return category?.mode === 'panel' ? 'rightPanel' : 'mainEditor'
}

export function categoryOpensInRightPanel(category: CategoryDefinition | undefined): boolean {
  return getCategoryViewDestination(category) === 'rightPanel'
}

export function categoryOpensInMainEditor(category: CategoryDefinition | undefined): boolean {
  return getCategoryViewDestination(category) === 'mainEditor'
}
