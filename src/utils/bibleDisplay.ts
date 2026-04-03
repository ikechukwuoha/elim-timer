import type { BibleBackground } from '@/types'

export const DEFAULT_BIBLE_BACKGROUND_ID = 'bible-bg-black'
export const DEFAULT_BIBLE_TEXT_COLOR = '#ffffff'
export const DEFAULT_BIBLE_FONT_FAMILY_ID = 'cinzel'
export const DEFAULT_BIBLE_FONT_SCALE = 100
export const MIN_BIBLE_FONT_SCALE = 85
export const MAX_BIBLE_FONT_SCALE = 150

export const DEFAULT_BIBLE_BACKGROUNDS: BibleBackground[] = [
  { id: DEFAULT_BIBLE_BACKGROUND_ID, name: 'Black', kind: 'solid', value: '#000000', builtIn: true },
  { id: 'bible-bg-white', name: 'White', kind: 'solid', value: '#ffffff', builtIn: true },
  { id: 'bible-bg-red', name: 'Red', kind: 'solid', value: '#7f1d1d', builtIn: true },
]

export const BIBLE_TEXT_COLOR_OPTIONS = [
  { id: 'white', label: 'White', value: '#ffffff' },
  { id: 'black', label: 'Black', value: '#000000' },
  { id: 'red', label: 'Red', value: '#dc2626' },
  { id: 'gold', label: 'Gold', value: '#fbbf24' },
]

export const BIBLE_FONT_OPTIONS = [
  { id: DEFAULT_BIBLE_FONT_FAMILY_ID, label: 'Cinzel', family: 'var(--font-cinzel), serif' },
  { id: 'times-new-roman', label: 'Times New Roman', family: '"Times New Roman", Times, serif' },
  { id: 'calibri', label: 'Calibri', family: 'Calibri, "Segoe UI", Arial, sans-serif' },
  { id: 'cambria', label: 'Cambria', family: 'Cambria, Georgia, serif' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif' },
  { id: 'garamond', label: 'Garamond', family: 'Garamond, "Times New Roman", serif' },
  { id: 'palatino', label: 'Palatino', family: '"Palatino Linotype", Palatino, serif' },
  { id: 'trebuchet', label: 'Trebuchet MS', family: '"Trebuchet MS", Verdana, sans-serif' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
  { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
]

export function mergeBibleBackgrounds(backgrounds: BibleBackground[] = []): BibleBackground[] {
  const defaultIds = new Set(DEFAULT_BIBLE_BACKGROUNDS.map(background => background.id))
  const customBackgrounds = backgrounds.filter(background => (
    background &&
    typeof background.id === 'string' &&
    typeof background.name === 'string' &&
    (background.kind === 'solid' || background.kind === 'image') &&
    typeof background.value === 'string' &&
    !defaultIds.has(background.id)
  ))

  return [...DEFAULT_BIBLE_BACKGROUNDS, ...customBackgrounds]
}

export function resolveBibleBackground(backgrounds: BibleBackground[] | undefined, activeId: string | null | undefined): BibleBackground {
  const merged = mergeBibleBackgrounds(backgrounds ?? [])
  const selected = merged.find(background => background.id === activeId)
  if (selected && (selected.kind === 'solid' || selected.value)) return selected
  return merged[0]
}

export function toSlimBibleBackground(background: BibleBackground): BibleBackground {
  if (background.kind === 'solid' || background.builtIn) return background
  return { ...background, value: '' }
}

export function resolveBibleFontFamily(fontFamilyId: string | null | undefined): string {
  return BIBLE_FONT_OPTIONS.find(option => option.id === fontFamilyId)?.family
    ?? BIBLE_FONT_OPTIONS[0].family
}

export function normalizeBibleFontFamilyId(fontFamilyId: string | null | undefined): string {
  return BIBLE_FONT_OPTIONS.some(option => option.id === fontFamilyId)
    ? (fontFamilyId as string)
    : DEFAULT_BIBLE_FONT_FAMILY_ID
}

export function clampBibleFontScale(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_BIBLE_FONT_SCALE
  return Math.min(MAX_BIBLE_FONT_SCALE, Math.max(MIN_BIBLE_FONT_SCALE, Math.round(value)))
}
