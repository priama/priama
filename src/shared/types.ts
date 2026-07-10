import {
  BUILTIN_CATEGORY_IDS,
  NF_PEOPLE_CATEGORY_ID
} from './categoryIds'

type EntityType = 'character' | 'location' | 'lore'

export type WikiEntityType = EntityType | 'note'

export type FolderScope = 'manuscript' | 'characters' | 'locations' | 'lore' | 'notes' | 'entry'

export type NodeType =
  | 'folder'
  | 'chapter'
  | 'scene'
  | 'character'
  | 'location'
  | 'lore'
  | 'note'
  | 'entry'

export type TrashCategory =
  | 'chapters'
  | 'scenes'
  | 'characters'
  | 'locations'
  | 'lore'
  | 'notes'
  | 'entries'

export type ChapterLabelStyle = 'number-and-title' | 'number-only' | 'title-only' | 'none'
export type ChapterNumberFormat = 'digits' | 'words' | 'roman'
export type ChapterNumberingScope = 'manuscript-global' | 'export-relative'
export type ParagraphStyle = 'first-line-indent' | 'spaced'
export type TextAlignStyle = 'justify' | 'left'

export interface BookSettings {
  coverImagePath: string | null
  chapterLabelStyle: ChapterLabelStyle
  chapterNumberFormat: ChapterNumberFormat
  chapterNumberingScope: ChapterNumberingScope
  chapterLabelPrefix: string
  showSceneTitles: boolean
  sceneBreakMarker: string
  includeTitlePage: boolean
  dedication: string
  copyrightText: string
  paragraphStyle: ParagraphStyle
  textAlign: TextAlignStyle
}

export const DEFAULT_BOOK_SETTINGS: BookSettings = {
  coverImagePath: null,
  chapterLabelStyle: 'number-and-title',
  chapterNumberFormat: 'digits',
  chapterNumberingScope: 'manuscript-global',
  chapterLabelPrefix: 'Chapter',
  showSceneTitles: false,
  sceneBreakMarker: '* * *',
  includeTitlePage: true,
  dedication: '',
  copyrightText: '',
  paragraphStyle: 'first-line-indent',
  textAlign: 'justify'
}

const CHAPTER_LABEL_STYLES: ChapterLabelStyle[] = [
  'number-and-title',
  'number-only',
  'title-only',
  'none'
]
const CHAPTER_NUMBER_FORMATS: ChapterNumberFormat[] = ['digits', 'words', 'roman']
const CHAPTER_NUMBERING_SCOPES: ChapterNumberingScope[] = ['manuscript-global', 'export-relative']
const PARAGRAPH_STYLES: ParagraphStyle[] = ['first-line-indent', 'spaced']
const TEXT_ALIGN_STYLES: TextAlignStyle[] = ['justify', 'left']

