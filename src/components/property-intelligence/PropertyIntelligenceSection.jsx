import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n/translations';
import { fetchPropertyIntelligence, isPropertyIntelligenceId } from '../../services/propertyIntelligenceService';
import { C } from '../../theme/colors';
import { Modal } from '../ui/Modal';
import {
  LOCKED_INTELLIGENCE_FIELDS,
  buildIntelligenceRows,
  conflictsByField,
} from './propertyIntelligenceViewModel';

const fallback = {
  title: 'Maxxis Deal Intelligence', locked: 'Locked', unlockRequired: 'Unlock required',
  unlock: 'Unlock Deal Intelligence', modalTitle: 'Deal Intelligence unlock',
  modalBody: 'Unlock purchasing will be available in the next release. No Nuggets have been charged.',
  unavailable: 'Unavailable', temporarilyUnavailable: 'Property intelligence is temporarily unavailable.',
  source: 'Source', updated: 'Updated', recordsDiffer: 'Records differ', dealSifter: 'DealSifter', publicRecord: 'Public Record',
  propertyRecord: 'Property Record', propertyCharacteristics: 'Property Characteristics', taxAssessment: 'Tax Assessment',
  propertyTaxes: 'Property Taxes', lastRecordedSale: 'Last Recorded Sale', ownershipRecord: 'Ownership Record',
  propertyType: 'Property Type', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', livingArea: 'Living Area', lotSize: 'Lot Size',
  yearBuilt: 'Year Built', county: 'County', latitude: 'Latitude', longitude: 'Longitude', assessmentYear: 'Assessment Year', taxYear: 'Tax Year',
  latestSalePrice: 'Latest Sale Price', latestSaleDate: 'Latest Sale Date', ownerOccupied: 'Owner Occupied',
};

function LockedSection({ copy, onExplain }) {
  return (
    <div data-testid="property-intelligence-locked" aria-label={`${copy.title}: ${copy.locked}`} style={{ display: 'grid', gap: 10 }}>
      <div role="status" style={{ fontSize: 11, color: C.t2, fontWeight: 800 }}>{copy.locked} · {copy.unlockRequired}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        {LOCKED_INTELLIGENCE_FIELDS.map((field) => (
          <div key={field} style={{ minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 9, padding: 9, background: C.alpha(C.t1, 0.025) }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{copy[field] || fallback[field]}</div>
            <div aria-hidden="true" style={{ height: 10, width: '72%', marginTop: 8, borderRadius: 999, background: C.alpha(C.t1, 0.12) }} />
          </div>
        ))}
      </div>
      <button type="button" aria-label={copy.unlock} onClick={onExplain} style={{ width: '100%', minHeight: 38, borderRadius: 10, border: `1px solid ${C.accent}`, background: C.alpha(C.accent, 0.12), color: C.accent, fontWeight: 900, cursor: 'pointer' }}>
        {copy.unlock}
      </button>
    </div>
  );
}

export function PropertyIntelligenceSection({ propertyId, loadIntelligence = fetchPropertyIntelligence }) {
  const matches = useT('matches')?.matches || {};
  const copy = useMemo(() => ({ ...fallback, ...(matches.propertyIntelligence || {}) }), [matches.propertyIntelligence]);
  const validPropertyId = isPropertyIntelligenceId(propertyId);
  const [requestState, setRequestState] = useState({ propertyId: null, result: null });
  const [explanationOpen, setExplanationOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (!validPropertyId) return () => { active = false; };
    loadIntelligence(propertyId)
      .then((next) => { if (active) setRequestState({ propertyId, result: next }); })
      .catch(() => { if (active) setRequestState({ propertyId, result: { success: false, state: 'unavailable' } }); });
    return () => { active = false; };
  }, [loadIntelligence, propertyId, validPropertyId]);

  const result = validPropertyId
    ? (requestState.propertyId === propertyId ? requestState.result : null)
    : { success: true, state: 'locked', entitled: false, authRequired: false };

  const intelligence = result?.state === 'unlocked' ? result.intelligence : null;
  const rows = useMemo(() => buildIntelligenceRows(intelligence, copy, copy.unavailable), [copy, intelligence]);
  const conflicts = useMemo(() => conflictsByField(intelligence), [intelligence]);
  const standaloneConflicts = useMemo(() => {
    const renderedFields = new Set(rows.map((row) => row.field));
    return (intelligence?.conflicts || []).filter((conflict) => !renderedFields.has(conflict.field));
  }, [intelligence, rows]);

  // No visible placeholder before the server exposure decision.
  if (!result || result.state === 'hidden' || (result.state === 'unavailable' && result.entitled !== true)) return null;

  return (
    <section data-testid="property-intelligence" style={{ margin: '0 10px 10px', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, background: C.alpha(C.accent, 0.035), minWidth: 0, overflow: 'hidden' }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: C.t1, marginBottom: 10 }}>{copy.title}</div>
      {!result ? (
        <div role="status" aria-label="Loading Property Intelligence" style={{ height: 44, borderRadius: 9, background: C.alpha(C.t1, 0.08) }} />
      ) : result.state === 'locked' ? (
        <LockedSection copy={copy} onExplain={() => setExplanationOpen(true)} />
      ) : result.state === 'unavailable' || !intelligence ? (
        <div role="status" style={{ color: C.t2, fontSize: 12 }}>{copy.temporarilyUnavailable}</div>
      ) : (
        <div data-testid="property-intelligence-unlocked" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 8 }}>
            {rows.map((row) => {
              const conflict = conflicts.get(row.field);
              return (
                <div key={row.field} style={{ minWidth: 0, border: `1px solid ${conflict ? C.gold : C.border}`, borderRadius: 9, padding: 9, background: C.card }}>
                  <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{row.label}</div>
                  <div style={{ marginTop: 3, fontSize: 12, fontWeight: 850, color: row.status === 'UNAVAILABLE' ? C.t3 : C.t1, overflowWrap: 'anywhere' }}>{row.value}</div>
                  {conflict ? (
                    <div role="note" style={{ marginTop: 6, fontSize: 9, color: C.gold, lineHeight: 1.35 }}>
                      ⚠ {copy.recordsDiffer}<br />
                      {copy.dealSifter}: {String(conflict.dealSifterValue)}<br />
                      {copy.publicRecord}: {String(conflict.publicRecordValue)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {standaloneConflicts.map((conflict) => (
            <div key={conflict.field} role="note" style={{ border: `1px solid ${C.gold}`, borderRadius: 9, padding: 9, color: C.gold, fontSize: 10, lineHeight: 1.4 }}>
              ⚠ {copy[conflict.field] || conflict.field}: {copy.recordsDiffer}<br />
              {copy.dealSifter}: {String(conflict.dealSifterValue)}<br />
              {copy.publicRecord}: {String(conflict.publicRecordValue)}
            </div>
          ))}
          <div style={{ fontSize: 9, color: C.t3, lineHeight: 1.45 }}>
            {copy.source}: {intelligence.source?.label || copy.unavailable}<br />
            {copy.updated}: {intelligence.source?.updatedAt ? new Date(intelligence.source.updatedAt).toLocaleString() : copy.unavailable}
          </div>
        </div>
      )}
      {explanationOpen ? (
        <Modal onClose={() => setExplanationOpen(false)} maxWidth={400} ariaLabel={copy.modalTitle}>
          <div style={{ display: 'grid', gap: 12, paddingTop: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.t1 }}>{copy.modalTitle}</div>
            <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.5 }}>{copy.modalBody}</div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
