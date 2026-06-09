import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const fmtInt = (value) => Number(value || 0).toLocaleString('en-US');
const fmtUsd = (cents) => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

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

function KpiTile({ label, value, sub }) {
  const [showChart, setShowChart] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setShowChart((prev) => !prev)}
      style={{
        minHeight: 132,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        background: C.bg2 || C.card,
        padding: 12,
        textAlign: 'left',
        cursor: 'pointer',
        display: 'grid',
        alignContent: 'space-between',
        gap: 8,
      }}
    >
      <div>
        <div style={{ color: C.t2, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
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

export function AdminDashboard({ setPage, prevPage, logoutAdmin }) {
  const allT = useT('global');
  const t = allT.admin || {};
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    return [
      ['Active now', fmtInt(m.activeUsersNow), 'last 5 min'],
      ['Total users', fmtInt(m.totalUsers), 'all time'],
      ['New users', `${fmtInt(m.newUsersDay)} / ${fmtInt(m.newUsersWeek)} / ${fmtInt(m.newUsersMonth)}`, 'day / week / month'],
      ['Deleted users', '0 / 0 / 0', 'day / week / month'],
      ['Unlocks', fmtInt(m.totalUnlocks), `${fmtInt(m.usersWithUnlocks)} users`],
      ['Swipes today', fmtInt(m.swipesToday), 'tracking starts now'],
      ['Packs revenue', fmtUsd(m.packRevenueUsdCents), `${fmtInt(m.nuggetsPurchased)} nuggets`],
      ['Subscriptions', fmtInt(m.activeSubscriptions), fmtUsd(m.subscriptionRevenueUsdCents)],
      ['Manual grants', fmtInt(m.manualNuggetsGranted), `${fmtInt(m.manualNuggetsGrantedToday)} today`],
      ['Support msgs', fmtInt(m.supportMessagesToday), 'today'],
      ['Highlights', fmtInt(m.highlightsActive), `${fmtInt(m.highlightsPurchasedToday)} bought today`],
      ['Exclusive contacts', fmtInt(m.exclusiveContactsToday), 'today'],
      ['Stripe issues', fmtInt(m.stripeIssuesDay), 'last 24h'],
      ['Supabase issues', fmtInt(m.supabaseIssuesDay), 'last 24h'],
      ['Properties', fmtInt(m.totalProperties), 'published + saved'],
      ['Admin accounts', fmtInt(m.adminAccounts), 'restricted'],
    ];
  }, [metrics]);

  return (
    <div style={{ paddingTop: 58, minHeight: 'calc(var(--app-vh, 1vh) * 100)', background: C.bg }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '16px 18px 24px' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 12, alignItems: 'start' }}>
          <GrantNuggetsPanel onGranted={loadMetrics} />
          <Block title={loading ? 'Loading KPIs...' : 'General KPIs'}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {tiles.map(([label, value, sub]) => (
                <KpiTile key={label} label={label} value={value} sub={sub} />
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: C.t3 }}>
              Charts are compact placeholders for monthly trend windows. Event-based metrics start filling after tracking is enabled.
            </div>
          </Block>
        </div>
      </div>
    </div>
  );
}
