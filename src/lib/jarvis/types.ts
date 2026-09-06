import type { HubKey } from '../../state/DataHub'

export type Tone = 'ice' | 'cyan' | 'lime' | 'amber' | 'violet' | 'danger'

export interface StatRow {
  label: string
  value: string
  tone?: Tone
}

export interface ListItem {
  primary: string
  secondary?: string
  trailing?: string
  tone?: Tone
}

export interface BriefingSection {
  glyph: string
  title: string
  lines: string[]
  tone?: Tone
}

export type AnswerBlock =
  | { kind: 'stats'; title?: string; rows: StatRow[] }
  | { kind: 'list'; title?: string; items: ListItem[] }
  | { kind: 'briefing'; sections: BriefingSection[]; footer?: string }
  | { kind: 'note'; text: string; tone?: Tone }

/** Where an answer offers to take Ali next. */
export interface AnswerAction {
  label: string
  /** A `ViewId`; typed loosely here so the brain doesn't import the layout. */
  view: string
}

export interface JarvisAnswer {
  /** The line RonalJarvis types out. Always present, always plain language. */
  say: string
  blocks: AnswerBlock[]
  actions: AnswerAction[]
  /** Which hub slices this answer needed — used for the "querying…" step. */
  used: HubKey[]
}

export const answer = (
  say: string,
  blocks: AnswerBlock[] = [],
  actions: AnswerAction[] = [],
  used: HubKey[] = [],
): JarvisAnswer => ({ say, blocks, actions, used })
