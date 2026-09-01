"use client";

export type WorkbenchStatusBarProps = Readonly<{
  visibleNotice: string;
  artifactStatsText: string;
}>;

export function WorkbenchStatusBar({ visibleNotice, artifactStatsText }: WorkbenchStatusBarProps) {
  return (
    <footer
      className="statusbar is-visible"
      role="status"
      aria-live="polite"
      key={`${visibleNotice}\u0000${artifactStatsText}`}
    >
      <div>
        <span className="status-agent-dot" /> {visibleNotice}
      </div>
      <div className="statusbar-right">
        <span>{artifactStatsText}</span>
      </div>
    </footer>
  );
}
