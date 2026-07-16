const STORAGE_KEY = 'webui_snapshot_notes'

type NotesStore = Record<string, Record<string, string>>

function readStore(): NotesStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as NotesStore) : {}
  } catch {
    return {}
  }
}

function writeStore(store: NotesStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function loadSnapshotNotes(collectionName: string): Record<string, string> {
  return { ...readStore()[collectionName] }
}

export function setSnapshotNote(collectionName: string, snapshotName: string, note: string) {
  const trimmed = note.trim()
  const store = readStore()
  const collectionNotes = { ...store[collectionName] }

  if (trimmed) collectionNotes[snapshotName] = trimmed
  else delete collectionNotes[snapshotName]

  if (Object.keys(collectionNotes).length) store[collectionName] = collectionNotes
  else delete store[collectionName]

  writeStore(store)
}

export function removeSnapshotNote(collectionName: string, snapshotName: string) {
  setSnapshotNote(collectionName, snapshotName, '')
}
