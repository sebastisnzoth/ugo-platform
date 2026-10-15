import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconGrid = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </Base>
)

export const IconWrench = (props: IconProps) => (
  <Base {...props}>
    <path d="M14.6 6.4a4.2 4.2 0 0 0 5.4 5.4L21 11l-3.2 3.2-6.4 6.4a2.6 2.6 0 0 1-3.7-3.7l6.4-6.4Z" />
    <path d="M6.5 6.5 3 3l3.5.7L8 2.5l1.4 1.4" />
  </Base>
)

export const IconUsers = (props: IconProps) => (
  <Base {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
    <path d="M16.5 5.6a3 3 0 0 1 0 5.6M18 14.2c2 .7 3.4 2.4 3.4 4.4" />
  </Base>
)

export const IconShield = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3 5 5.8v5.4c0 4.2 2.9 7.4 7 9.3 4.1-1.9 7-5.1 7-9.3V5.8Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Base>
)

export const IconWallet = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="14.5" r="1.2" />
  </Base>
)

export const IconGavel = (props: IconProps) => (
  <Base {...props}>
    <path d="m5 19h9" />
    <path d="m7 15.5 7-7" />
    <path d="m13.5 4.5 6 6-2.5 2.5-6-6Z" />
    <path d="m10 8 2.5-2.5" />
  </Base>
)

export const IconScroll = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 4h11l3 3v13H5Z" />
    <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
  </Base>
)

export const IconGear = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.6-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10.3 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z" />
  </Base>
)

export const IconSearch = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Base>
)

export const IconRefresh = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4.5h-4.5" />
  </Base>
)

export const IconClose = (props: IconProps) => (
  <Base {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
)

export const IconChevron = (props: IconProps) => (
  <Base {...props}>
    <path d="m9 6 6 6-6 6" />
  </Base>
)

export const IconChevronDown = (props: IconProps) => (
  <Base {...props}>
    <path d="m6 9 6 6 6-6" />
  </Base>
)

export const IconLogout = (props: IconProps) => (
  <Base {...props}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8 6 12l4 4M6 12h9" />
  </Base>
)

export const IconBolt = (props: IconProps) => (
  <Base {...props}>
    <path d="M13.5 3 5 13.5h5l-1 7.5 8.5-10.5h-5Z" />
  </Base>
)

export const IconAlert = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 4.5 3 20h18Z" />
    <path d="M12 10v4.5M12 17.2v.1" />
  </Base>
)

export const IconCheck = (props: IconProps) => (
  <Base {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
)

export const IconClock = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
)

export const IconExternal = (props: IconProps) => (
  <Base {...props}>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Base>
)

export const IconPlus = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)

export const IconMenu = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
)

export const IconCommand = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 6a2.5 2.5 0 1 0-2.5 2.5H9Zm6 0a2.5 2.5 0 1 1 2.5 2.5H15ZM9 18a2.5 2.5 0 1 1-2.5-2.5H9Zm6 0a2.5 2.5 0 1 0 2.5-2.5H15Z" />
  </Base>
)

export const IconPulse = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 12h4l2.5-6 3.5 12 2.5-6H21" />
  </Base>
)
