// Search the editable name as well as the permanent URL slug. Keystatic's
// reader exposes slug-field names (including photo alt text) as strings.
export function matchesCollectionSearch(item, searchTerm, slugField) {
  const query = searchTerm.trim().normalize("NFKC").toLowerCase();
  if (!query) return true;
  return [item.name, item.data?.[slugField]].some(value =>
    typeof value === "string" && value.normalize("NFKC").toLowerCase().includes(query));
}