export function normalizeBookSettings(raw: Partial<BookSettings> & Record<string, unknown>): BookSettings {
  const chapterLabelStyle = CHAPTER_LABEL_STYLES.includes(raw.chapterLabelStyle as ChapterLabelStyle)
    ? (raw.chapterLabelStyle as ChapterLabelStyle)
    : DEFAULT_BOOK_SETTINGS.chapterLabelStyle
  const chapterNumberFormat = CHAPTER_NUMBER_FORMATS.includes(raw.chapterNumberFormat as ChapterNumberFormat)
    ? (raw.chapterNumberFormat as ChapterNumberFormat)
    : DEFAULT_BOOK_SETTINGS.chapterNumberFormat
  const chapterNumberingScope = CHAPTER_NUMBERING_SCOPES.includes(
    raw.chapterNumberingScope as ChapterNumberingScope
  )
    ? (raw.chapterNumberingScope as ChapterNumberingScope)
    : DEFAULT_BOOK_SETTINGS.chapterNumberingScope
  const paragraphStyle = PARAGRAPH_STYLES.includes(raw.paragraphStyle as ParagraphStyle)
    ? (raw.paragraphStyle as ParagraphStyle)
    : DEFAULT_BOOK_SETTINGS.paragraphStyle
  const textAlign = TEXT_ALIGN_STYLES.includes(raw.textAlign as TextAlignStyle)
    ? (raw.textAlign as TextAlignStyle)
    : DEFAULT_BOOK_SETTINGS.textAlign

  const sceneBreakMarker =
    typeof raw.sceneBreakMarker === 'string'
      ? raw.sceneBreakMarker.trim()
      : DEFAULT_BOOK_SETTINGS.sceneBreakMarker

  return {
    coverImagePath:
      typeof raw.coverImagePath === 'string' && raw.coverImagePath.trim()
        ? raw.coverImagePath.trim()
        : null,
    chapterLabelStyle,
    chapterNumberFormat,
    chapterNumberingScope,
    chapterLabelPrefix:
      typeof raw.chapterLabelPrefix === 'string'
        ? raw.chapterLabelPrefix.trim()
        : DEFAULT_BOOK_SETTINGS.chapterLabelPrefix,
    showSceneTitles: raw.showSceneTitles === true,
    sceneBreakMarker,
    includeTitlePage: raw.includeTitlePage !== false,
    dedication: typeof raw.dedication === 'string' ? raw.dedication : '',
    copyrightText: typeof raw.copyrightText === 'string' ? raw.copyrightText : '',
    paragraphStyle,
    textAlign
  }
}

export type SpellCheckLang = 'en' | 'es'

export interface ProjectMeta {
  id: string
  title: string
  author: string
  genre?: string
  spellCheckLang?: SpellCheckLang
  bookSettings: BookSettings
  categories: CategoryDefinition[]
  createdAt: string
  updatedAt: string
}

export interface FolderMeta {
  scope: FolderScope
}

export interface TreeNode {
  id: string
  parentId: string | null
  type: NodeType
  title: string
  sortOrder: number
  content: string
  metadata: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  originalParentId?: string | null
  categoryId?: string | null
}

export type CharacterRelationshipType =
  | 'Family'
  | 'Friend'
  | 'Enemy'
  | 'Rival'
  | 'Mentor'
  | 'Romantic'
  | 'Ally'
  | 'Unknown'

export const CHARACTER_RELATIONSHIP_TYPES: CharacterRelationshipType[] = [
  'Family',
  'Friend',
  'Enemy',
  'Rival',
  'Mentor',
  'Romantic',
  'Ally',
  'Unknown'
]

export interface CharacterRelationship {
  characterId: string
  type: CharacterRelationshipType
}

export type PeopleRelationshipType =
  | 'Colleague'
  | 'Source'
  | 'Interview Subject'
  | 'Family'
  | 'Friend'
  | 'Mentor'
  | 'Other'
  | 'Unknown'

export const PEOPLE_RELATIONSHIP_TYPES: PeopleRelationshipType[] = [
  'Colleague',
  'Source',
  'Interview Subject',
  'Family',
  'Friend',
  'Mentor',
  'Other',
  'Unknown'
]

export interface PeopleRelationship {
  personId: string
  type: PeopleRelationshipType
}

export {
  BUILTIN_CATEGORY_IDS,
  NF_PEOPLE_CATEGORY_ID,
  OPTIONAL_BESTIARY_CATEGORY_ID,
  PEOPLE_INTERVIEW_STATUS_OPTIONS
} from './categoryIds'

// ─── Panel block system ───────────────────────────────────────────────────────

type PanelBlockType =
  | 'text'
  | 'textarea'
  | 'status'
  | 'tags'
  | 'relationships'

interface PanelBlockBase {
  id: string
  label: string
  type: PanelBlockType
}

export interface PanelBlockText extends PanelBlockBase {
  type: 'text'
  placeholder?: string
}

export interface PanelBlockTextarea extends PanelBlockBase {
  type: 'textarea'
  placeholder?: string
  rows?: number
}

export interface PanelBlockStatus extends PanelBlockBase {
  type: 'status'
  options: string[]
}

export interface PanelBlockTags extends PanelBlockBase {
  type: 'tags'
  placeholder?: string
}

