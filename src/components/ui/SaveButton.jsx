import React from 'react';
import './SaveButton.css';

export function SaveButton({ dirty = false, className = '', type = 'button', ...props }) {
  return <button {...props} type={type} data-save-pending={dirty ? 'true' : 'false'}
    className={`ds-save-button ${className} ${dirty ? 'is-dirty' : ''}`.trim()} />;
}
