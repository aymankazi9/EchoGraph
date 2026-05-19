// Browser-only. Import only from 'use client' components.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getMasterKey } from '@/lib/crypto/vault'
import { encryptText } from '@/lib/crypto/encrypt'
import { db } from '@/lib/db/dexie'

export type FileType = 'pdf' | 'audio' | 'guide'

export interface IngestionFile {
  data: ArrayBuffer
  name: string
  mimeType: string
  type: FileType
  sizeBytes: number
}

export type StepStatus = 'pending' | 'active' | 'done' | 'error'

export interface StepProgress {
  label: string
  status: StepStatus
  pct: number
}

export interface FileProgress {
  fileId: string
  name: string
  type: FileType
  steps: StepProgress[]
}

export type OnProgress = (progress: FileProgress[]) => void

// ─── Worker helpers ──────────────────────────────────────────────────────────

function transcodeAudio(
  data: ArrayBuffer,
  mimeType: string,
  onProgress: (pct: number) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./workers/ffmpeg.worker.ts', import.meta.url))

    worker.onmessage = (e) => {
      const msg = e.data as
        | { type: 'PROGRESS'; pct: number; stage: string }
        | { type: 'DONE'; opus: ArrayBuffer }
        | { type: 'ERROR'; message: string }

      if (msg.type === 'PROGRESS') onProgress(msg.stage === 'loading' ? 0 : msg.pct)
      else if (msg.type === 'DONE') { worker.terminate(); resolve(msg.opus) }
      else { worker.terminate(); reject(new Error(msg.message)) }
    }

    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message ?? 'FFmpeg worker error')) }
    worker.postMessage({ type: 'TRANSCODE', file: data, mimeType }, [data])
  })
}

function encryptData(
  data: ArrayBuffer,
  key: CryptoKey,
  onProgress: (pct: number) => void,
): Promise<{ bin: ArrayBuffer; baseIVB64: string }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./workers/encrypt.worker.ts', import.meta.url))

    worker.onmessage = (e) => {
      const msg = e.data as
        | { type: 'PROGRESS'; pct: number }
        | { type: 'DONE'; bin: ArrayBuffer; baseIVB64: string }
        | { type: 'ERROR'; message: string }

      if (msg.type === 'PROGRESS') onProgress(msg.pct)
      else if (msg.type === 'DONE') { worker.terminate(); resolve({ bin: msg.bin, baseIVB64: msg.baseIVB64 }) }
      else { worker.terminate(); reject(new Error(msg.message)) }
    }

    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message ?? 'Encrypt worker error')) }
    // Transfer data into the worker — avoids a copy
    worker.postMessage({ type: 'ENCRYPT', data, key }, [data])
  })
}

// Upload a .bin to Supabase Storage using a signed URL + XHR for real progress.
async function uploadBin(
  supabase: SupabaseClient,
  path: string,
  bin: ArrayBuffer,
  onProgress: (pct: number) => void,
): Promise<void> {
  const { data: signed, error } = await supabase.storage
    .from('echograph-files')
    .createSignedUploadUrl(path)

  if (error || !signed) throw new Error(error?.message ?? 'Failed to get upload URL')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signed.signedUrl, true)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.timeout = 10 * 60 * 1000 // 10 min

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve() }
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Upload network error'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.send(bin)
  })
}

// ─── Step updater ─────────────────────────────────────────────────────────────

