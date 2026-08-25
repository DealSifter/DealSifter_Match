import React from 'react';

export function MaxxisComposedExperience({ experience, message, onSmartAction, onFollowUp }) {
  if (experience?.status !== 'COMPOSED' || experience?.presentationHints?.render === false) return null;
  const actions = [experience.primaryAction, ...(experience.secondaryActions || [])].filter(Boolean);
  return (
    <section
      className="maxxis-composed-experience"
      data-testid={`maxxis-composed-${String(experience.mode || '').toLowerCase()}`}
      data-density={experience.presentationHints?.density || 'STANDARD'}
      aria-label={experience.headline}
    >
      <div className="maxxis-message-body maxxis-composed-copy">
        <strong data-testid="maxxis-composed-headline">{experience.headline}</strong>
        {experience.summary ? <span>{experience.summary}</span> : null}
      </div>
      {experience.evidence?.length || experience.statusItems?.length ? (
        <ul className="maxxis-composed-facts" aria-label="Maxxis supporting facts">
          {[...(experience.evidence || []), ...(experience.statusItems || [])].map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {actions.length ? (
        <div className="maxxis-smart-actions" aria-label="Maxxis suggested actions">
          {actions.map((action) => (
            <button type="button" key={`${message.id}-composed-${action.code}`} className="maxxis-smart-action-chip" data-testid={`maxxis-smart-action-${action.code}`} onClick={() => onSmartAction?.(action.sourceAction, message)}>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {experience.followUps?.length ? (
        <div className="maxxis-followups" aria-label="Maxxis follow-up options">
          {experience.followUps.map((followUp) => (
            <button type="button" key={`${message.id}-composed-followup-${followUp.code}`} className="maxxis-followup-chip" data-testid={`maxxis-followup-${followUp.code}`} onClick={() => onFollowUp?.(followUp, message)}>
              {followUp.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
