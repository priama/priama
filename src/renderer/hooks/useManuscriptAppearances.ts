import { useEffect, useState } from 'react'
import {
  appearancesForEntity,
  type AppearanceRow
} from '@/lib/manuscriptAppearances'
import { useAppStore } from '@/store/appStore'

const DEBOUNCE_MS = 400

/**
 * Debounced manuscript appearance rows for the open entity inspector.
 * Rebuilds from live store prose — never persisted.
 */
export function useManuscriptAppearances(entityId: string | null): AppearanceRow[] {
  const nodes = useAppStore((s) => s.nodes)
  const categories = useAppStore((s) => s.categories)
  const [rows, setRows] = useState<AppearanceRow[]>([])

  useEffect(() => {
    if (!entityId) {
      setRows([])
      return
    }

    const timer = setTimeout(() => {
      setRows(appearancesForEntity(entityId, nodes, categories))
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [entityId, nodes, categories])

  return rows
}
