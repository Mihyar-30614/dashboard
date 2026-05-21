const dirtyPages = new Set<string>();
const listeners = new Set<() => void>();

export function setPageDirty(id: string, isDirty: boolean) {
  const prev = dirtyPages.has(id);
  if (isDirty) dirtyPages.add(id);
  else dirtyPages.delete(id);
  if (prev !== isDirty) listeners.forEach((l) => l());
}

export function hasDirty(): boolean {
  return dirtyPages.size > 0;
}

export function getDirtyPages(): string[] {
  return Array.from(dirtyPages);
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
