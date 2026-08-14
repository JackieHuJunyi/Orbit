"use client";

export type WorkbenchStatusBarProps = Readonly<{
  visibleNotice: string;
  artifactStatsText: string;
}>;

export function WorkbenchStatusBar({ visibleNotice, artifactStatsText }: WorkbenchStatusBarProps) {
  return (
    <footer className="statusbar">
      <div>
        <span className="status-agent-dot" /> {visibleNotice}
      </div>
      <div className="statusbar-right">
        <span>{artifactStatsText}</span>
      </div>
    </footer>
  );
}