function makeSteps(hasTranscode: boolean): StepProgress[] {
  const steps: StepProgress[] = []
  if (hasTranscode) steps.push({ label: 'Transcoding audio', status: 'pending', pct: 0 })
  steps.push({ label: 'Encrypting', status: 'pending', pct: 0 })
  steps.push({ label: 'Uploading', status: 'pending', pct: 0 })
  return steps
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function ingestFiles(
  supabase: SupabaseClient,
  files: IngestionFile[],
  userId: string,
  sessionId: string,
  onProgress: OnProgress,
): Promise<void> {
  const mk = getMasterKey()
  if (!mk) throw new Error('Vault is locked. Please unlock before ingesting files.')

  // Build initial progress state
  const progress: FileProgress[] = files.map((f) => ({
    fileId: crypto.randomUUID(),
    name: f.name,
    type: f.type,
    steps: makeSteps(f.type === 'audio'),
  }))
  onProgress([...progress])

  const update = () => onProgress(progress.map((p) => ({ ...p, steps: [...p.steps] })))

  const setStep = (
    fileIdx: number,
    stepIdx: number,
    patch: Partial<StepProgress>,
  ) => {
    Object.assign(progress[fileIdx].steps[stepIdx], patch)
    update()
  }

  // ── Session record ────────────────────────────────────────────────────────

  const titleBase = files.find((f) => f.type === 'pdf')?.name ?? files[0]?.name ?? 'Untitled'
  const titleEncrypted = await encryptText(mk, titleBase.replace(/\.[^.]+$/, ''))

  await supabase.from('sessions').insert({
    id: sessionId,
    user_id: userId,
    title_encrypted: titleEncrypted,
    status: 'ingesting',
    has_slides: files.some((f) => f.type === 'pdf'),
    has_audio: files.some((f) => f.type === 'audio'),
    has_study_guide: files.some((f) => f.type === 'guide'),
  })

  await db.localSessions.add({
    id: sessionId,
    userId,
    titleEncrypted,
    status: 'ingesting',
    hasSlides: files.some((f) => f.type === 'pdf'),
    hasAudio: files.some((f) => f.type === 'audio'),
    hasStudyGuide: files.some((f) => f.type === 'guide'),
    createdAt: Date.now(),
  })

  // ── Per-file pipeline ─────────────────────────────────────────────────────

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const fp = progress[i]
    const fileId = fp.fileId
    let stepOffset = 0
    let dataToEncrypt = file.data

    // Step A: transcode audio
    if (file.type === 'audio') {
      setStep(i, 0, { status: 'active', pct: 0 })
      try {
        dataToEncrypt = await transcodeAudio(file.data, file.mimeType, (pct) => {
          setStep(i, 0, { pct })
        })
        setStep(i, 0, { status: 'done', pct: 100 })
      } catch (err) {
        setStep(i, 0, { status: 'error' })
        throw err
      }
      stepOffset = 1
    }

    // Step B: encrypt
    const encStep = stepOffset
    setStep(i, encStep, { status: 'active', pct: 0 })
    let bin: ArrayBuffer
    let baseIVB64: string
    try {
      ;({ bin, baseIVB64 } = await encryptData(dataToEncrypt, mk, (pct) => {
        setStep(i, encStep, { pct })
      }))
      setStep(i, encStep, { status: 'done', pct: 100 })
    } catch (err) {
      setStep(i, encStep, { status: 'error' })
      throw err
    }

    // Encrypt filename — never store in plaintext
    const filenameEncrypted = await encryptText(mk, file.name)
    const storagePath = `${userId}/${sessionId}/${fileId}.bin`

    // Write-ahead buffer — persisted before upload begins
    await db.pendingUploads.add({
      id: fileId,
      sessionId,
      fileType: file.type,
      storagePath,
      sizeBytes: file.sizeBytes,
      mimeHint: file.mimeType.split('/')[0] ?? file.mimeType,
      ivB64: baseIVB64,
      filenameEncrypted,
      status: 'pending',
      binData: bin,
      createdAt: Date.now(),
    })

    // Step C: upload
    const uploadStep = stepOffset + 1
    setStep(i, uploadStep, { status: 'active', pct: 0 })
    try {
      await db.pendingUploads.update(fileId, { status: 'uploading' })
      await uploadBin(supabase, storagePath, bin, (pct) => {
        setStep(i, uploadStep, { pct })
      })
      setStep(i, uploadStep, { status: 'done', pct: 100 })
      await db.pendingUploads.update(fileId, { status: 'done', binData: undefined })
    } catch (err) {
      setStep(i, uploadStep, { status: 'error' })
      await db.pendingUploads.update(fileId, { status: 'error', errorMessage: String(err) })
      throw err
    }

    // Metadata row in Supabase
    await supabase.from('files').insert({
      id: fileId,
      session_id: sessionId,
      user_id: userId,
      file_type: file.type,
      storage_path: storagePath,
      size_bytes: file.sizeBytes,
      mime_hint: file.mimeType.split('/')[0] ?? file.mimeType,
      iv: baseIVB64,
      filename_encrypted: filenameEncrypted,
      uploaded_at: new Date().toISOString(),
    })
  }

  // ── Finalize ───────────────────────────────────────────────────────────────

  await supabase.from('sessions').update({ status: 'ready' }).eq('id', sessionId)
  await db.localSessions.update(sessionId, { status: 'ready' })
}

