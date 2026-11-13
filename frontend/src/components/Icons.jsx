// Iconos SVG minimalistas (24x24, stroke), usados en el sidebar y encabezados.
// Se mantienen inline para no depender de una librería extra.

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function TicketIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3Z" />
      <path d="M10 7v10" strokeDasharray="2 2" />
    </svg>
  );
}

export function PlusCircleIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function ChartIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <path d="M4 20V10M12 20V4M20 20v-6" />
    </svg>
  );
}

export function UsersIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5" />
      <path d="M15.5 5.5c1.3.3 2.25 1.5 2.25 2.9 0 1.35-.87 2.5-2.1 2.87M17.5 14.2c2 .4 3.5 1.9 4 4.3" />
    </svg>
  );
}

export function BuildingIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" />
      <path d="M15 21v-9h4a1 1 0 0 1 1 1v8" />
      <path d="M8.5 7.5h1M11.5 7.5h1M8.5 11h1M11.5 11h1M8.5 14.5h1M11.5 14.5h1" />
    </svg>
  );
}

export function BellIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <path d="M6 8.5a6 6 0 1 1 12 0c0 3.2 1 4.8 1.7 5.7.4.5.05 1.3-.6 1.3H4.9c-.65 0-1-.8-.6-1.3.7-.9 1.7-2.5 1.7-5.7Z" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

export function MenuIcon(props) {
  return (
    <svg {...base} className="w-5 h-5" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg {...base} className="w-5 h-5" {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function TagIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <path d="M11.5 3.5H6a2.5 2.5 0 0 0-2.5 2.5v5.5a1 1 0 0 0 .3.7l9.5 9.5a1 1 0 0 0 1.4 0l6.1-6.1a1 1 0 0 0 0-1.4l-9.5-9.5a1 1 0 0 0-.7-.3Z" />
      <circle cx="8.25" cy="8.25" r="1.35" />
    </svg>
  );
}

export function EditIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5.5 16.5 4 20Z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg {...base} className="w-[15px] h-[15px]" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function ChipIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </svg>
  );
}

export function ReportIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 17v-3M12 17v-5M15 17v-2" />
    </svg>
  );
}

export function MapIcon(props) {
  return (
    <svg {...base} className="w-[18px] h-[18px]" {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}
