// Adapter contracts (DESIGN.md §7). Every external dependency — persistence,
// images, imports, tasks — sits behind one of these so it can be swapped without
// touching feature code.

export type Json = unknown

export interface StorageAdapter {
  /** Returns parsed JSON, or null when the path does not exist. */
  read(path: string): Promise<Json | null>
  write(path: string, data: Json): Promise<void>
  remove(path: string): Promise<void>
  /** Returns the immediate child names under a directory prefix. */
  list(prefix: string): Promise<string[]>
}

export interface ImageAdapter {
  upload(file: File | Blob): Promise<string> // returns an ImgRef (URL)
}

export interface ImportAdapter {
  fetch(siteUrl: string): Promise<Json>
}

export interface TaskAdapter {
  create(task: { title: string; body?: string }): Promise<{ url: string; id?: string }>
}
