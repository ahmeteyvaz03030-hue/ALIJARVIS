import { motion } from 'framer-motion'
import { EASE } from '../../lib/motion'
import type { AnswerBlock, Tone } from '../../lib/jarvis/types'

const TONE_HEX: Record<Tone, string> = {
  ice: '#d8f6ff',
  cyan: '#35e6ff',
  lime: '#8cff78',
  amber: '#ffb54d',
  violet: '#a97bff',
  danger: '#ff525c',
}

const colour = (tone: Tone | undefined, fallback: Tone = 'ice') => TONE_HEX[tone ?? fallback]

/**
 * Renders one answer block. Blocks exist so RonalJarvis can hand back a real
 * briefing or a stats grid — the same shapes the panels use — instead of
 * flattening every fact into a paragraph.
 */
export function AnswerBlocks({ blocks, delay = 0 }: { blocks: AnswerBlock[]; delay?: number }) {
  if (!blocks.length) return null
  return (
    <div className="mt-2.5 space-y-2.5">
      {blocks.map((block, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + i * 0.07, duration: 0.32, ease: EASE.out }}
        >
          <Block block={block} />
        </motion.div>
      ))}
    </div>
  )
}

function Block({ block }: { block: AnswerBlock }) {
  switch (block.kind) {
    case 'stats':
      return (
        <div>
          {block.title && <div className="hud-label mb-1.5">{block.title}</div>}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {block.rows.map((row) => (
              <div key={row.label} className="border border-cyan/12 bg-cyan/[0.04] px-2 py-1.5">
                <div className="hud-label text-[0.42rem]">{row.label}</div>
                <div
                  className="font-display text-[0.95rem] font-black tabular-nums"
                  style={{ color: colour(row.tone) }}
                >
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )

    case 'list':
      return (
        <div>
          {block.title && <div className="hud-label mb-1.5">{block.title}</div>}
          <div className="space-y-1">
            {block.items.map((item, i) => (
              <div
                key={`${item.primary}-${i}`}
                className="flex items-baseline gap-2 border-l-2 pl-2"
                style={{ borderColor: `${colour(item.tone, 'cyan')}55` }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.78rem] leading-snug text-ice/90">
                    {item.primary}
                  </div>
                  {item.secondary && (
                    <div className="truncate font-mono text-[0.55rem] tracking-[0.06em] text-cyan/45">
                      {item.secondary}
                    </div>
                  )}
                </div>
                {item.trailing && (
                  <span
                    className="shrink-0 font-mono text-[0.6rem] tabular-nums"
                    style={{ color: colour(item.tone, 'cyan') }}
                  >
                    {item.trailing}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )

    case 'briefing':
      return (
        <div className="border border-cyan/18 bg-void/50">
          <div className="border-b border-cyan/15 px-3 py-1.5 font-display text-[0.52rem] font-black tracking-[0.28em] text-cyan">
            TODAY&apos;S BRIEFING
          </div>
          <div className="divide-y divide-cyan/[0.08]">
            {block.sections.map((section) => (
              <div key={section.title} className="flex gap-2.5 px-3 py-2">
                <span className="mt-[1px] shrink-0 text-[0.9rem]" aria-hidden="true">
                  {section.glyph}
                </span>
                <div className="min-w-0">
                  <div
                    className="font-display text-[0.56rem] font-black tracking-[0.2em]"
                    style={{ color: colour(section.tone, 'cyan') }}
                  >
                    {section.title}
                  </div>
                  {section.lines.map((line, i) => (
                    <div key={i} className="text-[0.76rem] leading-snug text-ice/80">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {block.footer && (
            <div className="border-t border-cyan/15 px-3 py-1.5 font-display text-[0.5rem] font-black tracking-[0.24em] text-lime">
              {block.footer}
            </div>
          )}
        </div>
      )

    case 'note':
      return (
        <p
          className="border-l-2 pl-2.5 text-[0.7rem] leading-relaxed"
          style={{
            borderColor: `${colour(block.tone, 'cyan')}88`,
            color: `${colour(block.tone, 'cyan')}bb`,
          }}
        >
          {block.text}
        </p>
      )
  }
}
