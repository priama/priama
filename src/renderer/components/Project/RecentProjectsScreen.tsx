import { useEffect, useState } from 'react'
import { FolderOpen, Heart, Plus } from 'lucide-react'
import { Button } from '@/components/UI/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/UI/dialog'
import { Input } from '@/components/UI/input'
import { Label } from '@/components/UI/label'
import { NewProjectModal } from '@/components/Project/NewProjectModal'
import { DeleteProjectModal } from '@/components/Project/DeleteProjectModal'
import { ProjectCard } from '@/components/Project/ProjectCard'
import { useProject } from '@/hooks/useProject'
import type { RecentProjectWithStatus } from '@shared/types'

import { useAppStore } from '@/store/appStore'

const launchBtnBase =
  'font-sans inline-flex items-center gap-[7px] rounded-[7px] border border-transparent px-4 py-[9px] text-[13.5px] font-semibold transition-[background,border-color,color,transform] duration-100 active:scale-[0.97]'

export function RecentProjectsScreen(): React.JSX.Element {
  const { openProject, openProjectAtPath, removeFromRecent, renameRecentProject, locateProject } =
    useProject()
  const { showNewProjectModal, setShowNewProjectModal } = useAppStore()
  const [recents, setRecents] = useState<RecentProjectWithStatus[]>([])
  const [missingProject, setMissingProject] = useState<RecentProjectWithStatus | null>(null)
  const [renameProject, setRenameProject] = useState<RecentProjectWithStatus | null>(null)
  const [deleteProject, setDeleteProject] = useState<RecentProjectWithStatus | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [renaming, setRenaming] = useState(false)

  const loadRecents = async (): Promise<void> => {
    const projects = await window.electronAPI.tomes.getRecentProjects()
    setRecents(projects)
  }

  useEffect(() => {
    void loadRecents()
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.on('tomes:projectOpened', () => {
      void loadRecents()
    })
    return unsub
  }, [])

  const handleOpen = async (project: RecentProjectWithStatus): Promise<void> => {
    if (!project.exists) {
      setMissingProject(project)
      return
    }
    await openProjectAtPath(project.primaryPath)
  }

  const handleLocate = async (): Promise<void> => {
    if (!missingProject) return
    await locateProject(missingProject.id)
    setMissingProject(null)
    await loadRecents()
  }

  const handleRemoveMissing = async (): Promise<void> => {
    if (!missingProject) return
    await removeFromRecent(missingProject.id)
    setMissingProject(null)
    await loadRecents()
  }

  const openRenameDialog = (project: RecentProjectWithStatus): void => {
    setRenameProject(project)
    setRenameTitle(project.title)
  }

  const closeRenameDialog = (): void => {
    if (renaming) return
    setRenameProject(null)
    setRenameTitle('')
  }

  const handleRename = async (): Promise<void> => {
    if (!renameProject || !renameTitle.trim()) return
    setRenaming(true)
    try {
      await renameRecentProject(renameProject.id, renameTitle.trim())
      setRenameProject(null)
      setRenameTitle('')
      await loadRecents()
    } finally {
      setRenaming(false)
    }
  }

  const handleDeleteProject = async (project: RecentProjectWithStatus): Promise<void> => {
    await window.electronAPI.tomes.deleteProject(project.primaryPath, project.id)
    setDeleteProject(null)
    await loadRecents()
  }

  return (
    <div className="flex h-screen flex-col text-[var(--launch-ink)]">
      <header className="flex shrink-0 items-start justify-between gap-6 px-12 pb-[22px] pt-12">
        <div>
          <h1 className="font-serif text-[28px] font-bold leading-[1.15] tracking-[0.2px] text-[var(--launch-accent)]">
            Priama
          </h1>
          <p className="mt-1 text-[12.5px] tracking-[0.1px] text-[var(--launch-ink-faint)]">
            Free forever, fully offline, no account needed — made for writers.
          </p>
        </div>
        <div className="mt-1 flex shrink-0 gap-[10px]">
          <button
            type="button"
            className={`${launchBtnBase} border-[var(--launch-hairline)] bg-transparent text-[var(--launch-ink-dim)] hover:border-[var(--launch-btn-secondary-hover-border)] hover:text-[var(--launch-ink)]`}
            onClick={openProject}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            Open Project
          </button>
          <button
            type="button"
            className={`${launchBtnBase} bg-[var(--launch-ink)] text-[#18181a] hover:bg-[var(--launch-btn-primary-hover)]`}
            onClick={() => setShowNewProjectModal(true)}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
            New Project
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-12 pt-[30px]">
        <div className="mb-[18px]">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--launch-ink-faint)]">
            Recent Projects
          </h2>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] items-stretch gap-[14px] pb-10">
          {recents.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => handleOpen(project)}
              onRename={() => openRenameDialog(project)}
              onStats={() => {}}
              onShowInFolder={() => window.electronAPI.tomes.showInFolder(project.primaryPath)}
              onRemove={async () => {
                await removeFromRecent(project.id)
                await loadRecents()
              }}
              onDelete={() => setDeleteProject(project)}
            />
          ))}

          <button
            type="button"
            className="flex h-full min-h-0 flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--launch-hairline)] bg-transparent text-center text-[var(--launch-ink-faint)] transition-[background,border-color,color,transform] duration-100 hover:border-[var(--launch-accent)] hover:bg-[var(--launch-accent)]/5 hover:text-[var(--launch-ink)] active:scale-[0.99]"
            onClick={() => setShowNewProjectModal(true)}
          >
            <Plus className="h-5 w-5" strokeWidth={2} />
            <span className="text-[12.5px] font-semibold">New Project</span>
          </button>
        </div>
      </main>

      <div className="flex h-12 shrink-0 items-center justify-end pl-12 pr-10">
        <a
          href="https://github.com/sponsors/cigardev"
          target="_blank"
          rel="noreferrer"
          className="relative -top-0.5 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-[var(--launch-gold-top)] to-[var(--launch-gold)] px-3 py-1.5 text-xs font-bold text-[var(--launch-gold-text)] shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-[filter,transform] duration-100 hover:brightness-105 active:scale-[0.97]"
        >
          <Heart className="h-[13px] w-[13px]" />
          Support Priama
        </a>
      </div>

      <NewProjectModal open={showNewProjectModal} onOpenChange={setShowNewProjectModal} />

      <DeleteProjectModal
        project={deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={handleDeleteProject}
      />

      <Dialog open={!!renameProject} onOpenChange={(open) => !open && closeRenameDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>Update the project title shown here and in the project file.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rename-project-title">Title</Label>
            <Input
              id="rename-project-title"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleRename()
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeRenameDialog} disabled={renaming}>
              Cancel
            </Button>
            <Button onClick={() => void handleRename()} disabled={renaming || !renameTitle.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!missingProject} onOpenChange={() => setMissingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Not Found</DialogTitle>
            <DialogDescription>
              Project not found at {missingProject?.primaryPath}. It may have been moved or deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={handleRemoveMissing}>
              Remove from Recent
            </Button>
            <Button onClick={handleLocate}>Locate Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
