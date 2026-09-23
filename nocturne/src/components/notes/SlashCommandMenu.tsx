'use client'

// Slash command dropdown rendered by ReactRenderer (not mounted in the normal React tree).
//
// Normal mode: arrow-key navigation over a filtered list of commands.
// Picker mode: entered when "Insert slide reference" is selected; shows a
//   number-input inline so the user types the slide index then presses Enter.
//   All keystrokes in picker mode are intercepted (return true) so nothing
//   leaks into the editor while the picker is open.
//
// The ref exposes onKeyDown so the suggestion plugin can forward key events.

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from 'react'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'

// ─── Command definition ───────────────────────────────────────────────────────

export interface SlashCommand {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  keywords: string[]
  /** Called after the trigger "/" text has been deleted from the editor. */
  action: (editor: SuggestionProps<SlashCommand>['editor']) => void
  /** If true, activating this item enters picker mode instead of running action immediately. */
  opensPicker?: boolean
}

export function getSlashCommands(getSlidesCount: () => number): SlashCommand[] {
  return [
    {
      id: 'slide-ref',
      title: 'Slide reference',
      description: 'Cite a slide — links back to the Lecture tab',
      icon: <SlashIcon d="M3 3h12v4H3zM3 9h8M8 13l4-4 4 4" />,
      keywords: ['slide', 'cite', 'reference', 'lecture'],
      opensPicker: true,
      action: () => {
        // Action is a no-op — picker mode handles the actual insert.
        // If totalSlides is 0, this falls back to inserting [[slide:
        if (getSlidesCount() === 0) {
          // No slides available — handled by picker mode showing a message
        }
      },
    },
    {
      id: 'heading-1',
      title: 'Heading 1',
      description: 'Large section header',
      icon: <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1, color: '#A5B4FC' }}>H1</span>,
      keywords: ['heading', 'h1', 'title', 'large', '#'],
      action: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
      id: 'heading-2',
      title: 'Heading 2',
      description: 'Subsection header',
      icon: <span style={{ fontWeight: 700, fontSize: 12, lineHeight: 1, color: '#A5B4FC' }}>H2</span>,
      keywords: ['heading', 'h2', 'subtitle', '##'],
      action: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
      id: 'heading-3',
      title: 'Heading 3',
      description: 'Minor heading',
      icon: <span style={{ fontWeight: 700, fontSize: 11, lineHeight: 1, color: '#7C8398' }}>H3</span>,
      keywords: ['heading', 'h3', '###'],
      action: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
    },
    {
      id: 'bullet-list',
      title: 'Bullet list',
      description: 'Unordered list',
      icon: <SlashIcon d="M4 6h12M4 10h12M4 14h12" prefix={<circle cx="2" cy="6" r="1" fill="currentColor" />} />,
      keywords: ['bullet', 'list', 'unordered', '-', '*'],
      action: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'ordered-list',
      title: 'Numbered list',
      description: 'Ordered list',
      icon: <span style={{ fontWeight: 600, fontSize: 11, lineHeight: 1, color: '#7C8398', fontFamily: 'monospace' }}>1.</span>,
      keywords: ['numbered', 'ordered', 'list', '1.'],
      action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
  ]
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SlashIcon({ d, prefix }: { d: string; prefix?: React.ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#7C8398' }}>
      {prefix}
      <path d={d} />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export type SlashMenuRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

type MenuProps = SuggestionProps<SlashCommand> & {
  getSlidesCount: () => number
}

export const SlashCommandMenu = forwardRef<SlashMenuRef, MenuProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pickerMode, setPickerMode] = useState(false)
  const [pickerInput, setPickerInput] = useState('')

  // Always-current refs so the imperative onKeyDown never has stale closure values.
  const onKeyDownImpl = useRef<(p: SuggestionKeyDownProps) => boolean>(() => false)

  // Reset selection when filtered items change.
  useEffect(() => {
    setSelectedIndex(0)
    setPickerMode(false)
    setPickerInput('')
  }, [props.items])

  // ── Picker confirm ─────────────────────────────────────────────────────────

  const confirmPicker = (editor: MenuProps['editor'], range: MenuProps['range'], raw: string) => {
    const n = parseInt(raw, 10)
    const total = props.getSlidesCount()
    if (!Number.isFinite(n) || n < 1 || (total > 0 && n > total)) return
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent({ type: 'slideRef', attrs: { slideIndex: n } })
      .run()
    // The deleteRange removes the trigger text → suggestion plugin auto-dismisses.
  }

  // ── Build the key handler on every render (captures latest state) ──────────

  onKeyDownImpl.current = ({ event }: SuggestionKeyDownProps): boolean => {
    const { editor, range, items } = props

    // ── Picker mode ────────────────────────────────────────────────────────
    if (pickerMode) {
      if (event.key === 'Enter') {
        confirmPicker(editor, range, pickerInput)
        return true
      }
      if (event.key === 'Backspace') {
        setPickerInput((s) => s.slice(0, -1))
        return true
      }
      if (/^\d$/.test(event.key)) {
        setPickerInput((s) => s + event.key)
        return true
      }
      // Block all other keys while picker is open (Escape is handled by plugin, exits entire menu)
      return true
    }

    // ── Normal command list mode ───────────────────────────────────────────
    if (event.key === 'ArrowUp') {
      setSelectedIndex((i) => (i - 1 + items.length) % items.length)
      return true
    }
    if (event.key === 'ArrowDown') {
      setSelectedIndex((i) => (i + 1) % items.length)
      return true
    }
    if (event.key === 'Enter') {
      const item = items[selectedIndex]
      if (!item) return false
      if (item.opensPicker) {
        // Enter picker mode — don't call command(), stay in the menu
        setPickerMode(true)
        setPickerInput('')
        return true
      }
      // Normal command: delete trigger text and run action
      editor.chain().focus().deleteRange(range).run()
      item.action(editor)
      return true
    }
    return false
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: (p: SuggestionKeyDownProps) => onKeyDownImpl.current(p),
  }))

  // ── Render ─────────────────────────────────────────────────────────────────

  const { items, editor, range } = props
  const total = props.getSlidesCount()

  const containerStyle: React.CSSProperties = {
    background: '#0D0D14',
    border: '1px solid #1E1E2E',
    borderRadius: 10,
    boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
    overflow: 'hidden',
    width: 280,
    fontFamily: 'inherit',
  }

  if (pickerMode) {
    const n = parseInt(pickerInput, 10)
    const valid = pickerInput.length > 0 && Number.isFinite(n) && n >= 1 && (total === 0 || n <= total)
    const hint = total > 0 ? `1 – ${total}` : 'any number'

    return (
      <div style={containerStyle}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #12121A' }}>
          <div style={{ fontSize: 11, color: '#3F485C', marginBottom: 6, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Slide number
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', borderRadius: 6, border: `1px solid ${valid ? '#3730A3' : pickerInput.length > 0 ? '#7F1D1D' : '#1E1E2E'}`, background: '#07070F', transition: 'border-color 0.15s' }}>
            <span style={{ color: '#818CF8', fontSize: 13 }}>↗</span>
            <span style={{ fontSize: 13, color: pickerInput.length > 0 ? '#E2E8F0' : '#3F485C', minWidth: 28 }}>
              {pickerInput.length > 0 ? pickerInput : hint}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#3F485C' }}>
            {total > 0 ? `${total} slide${total > 1 ? 's' : ''} available` : 'No slides loaded yet — number saved anyway'}
          </div>
        </div>
        <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#2D2B45' }}>esc to cancel</span>
          <button
            type="button"
            disabled={!valid}
            onMouseDown={(e) => {
              e.preventDefault()
              if (valid) confirmPicker(editor, range, pickerInput)
            }}
            style={{ height: 26, padding: '0 12px', borderRadius: 5, border: 'none', background: valid ? '#6366F1' : '#1E1E2E', color: valid ? '#fff' : '#3F485C', fontSize: 12, fontWeight: 500, cursor: valid ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s' }}
          >
            Insert ↵
          </button>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ ...containerStyle, padding: '10px 14px', fontSize: 12, color: '#3F485C' }}>
        No commands match
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                if (item.opensPicker) {
                  setPickerMode(true)
                  setPickerInput('')
                  return
                }
                editor.chain().focus().deleteRange(range).run()
                item.action(editor)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '7px 12px',
                background: i === selectedIndex ? 'rgba(99,102,241,0.12)' : 'transparent',
                border: 'none',
                borderLeft: `2px solid ${i === selectedIndex ? '#6366F1' : 'transparent'}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid #1E1E2E' }}>
                {item.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500, lineHeight: 1.3 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: '#3F485C', lineHeight: 1.4 }}>{item.description}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <div style={{ borderTop: '1px solid #12121A', padding: '5px 12px', display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 10.5, color: '#2D2B45' }}>↑↓ navigate</span>
        <span style={{ fontSize: 10.5, color: '#2D2B45' }}>↵ select</span>
        <span style={{ fontSize: 10.5, color: '#2D2B45' }}>esc dismiss</span>
      </div>
    </div>
  )
})

SlashCommandMenu.displayName = 'SlashCommandMenu'
