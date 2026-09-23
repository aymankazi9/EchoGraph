// Slash command extension for the notes Tiptap editor.
// Triggered by typing "/" — renders a command palette via @tiptap/suggestion.
//
// The `getSlidesCount` option is a getter function (not a value) so that the
// closure captures a stable reference that always returns the current count,
// even though the ProseMirror plugin is created once at editor initialisation.
//
// Future addition: "Turn selection into flashcard" fits naturally here once the
// flashcard-write path is accessible from the Notes tab context. It would share
// the same Extension.create shell — just add a new SlashCommand entry whose
// action reads editor.state.selection, extracts the text, and calls the
// existing flashcard upsert logic. Scoped separately because it touches DB
// writes and the keyword/flashcard store, unlike the structural commands here.

import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { Suggestion } from '@tiptap/suggestion'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { SlashCommandMenu, getSlashCommands } from '../SlashCommandMenu'
import type { SlashCommand, SlashMenuRef } from '../SlashCommandMenu'

export interface SlashCommandOptions {
  /**
   * Getter function — not a value — so the plugin closure always reads the
   * current slide count without the editor needing to be recreated.
   */
  getSlidesCount: () => number
}

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return { getSlidesCount: () => 0 }
  },

  addProseMirrorPlugins() {
    // Capture getSlidesCount at plugin-creation time.
    // It's a function reference, so it always calls through to the current value.
    const { getSlidesCount } = this.options

    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,

        // Filter the command list by what the user has typed after "/"
        items: ({ query }) =>
          getSlashCommands(getSlidesCount).filter(
            (cmd) =>
              query === '' ||
              cmd.title.toLowerCase().includes(query.toLowerCase()) ||
              cmd.keywords.some((k) => k.includes(query.toLowerCase())),
          ),

        // Called when an item is selected via the component's onKeyDown handler
        // (mouse clicks bypass this — they run action/picker directly via onMouseDown).
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run()
          props.action(editor)
        },

        render: () => {
          let component: ReactRenderer<SlashMenuRef, SuggestionProps<SlashCommand> & { getSlidesCount: () => number }> | null = null
          let unmount: (() => void) | null = null

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props: { ...props, getSlidesCount },
                editor: props.editor,
              })
              unmount = props.mount(component.element)
            },

            onUpdate: (props) => {
              component?.updateProps({ ...props, getSlidesCount })
            },

            onExit: () => {
              unmount?.()
              component?.destroy()
              component = null
              unmount = null
            },

            onKeyDown: (props: SuggestionKeyDownProps) =>
              component?.ref?.onKeyDown(props) ?? false,
          }
        },
      }),
    ]
  },
})
