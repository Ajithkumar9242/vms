import React from 'react';

/**
 * MobileSplash — shared splash overlay for Faculty and Parent portals.
 *
 * Props:
 *   open     {boolean} — whether to show the overlay
 *   label    {string}  — subtitle under the logo (default: "VMS School ERP")
 *
 * Animation is purely CSS (class: erp-splash).
 * The overlay auto-animates out; parent controls removal via `open`.
 */
const MobileSplash = ({ open, label = 'VMS School ERP' }) => {
  if (!open) return null;
  return (
    <div className="erp-splash" aria-hidden="true">
      <div className="erp-splash-logo">V</div>
      <div className="erp-splash-title">{label}</div>
    </div>
  );
};

export default MobileSplash;