export interface PanelBlockRelationships extends PanelBlockBase {
  type: 'relationships'
  /** Which categoryIds the user can link to. Empty means any category. */
  allowedCategoryIds?: string[]
}

export type PanelBlock =
  | PanelBlockText
  | PanelBlockTextarea
  | PanelBlockStatus
  | PanelBlockTags
  | PanelBlockRelationships

// ─── Category system ──────────────────────────────────────────────────────────

export type CategoryMode = 'panel' | 'editor'

export interface CategoryDefinition {
  id: string
  name: string
  icon: string
  mode: CategoryMode
  sortOrder: number
  builtIn: boolean
  /** Panel layout — only used when mode === 'panel' */
  panelBlocks?: PanelBlock[]
  /**
   * How nodes are stored on disk — always set by normalizeCategoryDefinition after load.
   * Never read directly; use nodeKindForCategory(cat).
   */
  nodeKind?: 'character' | 'location' | 'lore' | 'note' | 'entry'
}

// ─── Template definitions ─────────────────────────────────────────────────────

export type TemplateId = 'blank' | 'fiction' | 'non-fiction'

export interface ProjectTemplate {
  id: TemplateId
  name: string
  description: string
  /** ids into CATEGORY_PRESET_CATALOG */
  presetIds: string[]
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Just the manuscript. Add categories whenever you need them.',
    presetIds: []
  },
  {
    id: 'fiction',
    name: 'Fiction',
    description: 'Characters, Locations, Lore, and Notes. The classic setup for novels, short stories, and long complex stories.',
    presetIds: [
      BUILTIN_CATEGORY_IDS.characters,
      BUILTIN_CATEGORY_IDS.locations,
      BUILTIN_CATEGORY_IDS.lore,
      BUILTIN_CATEGORY_IDS.notes
    ]
  },
  {
    id: 'non-fiction',
    name: 'Non-Fiction',
    description: 'People, Sources, Concepts, and Notes. Built for journalism, narrative non-fiction, and research-driven books.',
    presetIds: [
      NF_PEOPLE_CATEGORY_ID,
      'nf-sources',
      'nf-concepts',
      BUILTIN_CATEGORY_IDS.notes
    ]
  }
]

export const MAX_ENTITY_GALLERY_IMAGES = 30

function normalizeSecondaryImagePaths(
  raw: unknown,
  imagePath: string | null
): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const paths: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string' || !entry || entry === imagePath || seen.has(entry)) continue
    seen.add(entry)
    paths.push(entry)
    if (paths.length >= MAX_ENTITY_GALLERY_IMAGES) break
  }
  return paths
}

export interface CharacterMeta {
  aliases: string[]
  general: string
  age: string
  race: string
  gender: string
  professions: string[]
  physicalDescription: string
  personality: string
  background: string
  role: string
  relationships: CharacterRelationship[]
  startsAs: string
  endsAs: string
  notes: string
  imagePath: string | null
  secondaryImagePaths: string[]
}

export interface LocationMeta {
  type: string
  general: string
  description: string
  connectedLocations: string[]
  notableCharacters: string[]
  notes: string
  imagePath: string | null
  secondaryImagePaths: string[]
}

export interface LoreMeta {
  category: string
  general: string
  description: string
  relatedCharacters: string[]
  relatedLocations: string[]
  notes: string
  imagePath: string | null
  secondaryImagePaths: string[]
}

export interface NoteMeta {
  tags: string[]
}

export interface PeopleMeta {
  imagePath: string | null
  secondaryImagePaths: string[]
  knownAs: string
  ethnicity: string
  gender: string
  age: string
  general: string
  roleTitle: string
  organization: string
  interviewStatus: string
  keyQuotes: string
  relevance: string
  relationships: PeopleRelationship[]
  notes: string
}

export interface BestiaryMeta {
  imagePath: string | null
  secondaryImagePaths: string[]
  /** Creature species/kind (e.g. "Fire Dragon") — not CharacterMeta.race */
  species: string
  /** Creature type classification — not TreeNode.type */
  type: string
  general: string
  habitat: string
  physicalDescription: string
  behavior: string
  origin: string
  /** How the creature fights or acts */
  abilities: string
  /** How protagonists counter or exploit this creature */
  weaknesses: string
  notes: string
}

