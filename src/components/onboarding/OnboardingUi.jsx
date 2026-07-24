import { C } from '../../theme/colors';

export function Chip({ active, onClick, children, style, ...buttonProps }) {
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

export function SectionCard({
  title,
  subtitle,
  headerRight,
  scrollBody,
  children,
  grow = false,
  style = {},
  dataGuide,
}) {
  return (
    <section data-guide={dataGuide} style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...(grow ? { flex: '1 1 auto' } : {}), ...style }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ minWidth: 0, marginRight: 12 }}>
          <h3 style={{ margin: 0, fontSize: 12, color: C.t1, fontWeight: 800, flexShrink: 0 }}>{title}</h3>
          {subtitle ? <p style={{ margin: '1px 0 4px', fontSize: 10, color: C.t3, flexShrink: 0 }}>{subtitle}</p> : null}
        </div>
        {headerRight ? <div style={{ flexShrink: 0, marginLeft: 'auto' }}>{headerRight}</div> : null}
      </div>
      <div style={scrollBody
        ? { minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '10px' }
        : { minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', padding: '10px' }}>
        {children}
      </div>
    </section>
  );
}

export function MarketsSelector({
  selected = [],
  onToggle,
  stateOptions = [],
  label = 'State',
  showSummary = true,
  selectPlaceholder = 'Select',
  selectedSummaryLabel = 'Selected',
  emptySummaryLabel = 'No states selected',
  ariaLabel = 'Operating states',
  labelStyle,
  selectStyle,
}) {
  const selectedList = Array.isArray(selected) ? selected : [];

  return (
    <div>
      <div style={{ position: 'relative', minWidth: 0 }}>
        <span style={labelStyle}>{label}</span>
        <select
          aria-label={ariaLabel}
          value={selectedList.length ? selectedList[selectedList.length - 1] : ''}
          onChange={(event) => {
            const code = event.target.value;
            if (!code) return;
            onToggle?.(code);
          }}
          style={selectStyle}
        >
          <option value="">{selectPlaceholder}</option>
          {stateOptions.map((state) => (
            <option key={`state-market-${state.code}`} value={state.code}>
              {state.name} ({state.code})
            </option>
          ))}
        </select>
      </div>
      {showSummary ? (
        <div style={{ marginTop: 6, fontSize: 10, color: C.t3 }}>
          {selectedList.length ? `${selectedSummaryLabel}: ${selectedList.join(', ')}` : emptySummaryLabel}
        </div>
      ) : null}
    </div>
  );
}
