import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { C } from '../../theme/colors';
import {
  INVESTMENT_AVG_DEAL_SIZE_OPTIONS,
  INVESTMENT_CONDITION_OPTIONS,
  INVESTMENT_DEAL_SOURCE_OPTIONS,
  INVESTMENT_DEALS_COUNT_OPTIONS,
  INVESTMENT_LOOKING_FOR_OPTIONS,
  INVESTMENT_PRICE_RANGE_OPTIONS,
  INVESTMENT_PROPERTY_TYPE_OPTIONS,
  INVESTMENT_ROLE_OPTIONS,
  INVESTMENT_STRATEGY_OPTIONS,
  INVESTMENT_TAX_OBJECTIVE_OPTIONS,
  INVESTMENT_YEARS_OPTIONS,
} from '../../lib/investmentProfile';

function InvestmentChip({ active, onClick, children, style, ...buttonProps }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...buttonProps}
      style={{
        padding: '6px 10px',
        borderRadius: 20,
        border: `1px solid ${active ? C.accent : C.border}`,
        background: active ? C.alpha(C.accent, 0.1) : 'transparent',
        color: active ? C.accent : C.t2,
        fontWeight: 600,
        fontSize: 11,
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function InvestmentProfileModal({
  addInvestmentMarket,
  investmentMarketInput,
  investmentProfileDraft,
  investmentProfileStrength,
  investmentScoreMeta,
  investmentTriggerCategories,
  isMobileViewport,
  onClose,
  onSave,
  removeInvestmentMarket,
  requiresInvestmentProfile,
  setInvestmentField,
  setInvestmentMarketInput,
  t,
  toggleInvestmentField,
}) {
  return (
    <Modal
      onClose={onClose}
      maxWidth={1450}
      overlayStyle={isMobileViewport ? {} : { padding: '92px 24px 24px', alignItems: 'flex-start' }}
      contentStyle={isMobileViewport ? {} : { width: 'min(1450px, calc(100vw - 48px))', height: 580, maxHeight: 580, overflow: 'hidden', padding: '20px 22px 18px' }}
    >
      <div style={{ display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', gap: 8, height: isMobileViewport ? 'auto' : '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingRight: 28 }}>
          <h3 style={{ margin: 0, color: C.t1, fontSize: 22, fontWeight: 800 }}>{t.investmentProfileTitle || 'Investor Profile'}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, color: C.t3, fontSize: 12 }}>
            {t.investmentProfileIntro || 'Complete this profile to improve capital/deal matching and card relevance.'}
          </p>
          {requiresInvestmentProfile ? (
            <span style={{ color: C.danger, fontSize: 11, fontWeight: 800 }}>
              {`* ${t.investmentProfileRequiredHint || 'Required for selected categories'}`}
            </span>
          ) : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobileViewport ? '1fr' : '0.95fr 1fr 1.15fr', gap: 14, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gap: 9, alignContent: 'start', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <div style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentIam || 'I am a... (select all that apply)'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {INVESTMENT_ROLE_OPTIONS.map((item) => (
                  <InvestmentChip key={`inv-role-${item}`} active={(investmentProfileDraft.investorRoles || []).includes(item)} onClick={() => toggleInvestmentField('investorRoles', item)}>{item}</InvestmentChip>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentTargetMarkets || 'Target markets (searchable)'}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={investmentMarketInput}
                    onChange={(e) => setInvestmentMarketInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInvestmentMarket(); } }}
                    placeholder={t.investmentTargetMarketsPlaceholder || 'Search a city or state and press Enter'}
                    style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 11 }}
                  />
                  <button type="button" onClick={addInvestmentMarket} style={{ padding: '8px 11px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {t.add || 'Add'}
                  </button>
                </div>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, height: 58, maxHeight: 58, overflowY: 'auto', paddingRight: 4, alignContent: 'flex-start' }}>
                {(investmentProfileDraft.targetMarkets || []).map((market) => (
                  <InvestmentChip key={`inv-market-${market}`} active onClick={() => removeInvestmentMarket(market)}>{market}</InvestmentChip>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <div style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentLookingFor || "I'm looking for..."}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {INVESTMENT_LOOKING_FOR_OPTIONS.map((item) => (
                  <InvestmentChip key={`inv-seek-${item}`} active={(investmentProfileDraft.lookingFor || []).includes(item)} onClick={() => toggleInvestmentField('lookingFor', item)}>{item}</InvestmentChip>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <div style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentPropertyTypes || 'Property types'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {INVESTMENT_PROPERTY_TYPE_OPTIONS.map((item) => (
                  <InvestmentChip key={`inv-ptype-${item}`} active={(investmentProfileDraft.propertyTypes || []).includes(item)} onClick={() => toggleInvestmentField('propertyTypes', item)}>{item}</InvestmentChip>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 9, alignContent: 'start', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <div style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentStrategies || 'Investment strategies'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {INVESTMENT_STRATEGY_OPTIONS.map((item) => (
                  <InvestmentChip key={`inv-strategy-${item}`} active={(investmentProfileDraft.strategies || []).includes(item)} onClick={() => toggleInvestmentField('strategies', item)}>{item}</InvestmentChip>
                ))}
              </div>
            </div>
            <label style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentCurrentFocus || 'Current focus / goals'}</span>
              <input
                value={investmentProfileDraft.currentFocus}
                onChange={(e) => setInvestmentField('currentFocus', e.target.value)}
                placeholder={t.investmentCurrentFocusPlaceholder || 'Example: Fix & Flip in Florida with private lenders'}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 11 }}
              />
            </label>
            <div style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <div style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentDealSources || 'Deal sources'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {INVESTMENT_DEAL_SOURCE_OPTIONS.map((item) => (
                  <InvestmentChip key={`inv-source-${item}`} active={(investmentProfileDraft.dealSources || []).includes(item)} onClick={() => toggleInvestmentField('dealSources', item)}>{item}</InvestmentChip>
                ))}
              </div>
            </div>
            {investmentTriggerCategories.includes('tax') ? (
              <div style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
                <div style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentTaxObjectives || 'Tax deed objectives'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {INVESTMENT_TAX_OBJECTIVE_OPTIONS.map((item) => (
                    <InvestmentChip key={`inv-tax-${item}`} active={(investmentProfileDraft.taxDealObjectives || []).includes(item)} onClick={() => toggleInvestmentField('taxDealObjectives', item)}>{item}</InvestmentChip>
                  ))}
                </div>
                {(investmentProfileDraft.taxDealObjectives || []).includes('Other') ? (
                  <input
                    value={investmentProfileDraft.taxDealObjectiveOtherText}
                    onChange={(e) => setInvestmentField('taxDealObjectiveOtherText', e.target.value)}
                    placeholder={t.investmentTaxObjectivesOtherPlaceholder || 'Describe other tax deed objective'}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 11 }}
                  />
                ) : null}
              </div>
            ) : null}
            <div style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <div style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentAcceptableCondition || 'Acceptable condition'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {INVESTMENT_CONDITION_OPTIONS.map((item) => (
                  <InvestmentChip key={`inv-condition-${item}`} active={(investmentProfileDraft.acceptableConditions || []).includes(item)} onClick={() => toggleInvestmentField('acceptableConditions', item)}>{item}</InvestmentChip>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentPriceRange || 'Price range'}</span>
                <select value={investmentProfileDraft.priceRange} onChange={(e) => setInvestmentField('priceRange', e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 11 }}>
                  {INVESTMENT_PRICE_RANGE_OPTIONS.map((opt) => <option key={`inv-price-${opt.value || 'none'}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentAvgDealSize || 'Avg deal size'}</span>
                <select value={investmentProfileDraft.avgDealSize} onChange={(e) => setInvestmentField('avgDealSize', e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 11 }}>
                  {INVESTMENT_AVG_DEAL_SIZE_OPTIONS.map((opt) => <option key={`inv-avg-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentDealsLifetime || 'Deals closed (lifetime)'}</span>
                <select value={investmentProfileDraft.dealsClosedLifetime} onChange={(e) => setInvestmentField('dealsClosedLifetime', e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 11 }}>
                  {INVESTMENT_DEALS_COUNT_OPTIONS.map((opt) => <option key={`inv-life-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentDealsLast12 || 'Deals closed (last 12mo)'}</span>
                <select value={investmentProfileDraft.dealsClosedLast12mo} onChange={(e) => setInvestmentField('dealsClosedLast12mo', e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 11 }}>
                  {INVESTMENT_DEALS_COUNT_OPTIONS.map((opt) => <option key={`inv-y12-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentYearsInvesting || 'Years investing'}</span>
                <select value={investmentProfileDraft.yearsInvesting} onChange={(e) => setInvestmentField('yearsInvesting', e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, boxSizing: 'border-box', fontSize: 11 }}>
                  {INVESTMENT_YEARS_OPTIONS.map((opt) => <option key={`inv-years-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <div style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentCapitalReady || 'Have available cash to invest?'}</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <InvestmentChip active={investmentProfileDraft.capitalReady === 'yes'} onClick={() => setInvestmentField('capitalReady', 'yes')}>{t.yes || 'Yes'}</InvestmentChip>
                  <InvestmentChip active={investmentProfileDraft.capitalReady === 'no'} onClick={() => setInvestmentField('capitalReady', 'no')}>{t.no || 'No'}</InvestmentChip>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentAccredited || 'Accredited investor'}</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <InvestmentChip active={investmentProfileDraft.accreditedInvestor === 'yes'} onClick={() => setInvestmentField('accreditedInvestor', 'yes')}>{t.yes || 'Yes'}</InvestmentChip>
                  <InvestmentChip active={investmentProfileDraft.accreditedInvestor === 'no'} onClick={() => setInvestmentField('accreditedInvestor', 'no')}>{t.no || 'No'}</InvestmentChip>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', paddingTop: 8, borderTop: `1px solid ${C.alpha(C.border, 0.75)}` }}>
              <span style={{ fontSize: 12, color: C.t1, fontWeight: 900 }}>{t.investmentActiveDeals || 'Currently active deals'}</span>
              <button type="button" onClick={() => setInvestmentField('currentlyActiveDeals', Math.max(0, Number(investmentProfileDraft.currentlyActiveDeals || 0) - 1))} style={{ width: 26, height: 26, borderRadius: 99, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, cursor: 'pointer' }}>-</button>
              <strong style={{ minWidth: 18, textAlign: 'center', color: C.t1 }}>{Number(investmentProfileDraft.currentlyActiveDeals || 0)}</strong>
              <button type="button" onClick={() => setInvestmentField('currentlyActiveDeals', Math.min(99, Number(investmentProfileDraft.currentlyActiveDeals || 0) + 1))} style={{ width: 26, height: 26, borderRadius: 99, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, fontWeight: 700, cursor: 'pointer' }}>+</button>
            </div>

            <div style={{ marginTop: 2, border: `1px solid ${C.alpha(investmentScoreMeta.color, 0.45)}`, background: C.alpha(investmentScoreMeta.color, 0.08), borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${C.alpha(investmentScoreMeta.color, 0.55)}`, background: C.alpha(investmentScoreMeta.color, 0.12), display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={investmentScoreMeta.icon} size={14} color={investmentScoreMeta.color} strokeWidth={2.1} />
                  </span>
                  <strong style={{ color: C.t1, fontSize: 13 }}>{t.investmentScoreCardTitle || 'Match readiness score'}</strong>
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: investmentScoreMeta.color }}>{investmentProfileStrength}%</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: investmentScoreMeta.color }}>
                {`${t.investmentScoreRangeLabel || 'Range'}: ${investmentScoreMeta.label}`}
              </div>
              <div style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{investmentScoreMeta.alert}</div>
              <div style={{ display: 'grid', gap: 3, paddingTop: 6, borderTop: `1px dashed ${C.alpha(C.border, 0.9)}` }}>
                <div style={{ fontSize: 10, color: C.t3 }}><strong style={{ color: C.success }}>100%</strong> - {t.investmentScoreRangeExcellent || 'Excellent'}</div>
                <div style={{ fontSize: 10, color: C.t3 }}><strong style={{ color: C.accent }}>99-90%</strong> - {t.investmentScoreRangeGood || 'Good'}</div>
                <div style={{ fontSize: 10, color: C.t3 }}><strong style={{ color: C.warning }}>89-60%</strong> - {t.investmentScoreRangeNotBad || 'Not bad (can be increased)'}</div>
                <div style={{ fontSize: 10, color: C.t3 }}><strong style={{ color: C.danger }}>{'<60%'}</strong> - {t.investmentScoreRangeNeedsTlc || 'Needs TLC for better matches'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', padding: '0 10px 8px' }}>
              <button
                className="onb-save-profiles is-dirty"
                type="button"
                onClick={onSave}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', background: C.accent, color: '#0d1210', fontWeight: 900, cursor: 'pointer', fontSize: 12 }}
              >
                {t.saveProfile || 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
