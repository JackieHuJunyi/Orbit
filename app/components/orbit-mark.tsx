type OrbitMarkProps = {
  className?: string;
};

/**
 * Two peers on parallel, intersecting paths. The overlapping strokes gain
 * weight naturally at their crossings, keeping the mark legible without
 * adding another color or decorative detail.
 */
export function OrbitMark({ className }: OrbitMarkProps) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <ellipse
        className="orbit-mark__path orbit-mark__path--first"
        cx="15.6"
        cy="21.45"
        rx="11.75"
        ry="7.1"
        transform="rotate(-18 15.6 21.45)"
      />
      <ellipse
        className="orbit-mark__path orbit-mark__path--second"
        cx="24.4"
        cy="18.55"
        rx="11.75"
        ry="7.1"
        transform="rotate(-18 24.4 18.55)"
      />
      <circle className="orbit-mark__planet" cx="15.6" cy="21.45" r="3.35" />
      <circle className="orbit-mark__planet" cx="24.4" cy="18.55" r="3.35" />
    </svg>
  );
}
