import type { JSX, ReactNode } from "react";

export type IconProps = { size?: number; className?: string };

function Svg({ size = 18, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const LogoMark = ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="url(#edituh-lg)" />
    <path d="M9 8.5h14v2.6H12.2v3.4h8.6v2.6h-8.6v4.3H23V24H9z" fill="#fff" />
    <defs>
      <linearGradient id="edituh-lg" x1="0" y1="0" x2="32" y2="32">
        <stop offset="0" stopColor="#2e3440" />
        <stop offset="1" stopColor="#4f8bf9" />
      </linearGradient>
    </defs>
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 11v6M14 11v6" /></Svg>
);
export const CopyIcon = (p: IconProps) => (
  <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>
);
export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></Svg>
);
export const UploadIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 16V4m0 0 4 4m-4-4-4 4M4 20h16" /></Svg>
);
export const SunIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
);
export const MoonIcon = (p: IconProps) => (
  <Svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></Svg>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
);
export const XIcon = (p: IconProps) => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="m4 12.5 5 5L20 6.5" /></Svg>
);
export const CommandIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 9V6a3 3 0 1 0-3 3h14a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H7a3 3 0 1 0 3 3" /></Svg>
);
export const ChartIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20V10m6 10V4m6 16v-7m4 7H2" /></Svg>
);
export const BulbIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.6 1 2.5h6c0-.9.2-1.8 1-2.5A6 6 0 0 0 12 3Z" /></Svg>
);
export const DividerIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 12h18" /></Svg>
);
export const TableIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10M15 10v10" /></Svg>
);
export const ImageIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m21 15-5-5-9 9" /></Svg>
);
export const VideoIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3Z" /></Svg>
);
export const AudioIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></Svg>
);
export const ListIcon = (p: IconProps) => (
  <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></Svg>
);
export const NumberedIcon = (p: IconProps) => (
  <Svg {...p}><path d="M10 6h11M10 12h11M10 18h11" /><path d="M4 4v3m0 0L2.5 8.5M4 7 5.5 8.5M4 16c0-1 .8-1.5 1.5-1.5S7 15.5 7 16c0 1.5-3 2-3 3.5h3" /></Svg>
);
export const ChecklistIcon = (p: IconProps) => (
  <Svg {...p}><path d="m4 5 2 2 4-4" /><path d="M4 13h6M4 21h6M13 6h7M13 12h7M13 18h7" /></Svg>
);
export const QuoteIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9.5 6C6 7.5 4 10 4 13.5V19h6v-6H6.5c0-2.5 1.2-4.5 3.5-5.5L9.5 6Zm10 0C15.5 7.5 13.5 10 13.5 13.5V19h6v-6H16c0-2.5 1.2-4.5 3.5-5.5L19.5 6Z" /></Svg>
);
export const CodeIcon = (p: IconProps) => (
  <Svg {...p}><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-2-14-4 18" /></Svg>
);
export const HeadingIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 4v16m12-16v16M6 12h12" /></Svg>
);
export const TextIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 6h16M12 6v14m-4 0h8" /></Svg>
);
export const EditIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>
);
export const MoreIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Svg>
);
export const OutlineIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></Svg>
);
export const InfoIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M12 11v5" /></Svg>
);
export const LinkIcon = (p: IconProps) => (
  <Svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Svg>
);
export const InstallIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Svg>
);
export const WarningIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5m0 3h.01" /></Svg>
);
export const FileIcon = (p: IconProps) => (
  <Svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></Svg>
);
export const SparkIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8M18.4 5.6l-2.8 2.8m-7.2 7.2-2.8 2.8" /></Svg>
);
export const PaletteIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 21a9 9 0 1 1 9-9c0 2.5-1.8 3.5-3.5 3.5H16a2 2 0 0 0-1.5 3.4c.4.5.6 1 .6 1.6 0 1.4-1.2 1-2.5 1Z" /><circle cx="7.5" cy="11" r=".5" /><circle cx="10" cy="7.5" r=".5" /><circle cx="14.5" cy="7.5" r=".5" /></Svg>
);
export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 8h9m0 0a2 2 0 1 0 4 0m-4 0h7M4 16h3m0 0a2 2 0 1 0 4 0m-4 0h13" /></Svg>
);
export const SidebarIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></Svg>
);
export const GridIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>
);
export const BookIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20" /></Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}><path d="M14 5h5v5M19 5l-8 8M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></Svg>
);
export const FileTextIcon = (p: IconProps) => (
  <Svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M9 13h6M9 17h6" /></Svg>
);