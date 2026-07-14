export type BlockText = { k: 'text'; text: string }
export type BlockSub = { k: 'sub'; text: string }
export type BlockList = { k: 'list'; items: string[] }
export type BlockCalloutI = { k: 'callout-i'; text: string }
export type BlockCalloutR = { k: 'callout-r'; text: string }
export type BlockKeys = { k: 'keys'; lines: { text: string; note?: string; arrow?: boolean }[] }
export type BlockCompare = { k: 'compare'; canTitle: string; can: string[]; cannotTitle: string; cannot: string[] }
export type Block = BlockText | BlockSub | BlockList | BlockCalloutI | BlockCalloutR | BlockKeys | BlockCompare

export type Section = { h: string; blocks: Block[] }
export type Doc = { id: string; label: string; tag: string; subtitle: string; sections: Section[] }

const T = (text: string): BlockText => ({ k: 'text', text })
const S = (text: string): BlockSub => ({ k: 'sub', text })
const L = (...items: string[]): BlockList => ({ k: 'list', items })
const CI = (text: string): BlockCalloutI => ({ k: 'callout-i', text })
const CR = (text: string): BlockCalloutR => ({ k: 'callout-r', text })
const KEYS = (lines: { text: string; note?: string; arrow?: boolean }[]): BlockKeys => ({ k: 'keys', lines })
const CMP = (canTitle: string, can: string[], cannotTitle: string, cannot: string[]): BlockCompare => ({ k: 'compare', canTitle, can, cannotTitle, cannot })

