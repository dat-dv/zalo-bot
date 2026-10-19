export function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`size-3.5 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

export function QrIcon() {
  return (
    <svg
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="7" width="7" x="3" y="3" />
      <rect height="7" width="7" x="14" y="3" />
      <rect height="7" width="7" x="14" y="14" />
      <rect height="7" width="7" x="3" y="14" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function GoogleDriveIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.2 3.3l12.3-21.3-6.75-11.75-12.6 21.85c-.45.75-.45 1.55 0 2.25z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-12.3-21.3c-1.3.8-2.4 1.9-3.2 3.3l-21.55 37.35 12.6-21.85 12.3-21.3z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.3-.8 2.4-1.9 3.2-3.3l1.6-2.75 3.85-6.65c.45-.7.45-1.5 0-2.25l-20.05-34.75-12.3 21.3 11.4 19.75 12.3 8.65z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 12.3-21.3c-1.3-.8-2.9-1.2-4.5-1.2h-15.6c-1.6 0-3.2.4-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53.5h-32.3l-12.3 21.3c1.3.8 2.9 1.2 4.5 1.2h47.9c1.6 0 3.2-.4 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.55 76.8-12.3-21.3h-24.6l-6.75 11.7 11.4 19.75c1.3-.8 2.4-1.9 3.2-3.3z"
        fill="#ffba00"
      />
    </svg>
  );
}

export function ExternalLinkIcon({ className = 'size-3' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}

export function LogoutIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}
