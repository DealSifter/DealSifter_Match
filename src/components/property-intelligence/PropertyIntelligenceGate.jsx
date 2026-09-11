import React from 'react';
import { isPropertyIntelligenceEnabled } from '../../lib/propertyIntelligenceFeatureFlag';
import { PropertyIntelligenceSection } from './PropertyIntelligenceSection';

export function PropertyIntelligenceGate({
  propertyId,
  loadIntelligence,
  enabled = isPropertyIntelligenceEnabled(),
}) {
  if (enabled !== true) return null;
  return <PropertyIntelligenceSection propertyId={propertyId} loadIntelligence={loadIntelligence} />;
}
