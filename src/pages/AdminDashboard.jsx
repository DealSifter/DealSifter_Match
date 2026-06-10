import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const fmtInt = (value) => Number(value || 0).toLocaleString('en-US');
const fmtUsd = (cents) => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const ADMIN_KPI_ORDER_KEY = 'ds_admin_kpi_order_v1';

function readAdminKpiOrder() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_KPI_ORDER_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAdminKpiOrder(order) {
  try {
    localStorage.setItem(ADMIN_KPI_ORDER_KEY, JSON.stringify(order || {}));
  } catch {
    // Persisting the visual order is best-effort only.
  }
}

function Block({ title, children }) {
  return (
    <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden' }}>
      <div style={{ padding: '11px 13px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 800, color: C.t1 }}>{title}</div>
      <div style={{ padding: 13 }}>{children}</div>
    </section>
  );
}

function MiniBars({ value = 0 }) {
  const seed = Math.max(1, Number(value || 0));
  const points = Array.from({ length: 12 }, (_, idx) => {
    const wave = Math.abs(Math.sin((idx + 1) * 0.9) * 0.55 + Math.cos((idx + 2) * 0.37) * 0.45);
    return Math.max(10, Math.round((seed ? Math.min(100, 18 + wave * 82) : 10)));
  });
  return (
    <div style={{ height: 74, display: 'flex', alignItems: 'flex-end', gap: 4, paddingTop: 12 }}>
      {points.map((height, idx) => (
        <div
          key={idx}
          title={`M${idx + 1}`}
          style={{
            flex: 1,
            height: `${height}%`,
            minWidth: 4,
            borderRadius: '5px 5px 2px 2px',
            background: idx === points.length - 1 ? C.accent : C.alpha(C.accent, 0.34),
          }}
        />
      ))}
    </div>
  );
}

function KpiTile({ label, value, sub, draggable = false, dragging = false, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [showChart, setShowChart] = useState(false);
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => setShowChart((prev) => !prev)}
      style={{
        minHeight: 132,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        background: C.bg2 || C.card,
        padding: 12,
        textAlign: 'left',
        cursor: draggable ? 'grab' : 'pointer',
        display: 'grid',
        alignContent: 'space-between',
        gap: 8,
        opacity: dragging ? 0.48 : 1,
        outline: dragging ? `2px dashed ${C.accent}` : 'none',
        outlineOffset: -4,
        transition: 'opacity .12s ease, transform .12s ease, border-color .12s ease',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ color: C.t2, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
          {draggable ? <span aria-hidden="true" style={{ color: C.t3, fontSize: 14, lineHeight: 1, letterSpacing: -1 }}>::</span> : null}
        </div>
        {sub ? <div style={{ color: C.t3, fontSize: 10, marginTop: 2 }}>{sub}</div> : null}
      </div>
      {showChart ? (
        <MiniBars value={value} />
      ) : (
        <div style={{ color: C.t1, fontSize: 28, lineHeight: 1, fontWeight: 900 }}>{value}</div>
      )}
    </button>
  );
}

function GrantNuggetsPanel({ onGranted }) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('25');
  const [reason, setReason] = useState('Admin test credit');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const searchUsers = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);
    setStatus('');
    try {
      const { data, error } = await supabase.rpc('admin_find_users', { p_search: search, p_limit: 8 });
      if (error) throw error;
      setUsers(data || []);
      if ((data || []).length === 1) setSelected(data[0]);
    } catch (error) {
      setStatus(`Search failed: ${error?.message || 'admin RPC unavailable'}`);
    } finally {
      setLoading(false);
    }
  };

  const grant = async () => {
    if (!selected?.id) {
      setStatus('Select a user first.');
      return;
    }
    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setStatus('Amount must be greater than zero.');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const { data, error } = await supabase.rpc('admin_grant_nuggets', {
        p_target_user_id: selected.id,
        p_amount: parsedAmount,
        p_reason: reason || 'Admin test credit',
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const newBalance = row?.new_balance ?? selected.nuggets + parsedAmount;
      setSelected((prev) => prev ? { ...prev, nuggets: newBalance } : prev);
      setUsers((prev) => prev.map((u) => u.id === selected.id ? { ...u, nuggets: newBalance } : u));
      setStatus(`Granted ${parsedAmount} nuggets. New balance: ${newBalance}.`);
      onGranted?.();
    } catch (error) {
      setStatus(`Grant failed: ${error?.message || 'admin RPC unavailable'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Block title="Admin nugget grant">
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') searchUsers(); }}
            placeholder="Search user by email or name"
            style={{ minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg, color: C.t1, padding: '9px 10px', fontSize: 12 }}
          />
          <button type="button" onClick={searchUsers} disabled={loading} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.card, color: C.t1, padding: '9px 11px', fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>
            Search
          </button>
        </div>

        {users.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {users.map((user) => {
              const active = selected?.id === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelected(user)}
                  style={{
                    border: `1px solid ${active ? C.accent : C.border}`,
                    background: active ? C.alpha(C.accent, 0.12) : 'transparent',
                    color: C.t1,
                    borderRadius: 10,
                    padding: 9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</strong>
                    <span style={{ display: 'block', fontSize: 10, color: C.t3 }}>{user.full_name || 'No name'} · {user.plan_id || 'free'}</span>
                  </span>
                  <strong style={{ color: C.gold, fontSize: 12 }}>{fmtInt(user.nuggets)} nuggets</strong>
                </button>
              );
            })}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 8 }}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder="Amount"
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg, color: C.t1, padding: '9px 10px', fontSize: 12 }}
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            maxLength={280}
            style={{ minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg, color: C.t1, padding: '9px 10px', fontSize: 12 }}
          />
        </div>
        <button
          type="button"
          onClick={grant}
          disabled={loading || !selected}
          style={{ border: 'none', borderRadius: 11, background: C.accent, color: '#fff', padding: '10px 12px', fontSize: 12, fontWeight: 900, cursor: loading || !selected ? 'not-allowed' : 'pointer', opacity: loading || !selected ? 0.55 : 1 }}
        >
          Grant nuggets without Stripe
        </button>
        {status ? <div style={{ fontSize: 11, color: status.includes('failed') ? C.danger : C.t2 }}>{status}</div> : null}
      </div>
    </Block>
  );
}

function SectionDivider({ title, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${C.border})` }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: C.t1, letterSpacing: 0.7, textTransform: 'uppercase' }}>{title}</div>
        {hint ? <div style={{ fontSize: 9, color: C.t3, marginTop: 1 }}>{hint}</div> : null}
      </div>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.border}, transparent)` }} />
    </div>
  );
}

function KpiSection({ title, hint, tiles, order, group, draggingId, onDragStart, onDragOverTile, onDropTile, onDragEnd }) {
  const ordered = [
    ...(order || []).map((id) => tiles.find((tile) => tile.id === id)).filter(Boolean),
    ...(tiles || []).filter((tile) => !(order || []).includes(tile.id)),
  ];

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <SectionDivider title={title} hint={hint} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))',
          gap: 10,
        }}
      >
        {ordered.map((tile) => (
          <KpiTile
            key={tile.id}
            label={tile.label}
            value={tile.value}
            sub={tile.sub}
            draggable
            dragging={draggingId === tile.id}
            onDragStart={(event) => onDragStart(event, group, tile.id)}
            onDragOver={(event) => onDragOverTile(event)}
            onDrop={(event) => onDropTile(event, group, tile.id, ordered)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

export function AdminDashboard({ setPage, prevPage, logoutAdmin }) {
  const allT = useT('global');
  const t = allT.admin || {};
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draggingTile, setDraggingTile] = useState(null);
  const [kpiOrder, setKpiOrder] = useState(() => readAdminKpiOrder());

  const loadMetrics = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setError('Supabase is not configured.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_get_dashboard_snapshot');
      if (rpcError) throw rpcError;
      setMetrics(data || {});
    } catch (err) {
      setError(err?.message || 'Admin metrics unavailable. Run the latest Supabase migration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const tiles = useMemo(() => {
    const m = metrics || {};
    return {
      users: [
        { id: 'active-now', label: 'Active now', value: fmtInt(m.activeUsersNow), sub: 'last 5 min' },
        { id: 'total-users', label: 'Total users', value: fmtInt(m.totalUsers), sub: 'all time' },
        { id: 'new-users', label: 'New users', value: `${fmtInt(m.newUsersDay)} / ${fmtInt(m.newUsersWeek)} / ${fmtInt(m.newUsersMonth)}`, sub: 'day / week / month' },
        { id: 'deleted-users', label: 'Deleted users', value: '0 / 0 / 0', sub: 'day / week / month' },
        { id: 'unlocks', label: 'Unlocks', value: fmtInt(m.totalUnlocks), sub: `${fmtInt(m.usersWithUnlocks)} users` },
        { id: 'swipes-today', label: 'Swipes today', value: fmtInt(m.swipesToday), sub: 'tracking starts now' },
        { id: 'packs-revenue', label: 'Packs revenue', value: fmtUsd(m.packRevenueUsdCents), sub: `${fmtInt(m.nuggetsPurchased)} nuggets` },
        { id: 'subscriptions', label: 'Subscriptions', value: fmtInt(m.activeSubscriptions), sub: fmtUsd(m.subscriptionRevenueUsdCents) },
        { id: 'manual-grants', label: 'Manual grants', value: fmtInt(m.manualNuggetsGranted), sub: `${fmtInt(m.manualNuggetsGrantedToday)} today` },
        { id: 'support-msgs', label: 'Support msgs', value: fmtInt(m.supportMessagesToday), sub: 'today' },
        { id: 'highlights', label: 'Highlights', value: fmtInt(m.highlightsActive), sub: `${fmtInt(m.highlightsPurchasedToday)} bought today` },
        { id: 'exclusive-contacts', label: 'Exclusive contacts', value: fmtInt(m.exclusiveContactsToday), sub: 'today' },
        { id: 'properties', label: 'Properties', value: fmtInt(m.totalProperties), sub: 'published + saved' },
      ],
      system: [
        { id: 'stripe-issues', label: 'Stripe issues', value: fmtInt(m.stripeIssuesDay), sub: 'last 24h' },
        { id: 'supabase-issues', label: 'Supabase issues', value: fmtInt(m.supabaseIssuesDay), sub: 'last 24h' },
        { id: 'admin-accounts', label: 'Admin accounts', value: fmtInt(m.adminAccounts), sub: 'restricted' },
      ],
    };
  }, [metrics]);

  const handleDragStart = (event, group, id) => {
    setDraggingTile(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify({ group, id }));
  };

  const handleDragOverTile = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDropTile = (event, targetGroup, targetId, orderedTiles) => {
    event.preventDefault();
    let payload = null;
    try {
      payload = JSON.parse(event.dataTransfer.getData('application/json') || '{}');
    } catch {
      payload = null;
    }
    if (!payload?.id || payload.group !== targetGroup || payload.id === targetId) {
      setDraggingTile(null);
      return;
    }

    const currentOrder = (kpiOrder[targetGroup] && kpiOrder[targetGroup].length)
      ? kpiOrder[targetGroup]
      : orderedTiles.map((tile) => tile.id);
    const withoutDragged = currentOrder.filter((id) => id !== payload.id);
    const targetIndex = Math.max(0, withoutDragged.indexOf(targetId));
    const nextOrder = [
      ...withoutDragged.slice(0, targetIndex),
      payload.id,
      ...withoutDragged.slice(targetIndex),
    ];
    const next = { ...kpiOrder, [targetGroup]: nextOrder };
    setKpiOrder(next);
    writeAdminKpiOrder(next);
    setDraggingTile(null);
  };

  const handleDragEnd = () => setDraggingTile(null);

  return (
    <div style={{ paddingTop: 58, minHeight: 'calc(var(--app-vh, 1vh) * 100)', background: C.bg }}>
      <style>{`
        .admin-shell {
          max-width: 1520px;
          margin: 0 auto;
          padding: 16px 18px 24px;
        }
        .admin-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
          gap: 12px;
          align-items: start;
        }
        .admin-kpi-panel {
          min-width: 0;
        }
        @media (max-width: 1100px) {
          .admin-workspace {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="admin-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.t1 }}>{t.title || 'Adm.System Dashboard'}</h2>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: C.t3 }}>{t.subtitle || 'Control center for system management.'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadMetrics} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              Refresh
            </button>
            <button onClick={() => setPage?.(prevPage || 'dashboard')} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {t.backToApp || 'Back to app'}
            </button>
            <button onClick={logoutAdmin} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {t.logout || 'Admin logout'}
            </button>
          </div>
        </div>

        {error ? (
          <div style={{ marginBottom: 12, border: `1px solid ${C.alpha(C.danger, 0.45)}`, borderRadius: 12, padding: 12, color: C.danger, background: C.alpha(C.danger, 0.06), fontSize: 12 }}>
            {error}
          </div>
        ) : null}

        <div className="admin-workspace">
          <Block title={loading ? 'Loading KPIs...' : 'KPI workspace'}>
            <div className="admin-kpi-panel" style={{ display: 'grid', gap: 16 }}>
              <KpiSection
                title="User KPIs"
                hint="Drag cards to customize your view"
                tiles={tiles.users}
                order={kpiOrder.users}
                group="users"
                draggingId={draggingTile}
                onDragStart={handleDragStart}
                onDragOverTile={handleDragOverTile}
                onDropTile={handleDropTile}
                onDragEnd={handleDragEnd}
              />
              <KpiSection
                title="System KPIs"
                hint="Stripe, Supabase and admin controls"
                tiles={tiles.system}
                order={kpiOrder.system}
                group="system"
                draggingId={draggingTile}
                onDragStart={handleDragStart}
                onDragOverTile={handleDragOverTile}
                onDropTile={handleDropTile}
                onDragEnd={handleDragEnd}
              />
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: C.t3 }}>
              Click a card to alternate between number and compact chart. Drag/drop works inside each KPI section and is saved locally.
            </div>
          </Block>
          <div style={{ display: 'grid', gap: 12 }}>
            <GrantNuggetsPanel onGranted={loadMetrics} />
          </div>
        </div>
      </div>
    </div>
  );
}
