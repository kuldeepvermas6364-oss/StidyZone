import type { PlatformModule } from '../types/platform';

export interface SearchableModuleItem {
  module: PlatformModule;
  labelEn: string;
  labelHi: string;
  keywords: string[];
}

export function filterModulesByQuery(
  items: SearchableModuleItem[],
  rawQuery: string
): SearchableModuleItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return items.slice(0, 6);
  }

  return items.filter((item) => {
    if (item.labelEn.toLowerCase().includes(query)) return true;
    if (item.labelHi.toLowerCase().includes(query)) return true;
    if (item.module.path.toLowerCase().includes(query)) return true;
    return item.keywords.some((kw) => kw.toLowerCase().includes(query));
  });
}
