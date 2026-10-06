export function quoteReviewValuesMatch(previousValue: unknown, nextValue: unknown): boolean {
  if (previousValue instanceof Date || nextValue instanceof Date) {
    return (previousValue ? new Date(previousValue as any).getTime() : null)
      === (nextValue ? new Date(nextValue as any).getTime() : null);
  }
  return JSON.stringify(previousValue ?? null) === JSON.stringify(nextValue ?? null);
}

export function associationDiff(currentIds: string[], requestedIds: string[]) {
  const requested = requestedIds.filter((id, index, all) => all.indexOf(id) === index);
  return {
    requested,
    removedIds: currentIds.filter(id => !requested.includes(id)),
    addedIds: requested.filter(id => !currentIds.includes(id)),
  };
}