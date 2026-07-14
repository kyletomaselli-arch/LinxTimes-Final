/**
 * The LinxTimes booking-page background: a light, luminous golf-toned aurora
 * with the hand-painted "Links at Greystone" aerial course map drifting slowly
 * behind the content. The painting is blended with `multiply` so its white
 * canvas drops away and only the painted fairways / water / bunkers float over
 * the aurora glow; a slow ken-burns drift gives it life while keeping the exact
 * layout of the artwork.
 *
 * Purely presentational and fixed behind page content (z-0). Place it once near
 * the top of a page; content sits in a `relative z-10` container above it.
 */
export function AuroraBackground() {
  return (
    <div className="lx-bg" aria-hidden="true">
      {/* course-map artwork, faded and slowly drifting, at the very back */}
      <div className="lx-map" />
      {/* #2 luminous aurora, blended over the map to tint it green + fade it */}
      <div className="lx-aurora">
        <div className="lx-blob lx-blob-1" />
        <div className="lx-blob lx-blob-2" />
        <div className="lx-blob lx-blob-3" />
        <div className="lx-blob lx-blob-4" />
      </div>
      {/* soft green wash to unify and keep foreground content crisp */}
      <div className="lx-wash" />
    </div>
  );
}
