// ─── Beta Guide Content ────────────────────────────────────────────────────────
// ALL editable content lives in SECTIONS below.
// To add, remove, or reword anything: edit that array only — no render code needs to change.
// The render component at the bottom is generic and shouldn't need touching.

import React from 'react'

// ─── Content types ────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'callout'; text: string }

interface Section {
  id: string
  title: string | null       // null = no section header (intro block)
  content: ContentBlock[]
  dimmed?: boolean           // true for "not yet available" sections
}

// ─── Editable content ─────────────────────────────────────────────────────────

const FEEDBACK_EMAIL = 'trynocturneai@gmail.com'

const SECTIONS: Section[] = [
  {
    id: 'intro',
    title: null,
    content: [
      {
        type: 'p',
        text:
          "You're in closed beta. Everything listed below is live and available to you — " +
          'all beta testers have full access to every tier\'s features (Dusk, Midnight, and Eclipse) for the duration of the beta. ' +
          'If you see an upgrade prompt or a locked feature anywhere in the app, it\'s a display artifact, not a real limitation on your access.',
      },
      {
        type: 'p',
        text:
          `Feedback at this stage is genuinely useful. Email ${FEEDBACK_EMAIL} with anything: ` +
          'bugs, unexpected behavior, friction you hit, or things that didn\'t work the way you expected. ' +
          'You don\'t need to file a formal report — a plain description of what happened is enough.',
      },
    ],
  },
  {
    id: 'lecture',
    title: 'Lecture tab',
    content: [
      {
        type: 'p',
        text:
          'The Lecture tab is the main content view. Upload slides (PDF) and/or a recording (audio file) ' +
          'to a session and Nocturne analyzes them together. After you run scoring, the right panel shows ' +
          'two zones of keywords:',
      },
      {
        type: 'ul',
        items: [
          'Red Zone — high-confidence exam material. Either explicitly listed in your study guide, or terms the professor demonstrably dwelled on: repeated mentions, long slide time, vocal emphasis.',
          'Likely Zone — terms statistically significant in the lecture but not independently corroborated by a guide. Worth knowing, lower priority than Red Zone.',
        ],
      },
      {
        type: 'p',
        text:
          'If you have both slides and audio, you can run the sync engine to align each slide to the timestamp ' +
          'in the recording where it was discussed. Once synced, clicking a keyword in the right panel ' +
          'highlights it in the transcript and jumps the PDF to the relevant slide.',
      },
      {
        type: 'callout',
        text:
          'Scoring requires at least slides or audio — a session with neither will not produce keywords. ' +
          'You can add a study guide (PDF, plain text, or Anki .apkg) before scoring to improve zone accuracy.',
      },
    ],
  },
  {
    id: 'study',
    title: 'Study tab',
    content: [
      {
        type: 'p',
        text:
          'Flashcards are generated automatically from Red Zone and Likely Zone keywords after scoring. ' +
          'Each card tracks your review history across sessions using a spaced-repetition schedule — the queue ' +
          're-orders each study session based on how recently you reviewed each card and how you rated it ' +
          '(Again / Hard / Good / Easy).',
      },
      {
        type: 'p',
        text:
          'The mastery indicator on each card reflects interval: new cards start at 0%, reach roughly 50% after ' +
          'a few successful reviews, and approach 100% once the interval exceeds three weeks. ' +
          'Cards you repeatedly mark Again stay in Red Zone; cards you consistently rate Good or Easy move toward mastered.',
      },
      {
        type: 'p',
        text: 'Exam Urgency Mode is available in two ways:',
      },
      {
        type: 'ul',
        items: [
          'Auto-activates when your course\'s exam date is within 48 hours (set a date in the course tag on the session).',
          'Manually toggleable via the "Cram mode" button in the Study tab header, regardless of exam date.',
        ],
      },
      {
        type: 'p',
        text:
          'In urgency mode: only Red Zone cards are shown, the flip animation is removed for faster Q→rate cycling, ' +
          'and a countdown timer shows time remaining until the exam.',
      },
    ],
  },
  {
    id: 'notes',
    title: 'Notes tab',
    content: [
      {
        type: 'p',
        text:
          'The Notes tab is a WYSIWYG rich-text editor (bold, italic, lists, headings, links). ' +
          'Notes are encrypted and stored per session.',
      },
      {
        type: 'p',
        text:
          '"Generate Notes" produces a structured AI summary of the session content — slides, transcript, and any ' +
          'guide text you\'ve uploaded. Key terms in the generated notes are linked back to their corresponding flashcards.',
      },
      {
        type: 'p',
        text:
          'After generation, a "Fact Check" pass is available: it reviews each factual claim in the notes against ' +
          'your slides and transcript, and highlights anything that isn\'t directly corroborated by your own lecture content. ' +
          'Flagged claims show the specific passage they were checked against.',
      },
    ],
  },
  {
    id: 'ask',
    title: 'Ask tab',
    content: [
      {
        type: 'p',
        text:
          'The Ask tab lets you ask questions grounded in your session content — slides, transcript, and any study guide you\'ve uploaded. ' +
          'Answers cite specific slides and transcript timestamps where the relevant content appears, ' +
          'so you can trace every claim back to the source.',
      },
      {
        type: 'p',
        text:
          'Vault Ask (in the main sidebar) works the same way across your entire vault — ' +
          'useful for cross-topic questions or exam review that spans several lectures from the same course, ' +
          'or across multiple courses.',
      },
      {
        type: 'callout',
        text:
          'Ask is grounded in your own content only — it does not use external knowledge. ' +
          'If something isn\'t in your slides or transcript, Ask will say so rather than invent an answer.',
      },
    ],
  },
  {
    id: 'momentum',
    title: 'Momentum',
    content: [
      {
        type: 'p',
        text:
          'Momentum tracks study activity and mastery across all your sessions. ' +
          'The dashboard shows your current streak, reviews per day, and mastery progress broken down by course.',
      },
      {
        type: 'p',
        text:
          'The Weak Spots section lists Red Zone concepts across all courses ranked by urgency — ' +
          'a combination of low mastery and a close exam date. Each row links directly into the relevant session\'s Study tab, ' +
          'filtered to that term.',
      },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    dimmed: true,
    content: [
      {
        type: 'p',
        text:
          'Community features are in development and not enabled for beta yet. ' +
          'Deck sharing, collaborative study, and course-level leaderboards will be added in a later beta cycle.',
      },
    ],
  },
  {
    id: 'access',
    title: 'Your beta access',
    content: [
      {
        type: 'callout',
        text:
          'All beta testers have full Eclipse-tier access for the duration of the beta. ' +
          'This includes everything normally gated behind Midnight and Eclipse: AI-enhanced flashcard explanations, ' +
          'the quiz panel, the Ask tab, Vault Ask, unlimited recording length, and extended storage. ' +
          'If you see an "Upgrade" button anywhere, it\'s a display artifact — your access is unrestricted.',
      },
    ],
  },
]

// ─── Render ───────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  marginBottom: 20,
  padding: '20px 22px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.025)',
}