// ─── Add files to an existing session (no INSERT, only UPDATE) ────────────────

export async function addFilesToExistingSession(
  supabase: SupabaseClient,
  files: IngestionFile[],
  userId: string,
  sessionId: string,
  onProgress: OnProgress,
): Promise<void> {
  const mk = getMasterKey()
  if (!mk) throw new Error('Vault is locked. Please unlock before uploading files.')

  const progress: FileProgress[] = files.map((f) => ({
    fileId: crypto.randomUUID(),
    name: f.name,
    type: f.type,
    steps: makeSteps(f.type === 'audio'),
  }))
  onProgress([...progress])

  const update = () => onProgress(progress.map((p) => ({ ...p, steps: [...p.steps] })))

  const setStep = (fileIdx: number, stepIdx: number, patch: Partial<StepProgress>) => {
    Object.assign(progress[fileIdx].steps[stepIdx], patch)
    update()
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const fp = progress[i]
    const fileId = fp.fileId
    let stepOffset = 0
    let dataToEncrypt = file.data

    if (file.type === 'audio') {
      setStep(i, 0, { status: 'active', pct: 0 })
      try {
        dataToEncrypt = await transcodeAudio(file.data, file.mimeType, (pct) => {
          setStep(i, 0, { pct })
        })
        setStep(i, 0, { status: 'done', pct: 100 })
      } catch (err) {
        setStep(i, 0, { status: 'error' })
        throw err
      }
      stepOffset = 1
    }

    const encStep = stepOffset
    setStep(i, encStep, { status: 'active', pct: 0 })
    let bin: ArrayBuffer
    let baseIVB64: string
    try {
      ;({ bin, baseIVB64 } = await encryptData(dataToEncrypt, mk, (pct) => {
        setStep(i, encStep, { pct })
      }))
      setStep(i, encStep, { status: 'done', pct: 100 })
    } catch (err) {
      setStep(i, encStep, { status: 'error' })
      throw err
    }

    const filenameEncrypted = await encryptText(mk, file.name)
    const storagePath = `${userId}/${sessionId}/${fileId}.bin`

    await db.pendingUploads.add({
      id: fileId,
      sessionId,
      fileType: file.type,
      storagePath,
      sizeBytes: file.sizeBytes,
      mimeHint: file.mimeType.split('/')[0] ?? file.mimeType,
      ivB64: baseIVB64,
      filenameEncrypted,
      status: 'pending',
      binData: bin,
      createdAt: Date.now(),
    })

    const uploadStep = stepOffset + 1
    setStep(i, uploadStep, { status: 'active', pct: 0 })
    try {
      await db.pendingUploads.update(fileId, { status: 'uploading' })
      await uploadBin(supabase, storagePath, bin, (pct) => {
        setStep(i, uploadStep, { pct })
      })
      setStep(i, uploadStep, { status: 'done', pct: 100 })
      await db.pendingUploads.update(fileId, { status: 'done', binData: undefined })
    } catch (err) {
      setStep(i, uploadStep, { status: 'error' })
      await db.pendingUploads.update(fileId, { status: 'error', errorMessage: String(err) })
      throw err
    }

    await supabase.from('files').insert({
      id: fileId,
      session_id: sessionId,
      user_id: userId,
      file_type: file.type,
      storage_path: storagePath,
      size_bytes: file.sizeBytes,
      mime_hint: file.mimeType.split('/')[0] ?? file.mimeType,
      iv: baseIVB64,
      filename_encrypted: filenameEncrypted,
      uploaded_at: new Date().toISOString(),
    })
  }

  // Update session flags — only set to true, never overwrite an existing true with false
  const flagUpdate: Record<string, unknown> = { status: 'ingesting' }
  if (files.some((f) => f.type === 'pdf')) flagUpdate.has_slides = true
  if (files.some((f) => f.type === 'audio')) flagUpdate.has_audio = true
  if (files.some((f) => f.type === 'guide')) flagUpdate.has_study_guide = true
  await supabase.from('sessions').update(flagUpdate).eq('id', sessionId)
}
