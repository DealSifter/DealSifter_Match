import React from 'react';

export function MatchesPeopleList({
  contacts = [],
  activeOwnerId = '',
  renderContact,
}) {
  return (
    <>
      {contacts.map((contact) => (
        <React.Fragment key={contact.ownerId || contact.id}>
          {renderContact?.(contact, String(contact.ownerId || contact.id) === String(activeOwnerId || ''))}
        </React.Fragment>
      ))}
    </>
  );
}

export default MatchesPeopleList;
