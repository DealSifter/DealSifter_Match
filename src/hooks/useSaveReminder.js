import { useState } from 'react';

// Capture the initial draft per mounted editor. Navigation and validation errors
// do not acknowledge edits; the owner of the editor controls successful saves.
export function useSaveReminder(value) {
  const [baseline] = useState(() => JSON.stringify(value));
  return JSON.stringify(value) !== baseline;
}
