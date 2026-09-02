type OrbitMarkProps = {
  className?: string;
};

/**
 * Two peers moving through one shared orbit. The geometry stays legible from
 * a compact toolbar mark through larger product surfaces.
 */
export function OrbitMark({ className }: OrbitMarkProps) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <ellipse className="orbit-mark__path" cx="20" cy="20" rx="16" ry="10.25" transform="rotate(-18 20 20)" />
      <circle className="orbit-mark__planet orbit-mark__planet--primary" cx="14" cy="20" r="4.35" />
      <circle className="orbit-mark__planet orbit-mark__planet--companion" cx="26" cy="20" r="4.35" />
    </svg>
  );
}
