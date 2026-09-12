// IndexedDB persistence: the project document plus one media record per recorded panel.

import type { Project } from './project'

const DB_NAME = 'live-looping'
const DB_VERSION = 1
const PROJECT_STORE = 'project'
const TAKES_STORE = 'takes'
// There is one project for now. Keying it leaves room for several without a schema change.
const PROJECT_KEY = 'current'

export interface StoredTake {
  readonly panelId: string
  /** Null when the camera was unavailable: an audio-only loop. */
  readonly video: Blob | null
  readonly sampleRate: number
  readonly channels: readonly Float32Array[]
}

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const completion = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'))
  })

function isStoredTake(value: unknown): value is StoredTake {
  const take = value as Partial<StoredTake> | null
  return (
    typeof take?.panelId === 'string' &&
    typeof take.sampleRate === 'number' &&
    Array.isArray(take.channels) &&
    take.channels.length > 0 &&
    take.channels.every((c) => c instanceof Float32Array) &&
    (take.video === null || take.video instanceof Blob)
  )
}

export const isQuotaError = (error: unknown): boolean => (error as { name?: string } | null)?.name === 'QuotaExceededError'

export class LooperStore {
  private db: Promise<IDBDatabase> | null = null
  private persistenceRequested = false

  loadProject(): Promise<unknown> {
    return this.read(PROJECT_STORE, (store) => store.get(PROJECT_KEY))
  }

  saveProject(project: Project): Promise<void> {
    return this.write(PROJECT_STORE, (store) => store.put(project, PROJECT_KEY))
  }

  async takeIds(): Promise<Set<string>> {
    const keys = await this.read(TAKES_STORE, (store) => store.getAllKeys())
    return new Set(keys.map(String))
  }

  async loadTake(panelId: string): Promise<StoredTake | null> {
    const value = await this.read(TAKES_STORE, (store) => store.get(panelId))
    return isStoredTake(value) ? value : null
  }

  async saveTake(take: StoredTake): Promise<void> {
    this.requestPersistence()
    await this.write(TAKES_STORE, (store) => store.put(take))
  }

  deleteTake(panelId: string): Promise<void> {
    return this.write(TAKES_STORE, (store) => store.delete(panelId))
  }

  clearTakes(): Promise<void> {
    return this.write(TAKES_STORE, (store) => store.clear())
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE)
        if (!db.objectStoreNames.contains(TAKES_STORE)) db.createObjectStore(TAKES_STORE, { keyPath: 'panelId' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return this.db
  }

  private async read<T>(storeName: string, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open()
    return request(op(db.transaction(storeName, 'readonly').objectStore(storeName)))
  }

  private async write(storeName: string, op: (store: IDBObjectStore) => IDBRequest): Promise<void> {
    const db = await this.open()
    const tx = db.transaction(storeName, 'readwrite')
    op(tx.objectStore(storeName))
    await completion(tx)
  }

  // Without this, the browser may evict recorded loops under storage pressure. It's asked
  // once, on the first save, since some browsers show a prompt.
  private requestPersistence(): void {
    if (this.persistenceRequested) return
    this.persistenceRequested = true
    void navigator.storage?.persist?.().catch(() => {})
  }
}
