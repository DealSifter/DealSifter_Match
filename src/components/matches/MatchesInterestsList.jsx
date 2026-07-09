import React from 'react';

export function MatchesInterestsList({
  interests = [],
  activePropertyId = '',
  renderInterest,
}) {
  return (
    <>
      {interests.map((interest) => (
        <React.Fragment key={interest.id || interest.propertyId}>
          {renderInterest?.(interest, String(interest.id || interest.propertyId || '') === String(activePropertyId || ''))}
        </React.Fragment>
      ))}
    </>
  );
}

export default MatchesInterestsList;