const dimmedSectionStyle: React.CSSProperties = {
  ...sectionStyle,
  opacity: 0.5,
}

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
}

const sectionTitleTextStyle: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: '#E2E8F0',
}

const accentBarStyle: React.CSSProperties = {
  width: 3,
  height: 14,
  borderRadius: 2,
  background: 'rgba(245,158,11,0.7)',
  flexShrink: 0,
}

const paragraphStyle: React.CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.65,
  color: '#8892A4',
  margin: '0 0 10px',
}

const listStyle: React.CSSProperties = {
  margin: '0 0 10px',
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const listItemStyle: React.CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.6,
  color: '#8892A4',
}

const calloutStyle: React.CSSProperties = {
  padding: '10px 13px',
  borderRadius: 7,
  background: 'rgba(245,158,11,0.06)',
  border: '1px solid rgba(245,158,11,0.15)',
  fontSize: 13,
  lineHeight: 1.6,
  color: '#A78B50',
  margin: '4px 0 0',
}

const comingSoonBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: '#5B6478',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 4,
  padding: '2px 6px',
  lineHeight: 1,
}

function renderBlock(block: ContentBlock, i: number): React.ReactNode {
  switch (block.type) {
    case 'p':
      return (
        <p key={i} style={{ ...paragraphStyle, ...(i === 0 ? { marginTop: 0 } : {}) }}>
          {block.text}
        </p>
      )
    case 'ul':
      return (
        <ul key={i} style={listStyle}>
          {block.items.map((item, j) => (
            <li key={j} style={listItemStyle}>{item}</li>
          ))}
        </ul>
      )
    case 'callout':
      return (
        <div key={i} style={calloutStyle}>
          {block.text}
        </div>
      )
  }
}

export function BetaGuideContent() {
  return (
    <div style={{ maxWidth: 680 }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: '#E2E8F0',
            margin: 0,
          }}>
            Beta Guide
          </h1>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#F59E0B',
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.22)',
            borderRadius: 4,
            padding: '3px 6px',
            lineHeight: 1,
          }}>
            closed beta
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: '#5B6478', margin: 0, lineHeight: 1.5 }}>
          What&rsquo;s available, how it works, and where to send feedback.
        </p>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SECTIONS.map((section) => (
          <div key={section.id} style={section.dimmed ? dimmedSectionStyle : sectionStyle}>

            {/* Section title */}
            {section.title && (
              <div style={sectionTitleStyle}>
                <div style={accentBarStyle} />
                <span style={sectionTitleTextStyle}>{section.title}</span>
                {section.dimmed && (
                  <span style={comingSoonBadgeStyle}>coming soon</span>
                )}
              </div>
            )}

            {/* Content blocks */}
            <div>
              {section.content.map((block, i) => renderBlock(block, i))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 24,
        paddingTop: 16,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{ fontSize: 12.5, color: '#5B6478' }}>
          This page updates as features change during beta.
        </span>
        <a
          href={`mailto:${FEEDBACK_EMAIL}`}
          style={{
            fontSize: 12.5,
            color: '#F59E0B',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {FEEDBACK_EMAIL} →
        </a>
      </div>
    </div>
  )
}
