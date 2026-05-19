import React from 'react';
import FacultyLayout from '@/components/mobile/FacultyLayout';
import MarksEntry from '@/pages/exams/MarksEntry';

/**
 * FacultyMarksEntry
 * -----------------
 * Wraps the shared MarksEntry component inside the Faculty mobile shell.
 * The MarksEntry component handles all data-fetching and business logic —
 * this wrapper only provides the mobile layout chrome.
 */
const FacultyMarksEntry = () => (
  <FacultyLayout title="Marks Entry" subtitle="Enter student marks">
    {/* Inner padding so Ant Design card doesn't touch the mobile shell edges */}
    <div style={{ padding: '0 4px 24px' }}>
      <MarksEntry />
    </div>
  </FacultyLayout>
);

export default FacultyMarksEntry;