export type EntityMeta = CharacterMeta | LocationMeta | LoreMeta | NoteMeta | PeopleMeta | BestiaryMeta

export type ExportPageSize = 'letter' | 'a4'
export type ExportMarginPreset = 'narrow' | 'normal' | 'wide'
export type ExportFontFamily = 'serif' | 'sans'

export interface ExportFormatting {
  fontFamily: ExportFontFamily
  fontSize: number
  marginPreset: ExportMarginPreset
  pageSize: ExportPageSize
}

export const DEFAULT_EXPORT_FORMATTING: ExportFormatting = {
  fontFamily: 'serif',
  fontSize: 12,
  marginPreset: 'normal',
  pageSize: 'letter'
}

export interface ExportOptions {
  format: 'docx' | 'pdf' | 'epub'
  title: string
  author: string
  genre?: string
  scope: 'chapters' | 'manuscript'
  chapterIds?: string[]
  formatting: ExportFormatting
}

export interface ExportSection {
  id: string
  title: string
  level: 'chapter' | 'scene'
  html: string
  displayHeading: string | null
  sceneBreakBefore?: boolean
}

export interface DevicePreviewRequestOptions {
  scope: 'chapter' | 'manuscript'
  nodeId?: string
}

export interface DevicePreviewResponse {
  epub: ArrayBuffer
  title: string
  author: string
}

export type DevicePresetId =
  | 'kindle-6'
  | 'kindle-paperwhite'
  | 'kindle-scribe'
  | 'pocketbook-era'
  | 'pocketbook-verse'
  | 'pocketbook-inkpad-4'
  | 'ipad-mini'
  | 'ipad-10'
  | 'iphone-se'
  | 'iphone-15'
  | 'iphone-15-pro-max'
  | 'samsung-galaxy-s27'

export interface DevicePreset {
  id: DevicePresetId
  label: string
  widthPx: number
  heightPx: number
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'kindle-6', label: 'Kindle (6")', widthPx: 1072, heightPx: 1448 },
  { id: 'kindle-paperwhite', label: 'Kindle Paperwhite (6.8")', widthPx: 1236, heightPx: 1648 },
  { id: 'kindle-scribe', label: 'Kindle Scribe (10.2")', widthPx: 1860, heightPx: 2480 },
  { id: 'pocketbook-era', label: 'PocketBook Era (6")', widthPx: 1072, heightPx: 1448 },
  { id: 'pocketbook-verse', label: 'PocketBook Verse (6.8")', widthPx: 1264, heightPx: 1680 },
  { id: 'pocketbook-inkpad-4', label: 'PocketBook InkPad 4 (7.8")', widthPx: 1404, heightPx: 1872 },
  { id: 'ipad-mini', label: 'iPad mini (8.3")', widthPx: 1488, heightPx: 2266 },
  { id: 'ipad-10', label: 'iPad (10.9")', widthPx: 1640, heightPx: 2360 },
  { id: 'iphone-se', label: 'iPhone SE', widthPx: 750, heightPx: 1334 },
  { id: 'iphone-15', label: 'iPhone 15', widthPx: 1170, heightPx: 2532 },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', widthPx: 1290, heightPx: 2796 },
  { id: 'samsung-galaxy-s27', label: 'Samsung Galaxy S27', widthPx: 1440, heightPx: 3120 }
]

function deviceMaxDimension(preset: DevicePreset): number {
  return Math.max(preset.widthPx, preset.heightPx)
}

export const LARGEST_DEVICE_PRESET = DEVICE_PRESETS.reduce((largest, preset) =>
  deviceMaxDimension(preset) > deviceMaxDimension(largest) ? preset : largest
)

export interface ManuscriptChapterRef {
  id: string
  title: string
  pathLabel: string
}

export interface BackupWarning {
  path: string
  message: string
}

