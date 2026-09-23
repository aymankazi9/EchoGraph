'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { getMasterKey } from '@/lib/crypto/vault'
import { encryptText } from '@/lib/crypto/encrypt'
import { decryptText } from '@/lib/crypto/decrypt'
import { createClient } from '@/lib/supabase'
import { useSessionStore } from '@/store/session-store'
import Highlight from '@tiptap/extension-highlight'
import { SlideRefExtension } from './extensions/slide-ref'
import { KeywordHighlightExtension } from './extensions/keyword-highlight'
import { SlashCommandExtension } from './extensions/slash-command'
import { NotesVersionHistory } from './NotesVersionHistory'
import { NotesToolbar, NotesBubbleMenu } from './NotesToolbar'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  sessionId: string
  userId: string
  /** Switch to Lecture tab and seek to the given global_slide_index. */
  onGoToSlide: (slideIndex: number) => void
  /**
   * Called with the current decrypted plain-text whenever the note content
   * changes (load, user edit, AI generation). Used by the parent's search bar
   * so no additional decryption is needed — the text is already in memory.
   */
  onContentChange?: (plainText: string) => void
  /** Total slide count from the session PDF — used by the slash "/" slide picker. */
  totalSlides?: number
}

const STATUS_COLOR: Record<SaveStatus, string> = {
  idle:   '#3F485C',
  saving: '#5B6478',
  saved:  '#6EE7B7',
  error:  '#FDA4AF',
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle:   '',
  saving: 'Saving…',
  saved:  'Saved',
  error:  'Save failed — will retry',
}

