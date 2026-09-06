interface IconProps {
  className?: string
  size?: number
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const IconCore = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="7.5" strokeDasharray="2 3" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
  </svg>
)

export const IconPlane = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 13.5l18-7-4.2 8.4L21 21l-6.6-3.2-2.9 3.4-.6-4.6L3 13.5z" />
  </svg>
)

export const IconPin = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21.5s7-6.1 7-11.1A7 7 0 0 0 5 10.4c0 5 7 11.1 7 11.1z" />
    <circle cx="12" cy="10.2" r="2.4" />
  </svg>
)

export const IconFilm = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="1.5" />
    <path d="M7.5 4.5v15M16.5 4.5v15M2.5 12h19M2.5 8.2h5M2.5 15.8h5M16.5 8.2h5M16.5 15.8h5" />
  </svg>
)

export const IconComms = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20.5 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.4-5.3A7.5 7.5 0 1 1 20.5 12.5z" />
    <path d="M9 11.5h6M9 14.5h3.5" />
  </svg>
)

export const IconSettings = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.6M12 18.9v2.6M4.2 7l2.2 1.3M17.6 15.7l2.2 1.3M4.2 17l2.2-1.3M17.6 8.3l2.2-1.3" />
  </svg>
)

export const IconSound = ({ className, size = 18, muted }: IconProps & { muted?: boolean }) => (
  <svg {...base(size)} className={className}>
    <path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" />
    {muted ? (
      <path d="M15.5 9.5l4 5M19.5 9.5l-4 5" />
    ) : (
      <path d="M15 8.8a4.5 4.5 0 0 1 0 6.4M17.8 6.4a8 8 0 0 1 0 11.2" />
    )}
  </svg>
)

export const IconMotion = ({ className, size = 18 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 12h4l2-5 3 10 2.5-7 2 4h4.5" />
  </svg>
)

export const IconPower = ({ className, size = 18 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5v7M7 6.6a7 7 0 1 0 10 0" />
  </svg>
)

export const IconRadar = ({ className, size = 18 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" strokeDasharray="2 2" />
    <path d="M12 12l6-4" />
  </svg>
)

export const IconWeather = ({ className, size = 18 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="9.5" r="3.2" />
    <path d="M9 3.6v1.4M9 14v1.4M3.6 9.5H5M13 9.5h1.4M5.2 5.7l1 1M11.8 12.3l1 1M5.2 13.3l1-1M11.8 6.7l1-1" />
    <path d="M11 19.5h7.5a2.5 2.5 0 0 0 0-5 3.8 3.8 0 0 0-7.2-1 2.9 2.9 0 0 0-.3 6z" />
  </svg>
)

export const IconChecklist = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6.5l1.5 1.5L8 5.5" />
    <path d="M4 12.5l1.5 1.5L8 11.5" />
    <path d="M4 18.5l1.5 1.5L8 17.5" />
    <path d="M11 6.5h9M11 12.5h9M11 18.5h9" />
  </svg>
)

export const IconTrophy = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M7 5.5H4a3 3 0 0 0 3 4.5M17 5.5h3a3 3 0 0 1-3 4.5" />
    <path d="M12 14v3M9 21h6M9.5 21c0-2 1-3 2.5-4 1.5 1 2.5 2 2.5 4" />
  </svg>
)

/** Club crest — the Beşiktaş module. */
export const IconShield = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.6 7.5 10 4.3-1.4 7.5-5.4 7.5-10v-6L12 2.5Z" />
    <path d="M8.5 10.5h7M8.5 13.5h7" />
  </svg>
)

/** Operator record — the ALI DATABASE view. */
export const IconIdCard = ({ className, size = 20 }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="1.5" />
    <circle cx="8.5" cy="11" r="2.2" />
    <path d="M5 16.2c.6-1.5 2-2.3 3.5-2.3s2.9.8 3.5 2.3M14.5 9.5h4M14.5 12.5h4M14.5 15.5h2.5" />
  </svg>
)