export interface SaveResult {
  success: boolean
  lastSaved: string
  backupPath?: string
  backupWarnings?: BackupWarning[]
  unreachableBackupPaths?: string[]
}

export interface RecentProjectEntry {
  id: string
  title: string
  author: string
  primaryPath: string
  lastOpened: string
  coverColor: string
}

export interface RecentProjectWithStatus extends RecentProjectEntry {
  exists: boolean
}

export interface BackupLocationStatus {
  path: string
  reachable: boolean
  writable: boolean
  label: string
}

export interface PriamaPreferences {
  maxBackupsPerLocation: number
  theme: 'light' | 'dark'
  defaultChapterStructure?: ChapterStructure
  skipChapterStructurePrompt?: boolean
}

export type ChapterStructure = 'simple' | 'scenes'

export interface ChapterMeta {
  structure: ChapterStructure
}

export type ContainerViewMode = 'cards' | 'list'

export interface ProjectUiState {
  sectionOrder: string[]
  selectedNodeId: string | null
  selectedContainerId: string | null
  selectedEntityId: string | null
  selectedEntityType: WikiEntityType | null
  selectedEntryId: string | null
  selectedEntryCategoryId: string | null
  expandedSections: string[]
  /** @deprecated Merged into expandedSections on load. Present only in legacy project files. */
  expandedFolders?: string[]
  rightPanelOpen: boolean
  /** Per-container cards/list preference. Missing keys default to cards. */
  containerViewModes: Record<string, ContainerViewMode>
}

