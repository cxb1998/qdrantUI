import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconCollections = (p: IconProps) => (
  <Base {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </Base>
)

export const IconBook = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
  </Base>
)

export const IconDataset = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Base>
)

export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7m-10 10-2.1 2.1" />
  </Base>
)

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16V4m0 0L7 9m5-5 5 5" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </Base>
)

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v12m0 0 5-5m-5 5-5-5" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </Base>
)

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
    <path d="M10 11v6m4-6v6" />
  </Base>
)

export const IconRefresh = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 11a8 8 0 0 0-14-4.5L4 8" />
    <path d="M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14 4.5L20 16" />
    <path d="M20 20v-4h-4" />
  </Base>
)

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
)

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="m15 6-6 6 6 6" />
  </Base>
)

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
)

export const IconCopy = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="9" width="11" height="11" rx="1.5" />
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </Base>
)

export const IconPencil = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </Base>
)

export const IconFilter = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
  </Base>
)

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
)

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 13 4 4L19 7" />
  </Base>
)

export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Base>
)

export const IconPoints = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="8" r="2" />
    <circle cx="9" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
    <path d="M8 7l8 1M8 16l4-7m0 0 4 6" opacity="0.5" />
  </Base>
)

export const IconSliders = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Base>
)

export const IconMemory = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="5" width="14" height="14" rx="2" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3" />
  </Base>
)

export const IconTarget = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </Base>
)

export const IconCamera = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8a2 2 0 0 1 2-2h1l1.2-1.6a1 1 0 0 1 .8-.4h6a1 1 0 0 1 .8.4L17 6h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="12.5" r="3.2" />
  </Base>
)

export const IconGraph = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="7" r="2.4" />
    <circle cx="18" cy="6" r="2.4" />
    <circle cx="16" cy="18" r="2.4" />
    <circle cx="7" cy="17" r="2.4" />
    <path d="M8 8l8-1M8.5 15l6 2M7 15l9-8M6.5 9.4 6.9 14.6" opacity="0.6" />
  </Base>
)

export const IconSpinner = (p: IconProps) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className="animate-spin"
    {...p}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.2" />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
)

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 10v5m0 3v.5" />
  </Base>
)

export const IconWarn = IconAlert

export const IconEye = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
)

export const IconEyeOff = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.4M9.9 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-4.1 5.2M6.1 6.1C3.5 7.8 2 12 2 12a18.2 18.2 0 0 0 11.9 6.9" />
  </Base>
)