/** Minimum wall-clock gap between auto-snapshots while the user is actively editing. */
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function NotesEditor({ sessionId, userId, onGoToSlide, onContentChange, totalSlides = 0 }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading]           = useState(true)
  const [status, setStatus]             = useState<SaveStatus>('idle')
  const [generating, setGenerating]     = useState(false)
  const [editorEmpty, setEditorEmpty]   = useState(true)
  const [showHistory, setShowHistory]   = useState(false)

  const noteIdRef          = useRef<string | null>(null)
  const debounceRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Snapshot throttle: tracks when the last snapshot was written and whether
  // content has changed since then.  Initialized to now so the first snapshot
  // doesn't fire until 5 minutes of active editing have elapsed.
  const lastSnapshotAtRef  = useRef<number>(Date.now())
  const contentDirtyRef    = useRef(false)

  // ── Persist to session_notes ───────────────────────────────────────────────
  const save = useCallback(async (text: string) => {
    if (text === '' && !noteIdRef.current) return

    const mk = getMasterKey()
    if (!mk) return

    setStatus('saving')
    try {
      const encrypted = await encryptText(mk, text)
      const now = new Date().toISOString()

      if (noteIdRef.current) {
        const { error } = await supabase
          .from('session_notes')
          .update({ content_encrypted: encrypted, updated_at: now })
          .eq('id', noteIdRef.current)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('session_notes')
          .insert({ session_id: sessionId, user_id: userId, content_encrypted: encrypted, updated_at: now })
          .select('id')
          .single()
        if (error) throw error
        noteIdRef.current = (data as { id: string }).id
      }

      setStatus('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
    }
  }, [sessionId, userId, supabase])

  // ── Write a version snapshot ───────────────────────────────────────────────
  // Snapshot failures are intentionally non-fatal — they never block the user.
  const writeSnapshot = useCallback(async (markdown: string, kind: 'auto' | 'generate') => {
    const mk = getMasterKey()
    if (!mk || !markdown.trim()) return
    try {
      const encrypted = await encryptText(mk, markdown)
      await supabase
        .from('session_notes_versions')
        .insert({ session_id: sessionId, user_id: userId, content_encrypted: encrypted, kind })
    } catch {
      // Silently swallow — version history is best-effort
    }
  }, [sessionId, userId, supabase])

  // Keep refs so closures captured at editor creation always call the latest version.
  const saveRef          = useRef(save)
  const writeSnapshotRef = useRef(writeSnapshot)
  useEffect(() => { saveRef.current = save },                  [save])
  useEffect(() => { writeSnapshotRef.current = writeSnapshot }, [writeSnapshot])

  const onGoToSlideRef = useRef(onGoToSlide)
  useEffect(() => { onGoToSlideRef.current = onGoToSlide }, [onGoToSlide])

  const onContentChangeRef = useRef(onContentChange)
  useEffect(() => { onContentChangeRef.current = onContentChange }, [onContentChange])

  // Stable getter — the SlashCommandExtension closure captures this once at
  // editor init and calls through it on every invocation, so it always reads
  // the current totalSlides without the editor being recreated.
  const totalSlidesRef = useRef(totalSlides)
  useEffect(() => { totalSlidesRef.current = totalSlides }, [totalSlides])

  // ── Editor ────────────────────────────────────────────────────────────────
  // StarterKit includes input rules for: #/##/### → headings, **text** → bold,
  // -/* at line start → bullet list, 1. → ordered list, and more.
  // Markdown extension adds markdown serialisation (getMarkdown()) and parses
  // markdown strings passed to setContent(), so AI-generated notes with
  // **bold** / ## headings render formatted immediately, not as raw syntax.
  const editor = useEditor({
    // This component only ever renders on the client (auth-gated workspace route).
    // Without this flag Tiptap v3 detects Next.js and defaults immediatelyRender
    // to false, making useEditor return null on the first render — which causes
    // the load useEffect to hit `if (!editor) return` and never call setLoading(false).
    immediatelyRender: true,
    extensions: [
      // StarterKit v3 bundles Link and Underline — configure them here rather
      // than passing the standalone extensions separately, which would cause
      // Tiptap's "Duplicate extension names" warning for both marks.
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
        // underline: default config is fine; listed explicitly so the intent
        // is clear and someone doesn't re-add the standalone import later.
        underline: {},
      }),
      // Highlight mark — multicolor:true enables per-mark color attributes.
      // Round-trip: serialised as <mark data-color="…" style="background-color:…">
      // via HTMLMark fallback; markdown-it passes <mark> through verbatim (html:true);
      // DOMParser restores the mark via parseHTML:[{tag:"mark"}] and reads data-color.
      Highlight.configure({ multicolor: true }),
      Markdown.configure({
        // html: true lets tiptap-markdown's HTMLMark fallback serialise marks
        // that have no native markdown syntax (currently: Underline → <u>text</u>,
        // Link is already handled by tiptap-markdown's own Link spec).
        // markdown-it passes <u>…</u> through verbatim, then ProseMirror's
        // DOMParser maps it back to the Underline mark via parseHTML: [{ tag: "u" }].
        // Backward-compatible: existing notes stored without any HTML parse identically.
        html: true,
        tightLists: true,
        transformPastedText: true,  // parse pasted markdown
        transformCopiedText: true,  // copy back as markdown
      }),
      // Slide citation chips: [[slide:N]] → clickable pill → Lecture tab seek.
      // Stable closure via ref so the extension option never changes reference.
      SlideRefExtension.configure({
        onGoToSlide: (n) => onGoToSlideRef.current(n),
      }),
      // Red/Likely Zone keyword highlighting — same matching as transcript pane.
      KeywordHighlightExtension,
      // "/" slash command palette.
      SlashCommandExtension.configure({
        getSlidesCount: () => totalSlidesRef.current,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'notes-tiptap',
        spellcheck: 'true',
      },
    },
    onUpdate({ editor: ed }) {
      setEditorEmpty(ed.isEmpty)
      setStatus('idle')
      onContentChangeRef.current?.(ed.getText())
      contentDirtyRef.current = true

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const markdownStorage = ed.storage as unknown as { markdown: { getMarkdown(): string } }
        const markdown = markdownStorage.markdown.getMarkdown()

        // 1. Autosave every 1.5 s of idle
        void saveRef.current(markdown)

        // 2. Auto-snapshot at most once per SNAPSHOT_INTERVAL_MS of active editing
        if (contentDirtyRef.current) {
          const now = Date.now()
          if (now - lastSnapshotAtRef.current >= SNAPSHOT_INTERVAL_MS) {
            contentDirtyRef.current = false
            lastSnapshotAtRef.current = now
            void writeSnapshotRef.current(markdown, 'auto')
          }
        }
      }, 1500)
    },
  })

  // ── Load existing note on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!editor) return

    const mk = getMasterKey()
    if (!mk) { setLoading(false); return }

    void (async () => {
      const { data } = await supabase
        .from('session_notes')
        .select('id, content_encrypted')
        .eq('session_id', sessionId)
        .maybeSingle()

      if (data) {
        noteIdRef.current = data.id as string
        try {
          const plain = await decryptText(mk, data.content_encrypted as string)
          // Pass false so setContent doesn't fire onUpdate (avoids a pointless
          // re-save of content we just loaded from the DB).
          editor.commands.setContent(plain, { emitUpdate: false })
          setEditorEmpty(editor.isEmpty)
          onContentChangeRef.current?.(editor.getText())
        } catch {
          // Corrupt or empty note — start fresh
        }
      }
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]) // editor ref is stable after creation

  // ── Generate notes from lecture content ──────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!editor) return
    const mk = getMasterKey()
    if (!mk) return

    setGenerating(true)
    try {
      const { data: slideRows } = await supabase
        .from('slides')
        .select('global_slide_index, text_encrypted')
        .eq('session_id', sessionId)
        .order('global_slide_index')

      const slides = await Promise.all(
        (slideRows ?? []).map(async (s) => ({
          pageNumber: s.global_slide_index as number,
          text: s.text_encrypted
            ? await decryptText(mk, s.text_encrypted as string).catch(() => '')
            : '',
        })),
      )

      const { transcriptWords, keywords } = useSessionStore.getState()
      const transcriptText = transcriptWords.map((w) => w.word).join(' ')

      const resp = await fetch('/api/generate/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          slides,
          transcriptText,
          keywords: keywords.map((k) => ({ term: k.term, zone: k.zone })),
        }),
      })

      if (!resp.ok) throw new Error('Generation failed')

      const { notes } = await resp.json() as { notes: string }
      if (notes) {
        // Don't emit onUpdate — we're saving and snapshotting directly below.
        editor.commands.setContent(notes, { emitUpdate: false })
        setEditorEmpty(editor.isEmpty)
        onContentChangeRef.current?.(editor.getText())

        // Save to session_notes, then write a 'generate' snapshot.
        // Reset the auto-snapshot timer so the next auto-snapshot starts fresh.
        await saveRef.current(notes)
        lastSnapshotAtRef.current = Date.now()
        contentDirtyRef.current = false
        void writeSnapshotRef.current(notes, 'generate')
      }
    } catch {
      // silently ignore — user can retry
    } finally {
      setGenerating(false)
    }
  }, [editor, sessionId, supabase])

  // ── Restore from version history ──────────────────────────────────────────
  const handleRestore = useCallback(async (markdown: string) => {
    if (!editor) return

    // Take a snapshot of the current content before overwriting so the user
    // can always return to the state they were in just before the restore.
    const markdownStorage = editor.storage as unknown as { markdown: { getMarkdown(): string } }
    const current = markdownStorage.markdown.getMarkdown()
    if (current.trim()) {
      await writeSnapshotRef.current(current, 'auto')
    }

    // Apply the restored content
    editor.commands.setContent(markdown, { emitUpdate: false })
    setEditorEmpty(editor.isEmpty)
    onContentChangeRef.current?.(editor.getText())

    // Persist to session_notes
    await saveRef.current(markdown)

    // Reset snapshot throttle
    lastSnapshotAtRef.current = Date.now()
    contentDirtyRef.current = false

    setShowHistory(false)
  }, [editor])

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────
  const showGenerateButton = !loading && editorEmpty && !generating

  return (
    <>
      {/* Scoped styles for the rich-text surface */}
      <style>{`
        .notes-tiptap {
          outline: none;
          flex: 1;
          min-height: 0;
          font-size: 14.5px;
          line-height: 1.8;
          color: #CBD5E1;
          caret-color: #818CF8;
          font-family: inherit;
          width: 100%;
        }
        .notes-tiptap h1 { font-size: 1.45em; font-weight: 700; color: #E2E8F0; margin: 0.9em 0 0.35em; letter-spacing: -0.01em; }
        .notes-tiptap h2 { font-size: 1.2em;  font-weight: 600; color: #E2E8F0; margin: 0.8em 0 0.3em; }
        .notes-tiptap h3 { font-size: 1.05em; font-weight: 600; color: #CBD5E1; margin: 0.7em 0 0.25em; }
        .notes-tiptap h1:first-child,
        .notes-tiptap h2:first-child,
        .notes-tiptap h3:first-child { margin-top: 0; }
        .notes-tiptap p  { margin: 0.35em 0; }
        .notes-tiptap p:first-child { margin-top: 0; }
        .notes-tiptap strong { font-weight: 600; color: #E2E8F0; }
        .notes-tiptap em   { font-style: italic; color: #94A3B8; }
        .notes-tiptap code {
          font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
          font-size: 0.875em;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.2);
          color: #A5B4FC;
          padding: 0.1em 0.35em;
          border-radius: 4px;
        }
        .notes-tiptap pre {
          background: rgba(0,0,0,0.3);
          border: 1px solid #1E1E2E;
          border-radius: 6px;
          padding: 0.9em 1.1em;
          margin: 0.6em 0;
          overflow-x: auto;
        }
        .notes-tiptap pre code {
          background: none;
          border: none;
          padding: 0;
          color: #94A3B8;
          font-size: 0.85em;
        }
        /* list-style must be set explicitly: Tailwind v4 preflight resets
           ul/ol/menu { list-style: none } globally, so without this override
           the markers are invisible even though indentation still works. */
        .notes-tiptap ul  { list-style: disc;    padding-left: 1.5em; margin: 0.35em 0; }
        .notes-tiptap ol  { list-style: decimal; padding-left: 1.5em; margin: 0.35em 0; }
        .notes-tiptap li  { margin: 0.15em 0; }
        .notes-tiptap li p { margin: 0; }
        .notes-tiptap blockquote {
          border-left: 3px solid #23222F;
          padding-left: 1em;
          margin: 0.5em 0;
          color: #5B6478;
        }
        .notes-tiptap hr {
          border: none;
          border-top: 1px solid #1E1E2E;
          margin: 1em 0;
        }
        /* Force dark text on all highlight colors so swatches remain readable against
           the editor's dark background. !important beats the extension's inline
           style="color:inherit" which would otherwise leave light text on light bg. */
        .notes-tiptap mark { border-radius: 2px; padding: 0 1px; color: #09090F !important; }
        .notes-tiptap u   { text-decoration: underline; text-underline-offset: 2px; }
        .notes-tiptap s, .notes-tiptap del { text-decoration: line-through; color: #5B6478; }
        .notes-tiptap a {
          color: #818CF8;
          text-decoration: underline;
          text-decoration-color: rgba(99,102,241,0.4);
          text-underline-offset: 2px;
          cursor: pointer;
        }
        .notes-tiptap a:hover { color: #A5B4FC; text-decoration-color: rgba(99,102,241,0.8); }

        /* ── Keyword highlights — mirrors WordSpan's Red/Likely Zone classes ── */
        .notes-kw-red {
          color: rgb(253 164 175);
          background: rgba(136, 19, 55, 0.2);
          text-decoration: underline;
          text-decoration-color: rgba(136, 19, 55, 0.8);
          border-radius: 2px;
          cursor: default;
        }
        .notes-kw-likely {
          color: rgb(196 181 253);
          background: rgba(76, 29, 149, 0.15);
          border-radius: 2px;
          cursor: default;
        }
      `}</style>

      {/* position: relative so the history overlay can use position: absolute */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, maxWidth: 720, width: '100%', margin: '0 auto' }}>

        {/* Version history overlay */}
        {showHistory && (
          <NotesVersionHistory
            sessionId={sessionId}
            onRestore={handleRestore}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* Bubble menu — rendered via a portal at document.body so fixed
            positioning is unaffected by ancestor overflow or transforms */}
        <NotesBubbleMenu editor={editor} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', margin: 0, letterSpacing: '-0.01em' }}>Notes</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!loading && !generating && (
              <button
                onClick={() => setShowHistory(true)}
                title="Version history"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3F485C', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Open version history"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 6v4l3 3" />
                </svg>
              </button>
            )}
            {!editorEmpty && !generating && (
              <button
                onClick={handleGenerate}
                style={{ fontSize: 12, color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.8 }}
              >
                Regenerate
              </button>
            )}
            <span style={{ fontSize: 12, color: STATUS_COLOR[status], transition: 'color 0.2s' }}>
              {generating ? 'Generating…' : STATUS_LABEL[status]}
            </span>
          </div>
        </div>

        {/* Fixed toolbar — hidden during loading/generating so it doesn't appear
            over spinners, but always present once the editor is ready */}
        {!loading && !generating && <NotesToolbar editor={editor} />}

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3F485C', fontSize: 13 }}>
            Loading…
          </div>
        ) : generating ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#5B6478' }}>
            <div style={{ width: 24, height: 24, border: '2px solid #6366F1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Generating notes from your lecture…</span>
          </div>
        ) : showGenerateButton ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <button
              onClick={handleGenerate}
              style={{ height: 40, padding: '0 20px', borderRadius: 8, fontSize: 14, fontWeight: 500, background: '#6366F1', color: '#09090F', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              ✦ Generate notes from lecture
            </button>
            <p style={{ fontSize: 12, color: '#3F485C', margin: 0 }}>
              Or start writing below — notes are encrypted and auto-saved.
            </p>
            {/* Editor is mounted but visually hidden behind the generate prompt */}
            <div style={{ position: 'relative', width: '100%', minHeight: 160 }}>
              <EditorContent
                editor={editor}
                style={{ flex: 1, minHeight: 160, width: '100%' }}
              />
              {/* Placeholder shown while editor is empty */}
              <div
                aria-hidden="true"
                style={{ position: 'absolute', top: 0, left: 0, color: '#3F485C', fontSize: 14.5, lineHeight: 1.8, pointerEvents: 'none', userSelect: 'none' }}
              >
                Start writing…
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 2px 0 0' }}>
            <EditorContent editor={editor} style={{ width: '100%' }} />
          </div>
        )}
      </div>
    </>
  )
}
