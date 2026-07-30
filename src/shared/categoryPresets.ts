import type {
  CategoryDefinition,
  FolderScope,
  TreeNode
} from './types'
import {
  BUILTIN_CATEGORY_IDS,
  NF_PEOPLE_CATEGORY_ID,
  OPTIONAL_BESTIARY_CATEGORY_ID,
  PEOPLE_INTERVIEW_STATUS_OPTIONS
} from './categoryIds'

export type CategoryNodeKind = 'character' | 'location' | 'lore' | 'note' | 'entry'

/**
 * Preset ids are immutable once shipped — projects snapshot categories at create/add time.
 * Catalog changes affect new projects and newly added presets only; patch project copies via updateCategories.
 */
const FICTION_PRESET_IDS = [
  BUILTIN_CATEGORY_IDS.characters,
  BUILTIN_CATEGORY_IDS.locations,
  BUILTIN_CATEGORY_IDS.lore,
  BUILTIN_CATEGORY_IDS.notes
] as const

const CHARACTERS_PRESET: CategoryDefinition = {
  id: BUILTIN_CATEGORY_IDS.characters,
  name: 'Characters',
  icon: 'Users',
  mode: 'panel',
  sortOrder: 0,
  builtIn: true,
  panelBlocks: [
    { id: 'aliases', label: 'Aliases', type: 'tags' },
    { id: 'general', label: 'General', type: 'textarea', rows: 3 },
    { id: 'age', label: 'Age', type: 'text' },
    { id: 'race', label: 'Race', type: 'text' },
    { id: 'gender', label: 'Gender', type: 'text' },
    { id: 'professions', label: 'Profession', type: 'tags' },
    { id: 'physicalDescription', label: 'Physical Description', type: 'textarea', rows: 3 },
    { id: 'personality', label: 'Personality', type: 'textarea', rows: 3 },
    { id: 'background', label: 'Background', type: 'textarea', rows: 3 },
    { id: 'role', label: 'Role', type: 'text' },
    {
      id: 'relationships',
      label: 'Relationships',
      type: 'relationships',
      allowedCategoryIds: [BUILTIN_CATEGORY_IDS.characters]
    },
    { id: 'notes', label: 'Notes', type: 'textarea', rows: 4 }
  ]
}

