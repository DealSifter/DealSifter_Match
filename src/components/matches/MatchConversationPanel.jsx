import React from 'react';

export function MatchConversationPanel({
  activeOwner = null,
  messages = [],
  renderMessage,
  renderEmpty,
  renderComposer,
}) {
  if (!activeOwner) return renderEmpty?.() || null;
  return (
    <>
      {messages.map((message, index) => (
        <React.Fragment key={message.id || `${activeOwner.ownerId || activeOwner.id}:${index}`}>
          {renderMessage?.(message, index)}
        </React.Fragment>
      ))}
      {renderComposer?.(activeOwner)}
    </>
  );
}

export default MatchConversationPanel;
