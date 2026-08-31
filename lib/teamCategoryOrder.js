// Orden de categorías de más baja a más alta, y a qué grupo pertenece cada
// una (escolar / federado). Se compara por "incluye" para no romper con
// nombres de categoría heredados como "Femenino Senior".
export const SCHOOL_CATEGORIES = ['Premini', 'Mini', 'Infantil']
export const FEDERATED_CATEGORIES = ['Cadete', 'Junior', 'Senior']
export const CATEGORY_ORDER = [...SCHOOL_CATEGORIES, ...FEDERATED_CATEGORIES]

export function categoryRank(category) {
  const c = (category || '').toLowerCase()
  const idx = CATEGORY_ORDER.findIndex(cat => c.includes(cat.toLowerCase()))
  return idx === -1 ? CATEGORY_ORDER.length : idx
}

export function categoryGroup(category) {
  const c = (category || '').toLowerCase()
  return SCHOOL_CATEGORIES.some(cat => c.includes(cat.toLowerCase())) ? 'escolar' : 'federado'
}

export function sortTeamsByCategory(teams) {
  return [...teams].sort((a, b) => {
    const diff = categoryRank(a.category) - categoryRank(b.category)
    if (diff !== 0) return diff
    return (a.name || '').localeCompare(b.name || '')
  })
}