const LOCATIONS_PRESET: CategoryDefinition = {
  id: BUILTIN_CATEGORY_IDS.locations,
  name: 'Locations',
  icon: 'MapPin',
  mode: 'panel',
  sortOrder: 1,
  builtIn: true,
  panelBlocks: [
    { id: 'locationType', label: 'Type', type: 'text' },
    { id: 'description', label: 'Description', type: 'textarea', rows: 4 },
    {
      id: 'connectedLocations',
      label: 'Connected Locations',
      type: 'relationships',
      allowedCategoryIds: [BUILTIN_CATEGORY_IDS.locations]
    },
    {
      id: 'notableCharacters',
      label: 'Notable Characters',
      type: 'relationships',
      allowedCategoryIds: [BUILTIN_CATEGORY_IDS.characters]
    },
    { id: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
  ]
}

const LORE_PRESET: CategoryDefinition = {
  id: BUILTIN_CATEGORY_IDS.lore,
  name: 'Lore',
  icon: 'Scroll',
  mode: 'panel',
  sortOrder: 2,
  builtIn: true,
  panelBlocks: [
    { id: 'category', label: 'Category', type: 'text' },
    { id: 'description', label: 'Description', type: 'textarea', rows: 4 },
    {
      id: 'relatedCharacters',
      label: 'Related Characters',
      type: 'relationships',
      allowedCategoryIds: [BUILTIN_CATEGORY_IDS.characters]
    },
    {
      id: 'relatedLocations',
      label: 'Related Locations',
      type: 'relationships',
      allowedCategoryIds: [BUILTIN_CATEGORY_IDS.locations]
    },
    { id: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
  ]
}

const NOTES_PRESET: CategoryDefinition = {
  id: BUILTIN_CATEGORY_IDS.notes,
  name: 'Notes',
  icon: 'StickyNote',
  mode: 'panel',
  sortOrder: 3,
  builtIn: true
}

const PEOPLE_PRESET: CategoryDefinition = {
  id: NF_PEOPLE_CATEGORY_ID,
  name: 'People',
  icon: 'UserCircle',
  mode: 'panel',
  sortOrder: 0,
  builtIn: false,
  panelBlocks: [
    { id: 'knownAs', label: 'Known As', type: 'text' },
    { id: 'ethnicity', label: 'Ethnicity', type: 'text' },
    { id: 'gender', label: 'Gender', type: 'text' },
    { id: 'age', label: 'Age', type: 'text' },
    { id: 'general', label: 'General', type: 'textarea', rows: 3 },
    { id: 'roleTitle', label: 'Role / Title', type: 'text' },
    { id: 'organization', label: 'Organization', type: 'text' },
    {
      id: 'interviewStatus',
      label: 'Interview Status',
      type: 'status',
      options: [...PEOPLE_INTERVIEW_STATUS_OPTIONS]
    },
    { id: 'keyQuotes', label: 'Key Quotes', type: 'textarea', rows: 4 },
    { id: 'relevance', label: 'Relevance', type: 'textarea', rows: 2 },
    {
      id: 'relationships',
      label: 'Relationships',
      type: 'relationships',
      allowedCategoryIds: [NF_PEOPLE_CATEGORY_ID]
    },
    { id: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
  ]
}

const SOURCES_PRESET: CategoryDefinition = {
  id: 'nf-sources',
  name: 'Sources',
  icon: 'BookOpen',
  mode: 'panel',
  sortOrder: 1,
  builtIn: false,
  panelBlocks: [
    { id: 'authors', label: 'Author(s)', type: 'text' },
    {
      id: 'sourceType',
      label: 'Type',
      type: 'status',
      options: ['Book', 'Article', 'Interview', 'Website', 'Podcast', 'Documentary', 'Other']
    },
    { id: 'publisher', label: 'Publisher / Publication', type: 'text' },
    { id: 'year', label: 'Year', type: 'text' },
    { id: 'url', label: 'URL', type: 'text' },
    { id: 'keyExcerpts', label: 'Key Excerpts', type: 'textarea', rows: 4 },
    { id: 'relevance', label: 'Relevance / How Cited', type: 'textarea', rows: 2 },
    { id: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
  ]
}

const CONCEPTS_PRESET: CategoryDefinition = {
  id: 'nf-concepts',
  name: 'Concepts',
  icon: 'Lightbulb',
  mode: 'panel',
  sortOrder: 2,
  builtIn: false,
  panelBlocks: [
    { id: 'definition', label: 'Definition', type: 'textarea', rows: 2 },
    {
      id: 'domain',
      label: 'Domain',
      type: 'text',
      placeholder: 'e.g. Economics, Psychology, History'
    },
    { id: 'keyThinkers', label: 'Key Thinkers / References', type: 'textarea', rows: 2 },
    {
      id: 'relatedConcepts',
      label: 'Related Concepts',
      type: 'relationships',
      allowedCategoryIds: ['nf-concepts']
    },
    { id: 'application', label: 'How It Applies', type: 'textarea', rows: 3 },
    { id: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
  ]
}

const BESTIARY_PRESET: CategoryDefinition = {
  id: OPTIONAL_BESTIARY_CATEGORY_ID,
  name: 'Bestiary',
  icon: 'PawPrint',
  mode: 'panel',
  sortOrder: 0,
  builtIn: false
}

const CATEGORY_PRESET_CATALOG: CategoryDefinition[] = [
  CHARACTERS_PRESET,
  LOCATIONS_PRESET,
  LORE_PRESET,
  NOTES_PRESET,
  PEOPLE_PRESET,
  SOURCES_PRESET,
  CONCEPTS_PRESET,
  BESTIARY_PRESET
]

const PRESET_BY_ID = new Map(CATEGORY_PRESET_CATALOG.map((p) => [p.id, p]))

function getCategoryPresetById(id: string): CategoryDefinition | undefined {
  return PRESET_BY_ID.get(id)
}

export function cloneCategoryPreset(preset: CategoryDefinition): CategoryDefinition {
  return {
    ...preset,
    panelBlocks: preset.panelBlocks?.map((block) => ({
      ...block,
      ...(block.type === 'status' ? { options: [...block.options] } : {}),
      ...(block.type === 'relationships' && block.allowedCategoryIds
        ? { allowedCategoryIds: [...block.allowedCategoryIds] }
        : {})
    }))
  }
}

export function resolveCategoriesFromPresetIds(presetIds: string[]): CategoryDefinition[] {
  return presetIds
    .map((id) => getCategoryPresetById(id))
    .filter((p): p is CategoryDefinition => !!p)
    .map((preset, index) => cloneCategoryPreset({ ...preset, sortOrder: index }))
}

function inferNodeKindFromCategoryId(id: string): CategoryNodeKind {
  switch (id) {
    case BUILTIN_CATEGORY_IDS.characters:
      return 'character'
    case BUILTIN_CATEGORY_IDS.locations:
      return 'location'
    case BUILTIN_CATEGORY_IDS.lore:
      return 'lore'
    case BUILTIN_CATEGORY_IDS.notes:
      return 'note'
    default:
      return 'entry'
  }
}

export function normalizeCategoryDefinition(cat: CategoryDefinition): CategoryDefinition {
  const nodeKind = inferNodeKindFromCategoryId(cat.id)
  return {
    ...cat,
    // Notes always open in the right panel; keep stored mode aligned with runtime.
    ...(cat.id === BUILTIN_CATEGORY_IDS.notes ? { mode: 'panel' as const } : {}),
    nodeKind
  }
}

export function nodeKindForCategory(cat: CategoryDefinition): CategoryNodeKind {
  return cat.nodeKind ?? inferNodeKindFromCategoryId(cat.id)
}

export function folderScopeForCategory(cat: CategoryDefinition): FolderScope {
  switch (nodeKindForCategory(cat)) {
    case 'character': return 'characters'
    case 'location':  return 'locations'
    case 'lore':      return 'lore'
    case 'note':      return 'notes'
    case 'entry':     return 'entry'
  }
}

export function getAddableCategoryPresets(current: CategoryDefinition[]): CategoryDefinition[] {
  const currentIds = new Set(current.map((c) => c.id))
  return CATEGORY_PRESET_CATALOG.filter((p) => !currentIds.has(p.id)).map(cloneCategoryPreset)
}

export function defaultFictionCategories(): CategoryDefinition[] {
  return resolveCategoriesFromPresetIds([...FICTION_PRESET_IDS]).map(normalizeCategoryDefinition)
}

export function countCategoryEntries(nodes: TreeNode[], category: CategoryDefinition): number {
  const kind = nodeKindForCategory(category)
  if (kind === 'entry') {
    return nodes.filter((n) => !n.deletedAt && n.type === 'entry' && n.categoryId === category.id)
      .length
  }
  return nodes.filter((n) => !n.deletedAt && n.type === kind).length
}