export interface NavigationSyncState {
  selectedNodeId: string | null
  selectedContainerId: string | null
  selectedEntityId: string | null
  selectedEntityType: WikiEntityType | null
  selectedEntryId?: string | null
  selectedEntryCategoryId?: string | null
  expandedSections: string[]
  rightPanelOpen: boolean
  sectionOrder: string[]
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

interface SecondaryWindowState {
  nodeId: string
  bounds: WindowBounds
}

export interface WindowLayoutState {
  sidebarWidth: number
  rightPanelWidth: number
  secondaryWindows: SecondaryWindowState[]
}

export interface PriamaConfig {
  version: string
  recentProjects: RecentProjectEntry[]
  backupLocations: Record<string, string[]>
  preferences: PriamaPreferences
  windowLayout?: WindowLayoutState
}

export interface CreateProjectInput {
  title: string
  author: string
  genre: string
  primaryParentDir: string
  backupLocations: string[]
  templateId: TemplateId
  categories: CategoryDefinition[]
}

export interface TomesIndexEntry {
  id: string
  filename: string
  title: string
  sortOrder: number
  parentId?: string | null
  deletedAt?: string | null
  originalParentId?: string | null
  folderScope?: FolderScope
  categoryId?: string
}

export interface TomesManifest {
  __tomes: string
  id: string
  title: string
  author: string
  genre: string
  createdAt: string
  lastSavedAt: string
  version: string
  bookSettings?: BookSettings
  spellCheckLang?: SpellCheckLang
  categories?: CategoryDefinition[]
  uiState?: ProjectUiState
  index: {
    folders: TomesIndexEntry[]
    chapters: TomesIndexEntry[]
    scenes: TomesIndexEntry[]
    characters: TomesIndexEntry[]
    locations: TomesIndexEntry[]
    lore: TomesIndexEntry[]
    notes: TomesIndexEntry[]
    entries: TomesIndexEntry[]
  }
}

export interface TxDFile {
  id: string
  parentId: string | null
  type: NodeType
  title: string
  sortOrder: number
  content: string
  metadata: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  originalParentId?: string | null
  categoryId?: string | null
}

export const TOMES_MAGIC = '1.0'
export const PROJECT_FILENAME = 'project.tomes'
export const TXD_EXT = '.txd'

export const COVER_COLORS = [
  '#7C3AED',
  '#2563EB',
  '#059669',
  '#D97706',
  '#DC2626',
  '#DB2777',
  '#0891B2',
  '#4F46E5'
]

export const DEFAULT_CHARACTER_META: CharacterMeta = {
  aliases: [],
  general: '',
  age: '',
  race: '',
  gender: '',
  professions: [],
  physicalDescription: '',
  personality: '',
  background: '',
  role: '',
  relationships: [],
  startsAs: '',
  endsAs: '',
  notes: '',
  imagePath: null,
  secondaryImagePaths: []
}

export function normalizeCharacterMeta(raw: Partial<CharacterMeta> & Record<string, unknown>): CharacterMeta {
  const relationships: CharacterRelationship[] = Array.isArray(raw.relationships)
    ? raw.relationships.map((entry) => {
        const rel = entry as Partial<CharacterRelationship> & { description?: string }
        const type =
          rel.type && CHARACTER_RELATIONSHIP_TYPES.includes(rel.type as CharacterRelationshipType)
            ? (rel.type as CharacterRelationshipType)
            : 'Unknown'
        return {
          characterId: typeof rel.characterId === 'string' ? rel.characterId : '',
          type
        }
      })
    : []

  const imagePath =
    typeof raw.imagePath === 'string'
      ? raw.imagePath
      : raw.imagePath === null
        ? null
        : DEFAULT_CHARACTER_META.imagePath

  return {
    ...DEFAULT_CHARACTER_META,
    ...raw,
    aliases: Array.isArray(raw.aliases) ? raw.aliases.map(String) : DEFAULT_CHARACTER_META.aliases,
    general: typeof raw.general === 'string' ? raw.general : DEFAULT_CHARACTER_META.general,
    professions: Array.isArray(raw.professions)
      ? raw.professions.map(String).filter(Boolean)
      : DEFAULT_CHARACTER_META.professions,
    relationships,
    startsAs: typeof raw.startsAs === 'string' ? raw.startsAs : DEFAULT_CHARACTER_META.startsAs,
    endsAs: typeof raw.endsAs === 'string' ? raw.endsAs : DEFAULT_CHARACTER_META.endsAs,
    imagePath,
    secondaryImagePaths: normalizeSecondaryImagePaths(raw.secondaryImagePaths, imagePath)
  }
}

export const DEFAULT_LOCATION_META: LocationMeta = {
  type: '',
  general: '',
  description: '',
  connectedLocations: [],
  notableCharacters: [],
  notes: '',
  imagePath: null,
  secondaryImagePaths: []
}

export function normalizeLocationMeta(raw: Partial<LocationMeta> & Record<string, unknown>): LocationMeta {
  const parsed = { ...DEFAULT_LOCATION_META, ...raw }
  const imagePath =
    typeof raw.imagePath === 'string'
      ? raw.imagePath
      : raw.imagePath === null
        ? null
        : DEFAULT_LOCATION_META.imagePath
  return {
    ...parsed,
    general: typeof raw.general === 'string' ? raw.general : DEFAULT_LOCATION_META.general,
    connectedLocations: Array.isArray(parsed.connectedLocations) ? parsed.connectedLocations : [],
    notableCharacters: Array.isArray(parsed.notableCharacters) ? parsed.notableCharacters : [],
    imagePath,
    secondaryImagePaths: normalizeSecondaryImagePaths(raw.secondaryImagePaths, imagePath)
  }
}

export const DEFAULT_LORE_META: LoreMeta = {
  category: '',
  general: '',
  description: '',
  relatedCharacters: [],
  relatedLocations: [],
  notes: '',
  imagePath: null,
  secondaryImagePaths: []
}

export function normalizeLoreMeta(raw: Partial<LoreMeta> & Record<string, unknown>): LoreMeta {
  const imagePath =
    typeof raw.imagePath === 'string'
      ? raw.imagePath
      : raw.imagePath === null
        ? null
        : DEFAULT_LORE_META.imagePath
  return {
    ...DEFAULT_LORE_META,
    ...raw,
    general: typeof raw.general === 'string' ? raw.general : DEFAULT_LORE_META.general,
    relatedCharacters: Array.isArray(raw.relatedCharacters) ? raw.relatedCharacters.map(String) : [],
    relatedLocations: Array.isArray(raw.relatedLocations) ? raw.relatedLocations.map(String) : [],
    imagePath,
    secondaryImagePaths: normalizeSecondaryImagePaths(raw.secondaryImagePaths, imagePath)
  }
}

export const DEFAULT_NOTE_META: NoteMeta = {
  tags: []
}

export const DEFAULT_PEOPLE_META: PeopleMeta = {
  imagePath: null,
  secondaryImagePaths: [],
  knownAs: '',
  ethnicity: '',
  gender: '',
  age: '',
  general: '',
  roleTitle: '',
  organization: '',
  interviewStatus: '',
  keyQuotes: '',
  relevance: '',
  relationships: [],
  notes: ''
}

export function normalizePeopleMeta(raw: Partial<PeopleMeta> & Record<string, unknown>): PeopleMeta {
  const relationships: PeopleRelationship[] = Array.isArray(raw.relationships)
    ? raw.relationships.map((entry) => {
        const rel = entry as Partial<PeopleRelationship>
        const type =
          rel.type && PEOPLE_RELATIONSHIP_TYPES.includes(rel.type as PeopleRelationshipType)
            ? (rel.type as PeopleRelationshipType)
            : 'Unknown'
        return {
          personId: typeof rel.personId === 'string' ? rel.personId : '',
          type
        }
      })
    : []

  const imagePath =
    typeof raw.imagePath === 'string'
      ? raw.imagePath
      : raw.imagePath === null
        ? null
        : DEFAULT_PEOPLE_META.imagePath

  return {
    ...DEFAULT_PEOPLE_META,
    ...raw,
    knownAs: typeof raw.knownAs === 'string' ? raw.knownAs : DEFAULT_PEOPLE_META.knownAs,
    ethnicity: typeof raw.ethnicity === 'string' ? raw.ethnicity : DEFAULT_PEOPLE_META.ethnicity,
    gender: typeof raw.gender === 'string' ? raw.gender : DEFAULT_PEOPLE_META.gender,
    age: typeof raw.age === 'string' ? raw.age : DEFAULT_PEOPLE_META.age,
    general: typeof raw.general === 'string' ? raw.general : DEFAULT_PEOPLE_META.general,
    roleTitle: typeof raw.roleTitle === 'string' ? raw.roleTitle : DEFAULT_PEOPLE_META.roleTitle,
    organization:
      typeof raw.organization === 'string' ? raw.organization : DEFAULT_PEOPLE_META.organization,
    interviewStatus:
      typeof raw.interviewStatus === 'string'
        ? raw.interviewStatus
        : DEFAULT_PEOPLE_META.interviewStatus,
    keyQuotes: typeof raw.keyQuotes === 'string' ? raw.keyQuotes : DEFAULT_PEOPLE_META.keyQuotes,
    relevance: typeof raw.relevance === 'string' ? raw.relevance : DEFAULT_PEOPLE_META.relevance,
    notes: typeof raw.notes === 'string' ? raw.notes : DEFAULT_PEOPLE_META.notes,
    relationships,
    imagePath,
    secondaryImagePaths: normalizeSecondaryImagePaths(raw.secondaryImagePaths, imagePath)
  }
}

export const DEFAULT_BESTIARY_META: BestiaryMeta = {
  imagePath: null,
  secondaryImagePaths: [],
  species: '',
  type: '',
  general: '',
  habitat: '',
  physicalDescription: '',
  behavior: '',
  origin: '',
  abilities: '',
  weaknesses: '',
  notes: ''
}

export function normalizeBestiaryMeta(raw: Partial<BestiaryMeta> & Record<string, unknown>): BestiaryMeta {
  const imagePath =
    typeof raw.imagePath === 'string'
      ? raw.imagePath
      : raw.imagePath === null
        ? null
        : DEFAULT_BESTIARY_META.imagePath

  return {
    ...DEFAULT_BESTIARY_META,
    ...raw,
    species: typeof raw.species === 'string' ? raw.species : DEFAULT_BESTIARY_META.species,
    type: typeof raw.type === 'string' ? raw.type : DEFAULT_BESTIARY_META.type,
    general: typeof raw.general === 'string' ? raw.general : DEFAULT_BESTIARY_META.general,
    habitat: typeof raw.habitat === 'string' ? raw.habitat : DEFAULT_BESTIARY_META.habitat,
    physicalDescription:
      typeof raw.physicalDescription === 'string'
        ? raw.physicalDescription
        : DEFAULT_BESTIARY_META.physicalDescription,
    behavior: typeof raw.behavior === 'string' ? raw.behavior : DEFAULT_BESTIARY_META.behavior,
    origin: typeof raw.origin === 'string' ? raw.origin : DEFAULT_BESTIARY_META.origin,
    abilities: typeof raw.abilities === 'string' ? raw.abilities : DEFAULT_BESTIARY_META.abilities,
    weaknesses:
      typeof raw.weaknesses === 'string' ? raw.weaknesses : DEFAULT_BESTIARY_META.weaknesses,
    notes: typeof raw.notes === 'string' ? raw.notes : DEFAULT_BESTIARY_META.notes,
    imagePath,
    secondaryImagePaths: normalizeSecondaryImagePaths(raw.secondaryImagePaths, imagePath)
  }
}

export function normalizeNoteMeta(raw: Partial<NoteMeta> & Record<string, unknown>): NoteMeta {
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : []
  return { tags }
}

export const DEFAULT_CHAPTER_META: ChapterMeta = {
  structure: 'scenes'
}

export const DEFAULT_FOLDER_META: FolderMeta = {
  scope: 'manuscript'
}

export const TRASH_RETENTION_DAYS = 50

export const TRASH_CATEGORY_LABELS: Record<TrashCategory, string> = {
  chapters: 'Chapters',
  scenes: 'Scenes',
  characters: 'Characters',
  locations: 'Locations',
  lore: 'Lore',
  notes: 'Notes',
  entries: 'Entries'
}

export const SIDEBAR_MAX_WIDTH = 280
export const SIDEBAR_MIN_WIDTH = 56
export const RIGHT_PANEL_MIN_WIDTH = 320
export const RIGHT_PANEL_MAX_WIDTH = 640

export const DEFAULT_SECTION_ORDER = [
  BUILTIN_CATEGORY_IDS.characters,
  BUILTIN_CATEGORY_IDS.locations,
  BUILTIN_CATEGORY_IDS.lore,
  BUILTIN_CATEGORY_IDS.notes
]

const LEGACY_SECTION_TO_CATEGORY: Record<string, string> = {
  characters: BUILTIN_CATEGORY_IDS.characters,
  locations: BUILTIN_CATEGORY_IDS.locations,
  lore: BUILTIN_CATEGORY_IDS.lore,
  notes: BUILTIN_CATEGORY_IDS.notes
}

export const DEFAULT_EXPANDED_SECTIONS = [
  'manuscript',
  BUILTIN_CATEGORY_IDS.characters,
  BUILTIN_CATEGORY_IDS.locations,
  BUILTIN_CATEGORY_IDS.lore,
  BUILTIN_CATEGORY_IDS.notes
] as const

export function migrateExpandedSections(sections: Iterable<string>): Set<string> {
  const migrated = new Set<string>()
  for (const section of sections) {
    migrated.add(LEGACY_SECTION_TO_CATEGORY[section] ?? section)
  }
  return migrated
}

export function migrateSectionOrder(order: string[], categories: CategoryDefinition[]): string[] {
  const legacyMap: Record<string, string> = {
    characters: BUILTIN_CATEGORY_IDS.characters,
    locations: BUILTIN_CATEGORY_IDS.locations,
    lore: BUILTIN_CATEGORY_IDS.lore,
    notes: BUILTIN_CATEGORY_IDS.notes
  }
  return order
    .map((id) => legacyMap[id] ?? id)
    .filter((id) => categories.some((c) => c.id === id))
}

export function parseMetadata<T>(raw: string, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function serializeMetadata(meta: EntityMeta): string {
  return JSON.stringify(meta)
}
