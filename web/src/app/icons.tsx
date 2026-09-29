/* Inline stroke icons — a handful of 16px glyphs is not worth an icon
   dependency, and keeping them local avoids shipping an entire icon font
   for the dozen shapes the shell actually uses. */
import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Icon>
);

export const IconStore = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 9h18l-1-5H4L3 9Z" />
    <path d="M5 9v11h14V9" />
  </Icon>
);

export const IconPeople = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 6a3 3 0 0 1 0 6" />
    <path d="M18 20a5 5 0 0 0-2-4" />
  </Icon>
);

export const IconNote = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M5 3h9l5 5v13H5z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </Icon>
);

export const IconClock = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const IconEdit = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
    <path d="M14 6l4 4" />
  </Icon>
);

export const IconCard = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </Icon>
);

export const IconWallet = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    <path d="M3 7l12-3v3" />
    <circle cx="17" cy="13" r="1" />
  </Icon>
);

export const IconChart = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);

export const IconInbox = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 13h5l1 3h6l1-3h5" />
    <path d="M5 5h14l3 8v6H2v-6L5 5Z" />
  </Icon>
);

export const IconBuilding = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 21V5l8-3v19" />
    <path d="M12 9h8v12H4" />
    <path d="M8 8h1M8 12h1M8 16h1M16 13h1M16 17h1" />
  </Icon>
);

export const IconUser = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M5 21a7 7 0 0 1 14 0" />
  </Icon>
);

export const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 12l5 5L20 6" />
  </Icon>
);

export const IconX = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const IconPlus = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconPulse = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 12h4l3 7 4-14 3 7h4" />
  </Icon>
);
