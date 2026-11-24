import React from 'react';
import { useLang, useT } from '../../i18n/translations';
import { C } from '../../theme/colors';

export function FeedOrderingControl({ value, onChange, hasPaidPlan, style, label }) {
  const t = useT('settings').settings;
  const language = useLang('settings').split('-')[0];
  const hint = language === 'pt' ? 'Maior match % primeiro; depois, a opção escolhida.'
    : language === 'es' ? 'Mayor match % primero; después, la opción elegida.'
    : 'Highest match % first; then your selected order.';
  return <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{label || t.prefDefaultOrdering}</span>
    <select data-testid="feed-ordering" value={value} onChange={event => {
      if (event.target.value === 'my_cards_first' && !hasPaidPlan) return;
      onChange(event.target.value);
    }} style={style}>
      <option value="random">{t.prefSortRandom}</option>
      <option value="recent">{t.prefSortRecent}</option>
      <option value="name_asc">{t.prefSortNameAsc}</option>
      <option value="price_asc">{t.prefSortPriceAsc}</option>
      <option value="price_desc">{t.prefSortPriceDesc}</option>
      <option value="my_cards_first" disabled={!hasPaidPlan}>{t.prefSortMyCardsFirst}</option>
    </select>
    <span style={{ fontSize: 10, color: C.t3, lineHeight: 1.4 }}>{hint}</span>
  </label>;
}
