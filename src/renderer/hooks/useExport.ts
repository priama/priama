import { useCallback, useState } from 'react'
import { useToastStore } from '@/components/UI/toast'
import { flushAllDirty } from '@/lib/contentPersistence'
import type { ExportOptions } from '@shared/types'

export function useExport(): {
  runExport: (options: ExportOptions) => Promise<boolean>
  exporting: boolean
} {
  const addToast = useToastStore((s) => s.addToast)
  const [exporting, setExporting] = useState(false)

  const runExport = useCallback(
    async (options: ExportOptions): Promise<boolean> => {
      setExporting(true)
      try {
        await flushAllDirty()
        const result = await window.electronAPI.export.document(options)
        if (result.success) {
          addToast({
            title: 'Export complete',
            description: result.path ? `Saved to ${result.path}` : undefined,
            variant: 'success'
          })
          return true
        }
        if (result.message && result.message !== 'Cancelled') {
          addToast({ title: 'Export failed', description: result.message, variant: 'warning' })
        }
        return false
      } catch (err) {
        addToast({
          title: 'Export failed',
          description: err instanceof Error ? err.message : 'Something went wrong during export.',
          variant: 'warning'
        })
        return false
      } finally {
        setExporting(false)
      }
    },
    [addToast]
  )

  return { runExport, exporting }
}
