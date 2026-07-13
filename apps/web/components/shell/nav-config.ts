import {
  AudioLines,
  BarChart3,
  Coins,
  Disc3,
  FileBadge,
  LayoutDashboard,
  MoreHorizontal,
  ReceiptText,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  /** Prototype's mono glyph — desktop sidebar voice. */
  glyph: string
  icon: LucideIcon
}

// Tab bar carries the first four + More (decision: invoices are born, not
// made — attention flows through the dashboard, so Invoices lives in More).
export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", glyph: "◆", icon: LayoutDashboard },
  { href: "/tracks", label: "Tracks", glyph: "≡", icon: AudioLines },
  { href: "/licenses", label: "Licenses", glyph: "▦", icon: FileBadge },
  { href: "/demos", label: "Demos", glyph: "◴", icon: Disc3 },
]

export const MORE_NAV: NavItem[] = [
  { href: "/invoices", label: "Invoices", glyph: "▭", icon: ReceiptText },
  { href: "/royalties", label: "Royalties", glyph: "◉", icon: Coins },
  { href: "/leads", label: "Leads", glyph: "¤", icon: Wallet },
  { href: "/reports", label: "Reports", glyph: "▤", icon: BarChart3 },
  { href: "/settings", label: "Settings", glyph: "⚙", icon: Settings },
]

export const MORE_ICON = MoreHorizontal
