const dirtyPages = new Set<string>();

export function setPageDirty(id: string, isDirty: boolean) {
  if (isDirty) dirtyPages.add(id);
  else dirtyPages.delete(id);
}

export function hasDirty(): boolean {
  return dirtyPages.size > 0;
}
