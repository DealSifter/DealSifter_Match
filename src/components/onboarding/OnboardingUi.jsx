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
}) {
  return (
    <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...(grow ? { flex: '1 1 auto' } : {}), ...style }}>
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
