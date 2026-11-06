import { describe, expect, it } from 'vitest'
import { resolveCategoriesFromPresetIds } from './categoryPresets'
import {
  BUILTIN_CATEGORY_IDS,
  DEFAULT_BESTIARY_META,
  DEFAULT_CHARACTER_META,
  DEFAULT_LOCATION_META,
  DEFAULT_LORE_META,
  DEFAULT_PEOPLE_META,
  NF_PEOPLE_CATEGORY_ID,
  OPTIONAL_BESTIARY_CATEGORY_ID
} from './types'
import type { CategoryDefinition } from './types'

/**
 * A field's id is the key its value is stored under. A preset that names a key
 * the panel never writes reads back empty, and one that omits a key the panel
 * does write hides whatever is in it. Both have happened:
 *   - Locations said 'locationType' while the data sat under 'type'
 *   - Characters had no entry for startsAs or endsAs at all
 * These lists are unread today and become the source of truth the moment a
 * built-in category is drawn from its field list, so pin them here.
 */

const IMAGE_KEYS = ['imagePath', 'secondaryImagePaths', 'imageFocus']

function preset(id: string): CategoryDefinition {
  const found = resolveCategoriesFromPresetIds([id])[0]
  if (!found) throw new Error(`No preset for ${id}`)
  return found
}

/** Ids that carry a value — headings store nothing, images use the three fixed keys. */
function valueBlockIds(category: CategoryDefinition): string[] {
  return (category.panelBlocks ?? [])
    .filter((b) => b.type !== 'heading' && b.type !== 'images')
    .map((b) => b.id)
}

const CASES: { name: string; id: string; meta: object }[] = [
  { name: 'Characters', id: BUILTIN_CATEGORY_IDS.characters, meta: DEFAULT_CHARACTER_META },
  { name: 'Locations', id: BUILTIN_CATEGORY_IDS.locations, meta: DEFAULT_LOCATION_META },
  { name: 'Lore', id: BUILTIN_CATEGORY_IDS.lore, meta: DEFAULT_LORE_META },
  { name: 'People', id: NF_PEOPLE_CATEGORY_ID, meta: DEFAULT_PEOPLE_META },
  { name: 'Bestiary', id: OPTIONAL_BESTIARY_CATEGORY_ID, meta: DEFAULT_BESTIARY_META }
]

describe('built-in presets describe what their panels store', () => {
  for (const { name, id, meta } of CASES) {
    it(`${name}: every field id is a key the panel writes`, () => {
      const unknownIds = valueBlockIds(preset(id)).filter((blockId) => !(blockId in meta))
      expect(unknownIds).toEqual([])
    })

    it(`${name}: every stored key has a field`, () => {
      const ids = new Set(valueBlockIds(preset(id)))
      const missing = Object.keys(meta).filter(
        (key) => !IMAGE_KEYS.includes(key) && !ids.has(key)
      )
      expect(missing).toEqual([])
    })

    it(`${name}: offers a cover`, () => {
      const hasImages = (preset(id).panelBlocks ?? []).some((b) => b.type === 'images')
      expect(hasImages).toBe(true)
    })
  }

  it('no two fields in a category share an id', () => {
    for (const { name, id } of CASES) {
      const ids = valueBlockIds(preset(id))
      expect(new Set(ids).size, `${name} has a duplicate field id`).toBe(ids.length)
    }
  })
})