export const LEGAL_DOCS: Doc[] = [
  {
    id: 'privacy',
    label: 'Privacy Policy',
    tag: 'Privacy Policy',
    subtitle: "How Nocturne collects, uses, and protects your information — and the categories of data we've engineered ourselves to be unable to read.",
    sections: [
      { h: 'Overview', blocks: [
        T(`Nocturne Labs, Inc. ("Nocturne", "we", "us") builds privacy-first study intelligence for students. This Privacy Policy explains what we collect, how we use it, and — just as importantly — the categories of data we have deliberately engineered ourselves to be unable to read.`),
        T(`Nocturne is built on a zero-knowledge architecture. Your uploaded lectures, slides, transcripts, and study guides are encrypted on your device before they ever reach our servers. We store the resulting ciphertext, never the contents.`),
      ]},
      { h: 'Information we collect', blocks: [
        S(`Account information`),
        T(`When you create a vault we collect your email address, your authentication provider identifier (for example, your Google account ID if you sign in with Google), and an optional display name. This is the minimum required to authenticate you and associate your encrypted data with your account.`),
        S(`Encrypted content`),
        T(`Lecture audio, slide decks, transcripts, study guides, and the keyword rankings derived from them are encrypted client-side with AES-GCM 256 and uploaded as opaque .bin blobs. We can see that a blob exists and its size — never what it contains.`),
        S(`Technical and usage data`),
        T(`We collect limited information needed to operate and secure the service:`),
        L(`Device and browser type, operating system, and approximate region derived from IP`, `Aggregate, non-identifying feature usage — for example, how many sessions were created, without their contents`, `Error and crash diagnostics, scrubbed of any vault content`),
      ]},
      { h: 'What we can never access', blocks: [
        T(`The following are structurally inaccessible to Nocturne. This is not a policy we could quietly reverse — it is enforced by the cryptography itself:`),
        L(`Your vault passphrase — it never leaves your device, not even in hashed form`, `Your Master Key, which is created as a non-extractable key and cannot be exported`, `The decrypted contents of any lecture, slide, transcript, or study guide`, `Your Recovery Kit, which only ever exists on devices where you choose to save it`),
        CI(`Because of this design, no Nocturne employee, contractor, or automated process can read your study content. See our Security disclosure for the full technical model.`),
      ]},
      { h: 'How we use information', blocks: [
        T(`We use the limited information we can access only to:`),
        L(`Authenticate you and maintain your session`, `Store and sync your encrypted blobs across your devices`, `Operate, secure, debug, and improve the service`, `Send essential service notices, and — only if you opt in — product updates`, `Comply with legal obligations and enforce our Terms of Service`),
      ]},
      { h: 'Local-first processing', blocks: [
        T(`On the Free tier, speech-to-text (Whisper) and keyword modeling (BERT) run entirely in your browser via WebAssembly. Your lecture audio and transcript text are processed locally and are never transmitted to our servers or any third party for that processing.`),
      ]},
      { h: 'Third parties and subprocessors', blocks: [
        T(`We rely on a small set of vetted subprocessors. They process only the limited data described below, and never your decrypted content:`),
        L(`Supabase — authentication, database, and encrypted blob storage`, `Google — OAuth sign-in, if you choose it`, `YouTube Data API — only when you explicitly connect a video, to match Red Zone keywords against captions over HTTPS`, `Stripe — payment processing for paid plans; we never receive your full card number`, `Vercel — application hosting and content delivery`),
      ]},
      { h: 'Cookies', blocks: [
        T(`We use a minimal set of strictly necessary cookies for authentication and vault state. We do not use advertising or cross-site tracking cookies. See our Cookie Policy for specifics.`),
      ]},
      { h: 'Data retention', blocks: [
        T(`We retain your account record and encrypted blobs for as long as your account is active. When you delete a session, its blobs are removed from storage. When you delete your account, your encrypted content is permanently deleted and your authentication record is removed within 30 days, subject to any legal retention obligations.`),
      ]},
      { h: 'Your rights', blocks: [
        T(`Depending on your location, you may have the right to access, correct, export, or delete your personal information, and to object to or restrict certain processing. Because your content is encrypted under a key only you hold, you already hold the strongest possible form of access control over it.`),
        T(`To exercise any right, contact privacy@nocturne.app. We will respond within the timeframe required by applicable law, including the GDPR and CCPA.`),
      ]},
      { h: 'International transfers', blocks: [
        T(`Nocturne is operated from the United States. Where we transfer data internationally, we rely on appropriate safeguards such as Standard Contractual Clauses. Because your content is encrypted in transit and at rest, its confidentiality does not depend on the jurisdiction in which a blob happens to be stored.`),
      ]},
      { h: "Children's privacy", blocks: [
        T(`Nocturne is intended for users aged 16 and older. We do not knowingly collect personal information from children under 16. If you believe a child has provided us information, contact us and we will delete it.`),
      ]},
      { h: 'Changes to this policy', blocks: [
        T(`We may update this Privacy Policy as the product evolves. Material changes will be announced in-app or by email before they take effect. The "Last updated" date above always reflects the current version.`),
      ]},
      { h: 'Contact', blocks: [
        T(`Questions about this policy or your data can be sent to privacy@nocturne.app.`),
      ]},
    ],
  },

  {
    id: 'terms',
    label: 'Terms of Service',
    tag: 'Terms of Service',
    subtitle: `The agreement that governs your use of Nocturne, including your responsibilities as the sole holder of your vault key.`,
    sections: [
      { h: 'Acceptance of these Terms', blocks: [
        T(`These Terms of Service ("Terms") are a binding agreement between you and Nocturne Labs, Inc. By creating a vault or using Nocturne, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the service.`),
      ]},
      { h: 'Eligibility', blocks: [
        T(`You must be at least 16 years old to use Nocturne. If you use Nocturne in connection with an educational institution, you are responsible for ensuring your use complies with that institution's policies. Nocturne is offered in stages, including private beta features that may be limited or change.`),
      ]},
      { h: 'Your account', blocks: [
        T(`You are responsible for the information you provide at sign-up and for all activity under your account. Keep your authentication credentials secure and notify us promptly of any unauthorized use.`),
      ]},
      { h: 'Your vault and encryption', blocks: [
        T(`Nocturne encrypts your content under a key derived from a vault passphrase that only you know. This gives you complete control — and complete responsibility — over access to your data.`),
        CR(`No password reset exists. There is no backdoor. If you lose both your passphrase and your Recovery Kit, your encrypted content is permanently and irreversibly inaccessible — to you and to us. You agree that Nocturne is not liable for content lost in this way.`),
        T(`You are responsible for storing your Recovery Kit somewhere safe. We strongly recommend saving it the moment your vault is created.`),
      ]},
      { h: 'Acceptable use', blocks: [
        T(`You agree not to:`),
        L(`Use Nocturne for any unlawful purpose or in violation of applicable law`, `Upload content you do not have the right to use, or that infringes others' rights`, `Attempt to breach, probe, or circumvent the security or access controls of the service`, `Reverse engineer, resell, or build a competing service from Nocturne, except as permitted by law`, `Interfere with or disrupt the integrity or performance of the service`),
      ]},
      { h: 'Your content', blocks: [
        T(`You retain all ownership of the content you upload. You grant Nocturne only the limited, revocable license necessary to store your encrypted blobs and provide the service to you. Because we cannot decrypt your content, we make no other use of it. We claim no rights to your content and will never sell it.`),
      ]},
      { h: 'Academic integrity', blocks: [
        T(`Nocturne is a study aid that highlights likely-important material. It does not guarantee exam outcomes and is not a substitute for studying, attending class, or following your instructor's guidance. You are solely responsible for complying with your institution's academic integrity policies.`),
      ]},
      { h: 'Subscriptions and billing', blocks: [
        T(`Nocturne offers a Free tier and paid plans. Paid subscriptions are billed in advance on a recurring basis through our payment processor and renew automatically until cancelled.`),
        L(`You can cancel at any time; cancellation takes effect at the end of the current billing period`, `Fees are non-refundable except where required by law`, `We may change pricing with reasonable advance notice; changes apply to the next billing period`),
      ]},
      { h: 'Beta features', blocks: [
        T(`Some features are offered on a beta basis and are provided "as is" without warranty. Beta features may change, break, or be removed at any time, and may carry usage limits.`),
      ]},
      { h: 'Disclaimers', blocks: [
        T(`To the maximum extent permitted by law, Nocturne is provided "as is" and "as available" without warranties of any kind, express or implied, including fitness for a particular purpose and non-infringement. We do not warrant that the service will be uninterrupted or error-free, or that keyword rankings will be accurate or complete.`),
      ]},
      { h: 'Limitation of liability', blocks: [
        T(`To the maximum extent permitted by law, Nocturne and its affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost data, lost profits, or content rendered inaccessible due to a lost passphrase or Recovery Kit. Our total liability for any claim relating to the service will not exceed the greater of the amount you paid us in the twelve months before the claim or USD $100.`),
      ]},
      { h: 'Termination', blocks: [
        T(`You may stop using Nocturne and delete your account at any time. We may suspend or terminate access if you breach these Terms or use the service in a way that risks harm to others or to the service. On termination, your encrypted content is deleted as described in our Privacy Policy.`),
      ]},
      { h: 'Governing law', blocks: [
        T(`These Terms are governed by the laws of the State of California, without regard to its conflict-of-laws rules. Any dispute will be resolved in the state or federal courts located in California, and you consent to their jurisdiction.`),
      ]},
      { h: 'Changes to these Terms', blocks: [
        T(`We may update these Terms as the service evolves. We will provide notice of material changes before they take effect. Continued use after changes take effect constitutes acceptance.`),
      ]},
      { h: 'Contact', blocks: [
        T(`Questions about these Terms can be sent to legal@nocturne.app.`),
      ]},
    ],
  },

  {
    id: 'cookies',
    label: 'Cookie Policy',
    tag: 'Cookie Policy',
    subtitle: `The minimal set of cookies and local storage Nocturne relies on — and the tracking we deliberately don't do.`,
    sections: [
      { h: 'Overview', blocks: [
        T(`This Cookie Policy explains how Nocturne uses cookies and similar local storage technologies. We take the same minimalist approach here as everywhere else: we use only what is required to sign you in and keep your vault working.`),
      ]},
      { h: 'Strictly necessary cookies', blocks: [
        T(`These cookies are essential and cannot be switched off without breaking core functionality:`),
        L(`nocturne-vault-warm — a short-lived flag (about one hour, SameSite=Strict) indicating your vault has been unlocked this session, so the app doesn't lock you out mid-task`, `Supabase authentication cookies — secure tokens that keep you signed in and authorize requests to your encrypted blobs`),
        T(`None of these cookies contain your passphrase, your keys, or any decrypted content.`),
      ]},
      { h: "What we don't use", blocks: [
        T(`We do not use advertising cookies, cross-site tracking pixels, or third-party analytics that profile you across the web. We do not sell or share cookie data with advertisers.`),
      ]},
      { h: 'Local storage and IndexedDB', blocks: [
        T(`Most of Nocturne's state lives on your device, not in cookies. We use browser local storage and IndexedDB to hold vault metadata, wrapped (encrypted) key material, and cached on-device models. This data stays on your device and is never transmitted in readable form.`),
      ]},
      { h: 'Managing cookies', blocks: [
        T(`You can clear or block cookies through your browser settings. Note that clearing Nocturne's cookies or local storage will sign you out and lock your vault — you will need your passphrase to unlock it again. Blocking strictly necessary cookies will prevent the app from functioning.`),
      ]},
      { h: 'Changes to this policy', blocks: [
        T(`We will update this policy if our use of cookies changes. The "Last updated" date above reflects the current version.`),
      ]},
      { h: 'Contact', blocks: [
        T(`Questions about cookies can be sent to privacy@nocturne.app.`),
      ]},
    ],
  },

  {
    id: 'security',
    label: 'Security',
    tag: 'Security Disclosure',
    subtitle: `A concrete, technical account of Nocturne's zero-knowledge architecture — what protects your data, and what we can and cannot see.`,
    sections: [
      { h: 'Our security model', blocks: [
        T(`Nocturne's privacy guarantees are structural, not promotional. The service is designed so that the server stores data it cannot read. This page documents how that works in concrete terms.`),
        T(`Your vault passphrase derives the key that wraps your Master Key. That passphrase never leaves your browser, and the Master Key is created so that it can never be exported.`),
      ]},
      { h: 'Key hierarchy', blocks: [
        KEYS([
          { text: `Passphrase`, note: `your memory only` },
          { text: `↓ PBKDF2 · 310,000 iterations · SHA-256`, arrow: true },
          { text: `KEK`, note: `memory only, discarded after unwrap` },
          { text: `↓ AES-KW unwrap`, arrow: true },
          { text: `Master Key`, note: `non-extractable CryptoKey` },
          { text: `↓ AES-GCM 256 · unique IV per file`, arrow: true },
          { text: `Encrypted .bin blob`, note: `stored in Supabase` },
        ]),
      ]},
      { h: 'Encryption specifics', blocks: [
        L(`Key derivation — PBKDF2 with 310,000 iterations and SHA-256, run in a Web Worker so it never blocks or touches the main thread`, `Master Key — an AES-GCM 256 key created with extractable: false, so the browser will not let it be exported by us or anyone`, `File encryption — AES-GCM 256 with a unique initialization vector per file`, `Key wrapping — your Master Key is wrapped with a Key-Encryption Key using AES-KW and unwrapped only in memory`),
      ]},
      { h: 'On-device processing', blocks: [
        T(`On the Free tier, Whisper (speech-to-text) and BERT (keyword modeling) run locally in your browser via WebAssembly. Lecture audio and transcript text are never uploaded for this processing.`),
      ]},
      { h: 'Infrastructure and access controls', blocks: [
        L(`Row-Level Security is enforced on every database table and storage bucket, so a row is only ever reachable by its owner`, `Encryption in transit (TLS) and at rest across all infrastructure`, `Least-privilege access for our small team, with no path to decrypt user content`, `Encrypted blobs are stored as opaque files with no readable metadata about their contents`),
      ]},
      { h: 'What we can and cannot see', blocks: [
        CMP(`Nocturne can see`, [`That an account exists, and its email`, `That an encrypted blob exists, and its size`, `Aggregate, non-identifying usage counts`], `Nocturne can never see`, [`Your passphrase or Recovery Kit`, `Your Master Key`, `The decrypted contents of anything you upload`]),
      ]},
      { h: 'No backdoor', blocks: [
        CR(`No password reset exists. There is no backdoor. This is the direct cost of true zero-knowledge encryption: if you lose both your passphrase and your Recovery Kit, no one — including us — can recover your data. We consider that a feature, which is why the Recovery Kit step is built into onboarding.`),
      ]},
      { h: 'Responsible disclosure', blocks: [
        T(`We welcome reports from security researchers. If you believe you've found a vulnerability, email security@nocturne.app with details and steps to reproduce. We commit to acknowledging reports promptly, working with you in good faith, and not pursuing legal action for good-faith research that respects user privacy and avoids data destruction.`),
      ]},
      { h: 'Subprocessors', blocks: [
        T(`A current list of subprocessors is maintained in our Privacy Policy. Each is limited to the minimal data required to operate the service and never receives decrypted content.`),
      ]},
    ],
  },
]
