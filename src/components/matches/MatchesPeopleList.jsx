import React from 'react';

export function MatchesPeopleList({
  contacts = [],
  activeOwnerId = '',
  renderContact,
}) {
  return (
    <>
      {contacts.map((contact) => (
        <React.Fragment key={contact.id || contact.ownerId}>
          {renderContact?.(contact, String(contact.id || contact.ownerId) === String(activeOwnerId || ''))}
        </React.Fragment>
      ))}
    </>
  );
}

export default MatchesPeopleList;
