type OrbitMarkProps = {
  className?: string;
};

/** Two peers travelling on parallel paths that intersect around shared work. */
export function OrbitMark({ className }: OrbitMarkProps) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <g transform="rotate(-18 20 20)">
        <ellipse className="orbit-mark__path orbit-mark__path--first" cx="16" cy="20" rx="11.5" ry="7.75" />
        <ellipse className="orbit-mark__path orbit-mark__path--second" cx="24" cy="20" rx="11.5" ry="7.75" />
        <circle className="orbit-mark__planet" cx="16" cy="12.25" r="3.1" />
        <circle className="orbit-mark__planet" cx="24" cy="27.75" r="3.1" />
      </g>
    </svg>
  );
}
