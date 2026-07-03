import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';
import {
  getSupabaseFunctionUrl,
  isSupabaseConfigured,
  supabase,
  supabaseAnonKey,
} from '../lib/supabaseClient';

const fmtInt = (value) => Number(value || 0).toLocaleString('en-US');
const fmtUsd = (cents) => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtPct = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
const fmtMb = (bytes) => `${(Number(bytes || 0) / 1048576).toLocaleString('en-US', { maximumFractionDigits: 1 })} MB`;
const fmtNuggets = (value) => `${fmtInt(value)} nuggets`;
const ADMIN_KPI_ORDER_KEY = 'ds_admin_kpi_order_v1';
const ADMIN_KPI_VIEW_KEY = 'ds_admin_kpi_view_v1';

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

function readAdminKpiView() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_KPI_VIEW_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAdminKpiView(view) {
  try {
    localStorage.setItem(ADMIN_KPI_VIEW_KEY, JSON.stringify(view || {}));
  } catch {
    // Persisting chart/numeric preference is best-effort only.
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

function MiniChart({ series = [], formatter = fmtInt, emptyMessage = 'No history yet', type = 'bar' }) {
  const points = Array.isArray(series)
    ? series
        .map((point) => ({
          label: String(point?.label || ''),
          value: Number(point?.value || 0),
        }))
        .filter((point) => Number.isFinite(point.value))
        .slice(-10)
    : [];
  const maxValue = Math.max(0, ...points.map((point) => point.value));
  const pointLabelFormatter = formatter === fmtNuggets ? fmtInt : formatter;

  if (!points.length || maxValue <= 0) {
    return (
      <div style={{ height: 74, display: 'grid', placeItems: 'center', paddingTop: 12, color: C.t3, fontSize: 11, textAlign: 'center', lineHeight: 1.35 }}>
        {emptyMessage}
      </div>
    );
  }

  if (type === 'line') {
    const width = 200;
    const height = 76;
    const coords = points.map((point, idx) => {
      const x = points.length <= 1 ? width / 2 : (idx / (points.length - 1)) * width;
      const y = height - ((point.value / maxValue) * (height - 24)) - 10;
      return { ...point, x, y };
    });
    const path = coords.map((point, idx) => `${idx === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const areaPath = `${path} L${width},${height - 4} L0,${height - 4} Z`;
    return (
      <div style={{ height: 82, position: 'relative', paddingTop: 6 }}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: 74, overflow: 'visible' }}>
          <path d={areaPath} fill={C.alpha(C.accent, 0.1)} stroke="none" />
          <path d={`M0,${height - 4} L${width},${height - 4}`} stroke={C.alpha(C.t3, 0.16)} strokeWidth="1" />
          <path d={path} fill="none" stroke={C.accent} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((point, idx) => (
            <g key={idx}>
              <circle cx={point.x} cy={point.y} r="3.7" fill={idx === coords.length - 1 ? C.gold : C.accent} stroke={C.bg2 || C.card} strokeWidth="1.2" />
              <text x={point.x} y={Math.max(9, point.y - 7)} textAnchor="middle" fontSize="7.5" fontWeight="900" fill={idx === coords.length - 1 ? C.gold : C.t2}>
                {pointLabelFormatter(point.value)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (type === 'donut') {
    const total = points.reduce((sum, point) => sum + point.value, 0);
    const current = points[points.length - 1]?.value || 0;
    const pct = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
    const radius = 26;
    const circumference = 2 * Math.PI * radius;
    return (
      <div style={{ height: 82, display: 'grid', gridTemplateColumns: '82px minmax(0, 1fr)', alignItems: 'center', gap: 10 }}>
        <svg viewBox="0 0 72 72" style={{ width: 72, height: 72 }}>
          <circle cx="36" cy="36" r={radius} fill="none" stroke={C.alpha(C.accent, 0.16)} strokeWidth="10" />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke={C.accent}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
            transform="rotate(-90 36 36)"
          />
          <text x="36" y="34" textAnchor="middle" fontSize="11" fontWeight="900" fill={C.t1}>{formatter(current)}</text>
          <text x="36" y="47" textAnchor="middle" fontSize="8" fontWeight="800" fill={C.t3}>latest</text>
        </svg>
        <div style={{ display: 'grid', gap: 3 }}>
          {points.slice(-4).map((point, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 9, color: C.t3, fontWeight: 800 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{point.label}</span>
              <span style={{ color: idx === points.slice(-4).length - 1 ? C.accent : C.t2 }}>{formatter(point.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: 82, display: 'flex', alignItems: 'flex-end', gap: 4, paddingTop: 12 }}>
      {points.map((point, idx) => {
        const height = Math.max(6, Math.round((point.value / maxValue) * 100));
        return (
          <div
            key={idx}
            title={`${point.label}: ${formatter(point.value)}`}
            style={{
              flex: 1,
              height: `${height}%`,
              minWidth: 10,
              borderRadius: '6px 6px 2px 2px',
              background: idx === points.length - 1 ? C.accent : C.alpha(C.accent, 0.34),
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              overflow: 'visible',
            }}
          >
            <span
              style={{
                position: 'absolute',
                bottom: `calc(100% + 3px)`,
                left: '50%',
                transform: 'translateX(-50%) rotate(-18deg)',
                transformOrigin: 'center',
                color: idx === points.length - 1 ? C.accent : C.t3,
                fontSize: 8,
                fontWeight: 900,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
                {pointLabelFormatter(point.value)}
            </span>
          </div>
      );})}
    </div>
  );
}

function KpiTile({ id, label, value, sub, series, seriesStatus, chartFormatter = fmtInt, chartType = 'bar', viewMode, onToggleView, draggable = false, dragging = false, emptyChartMessage = 'No real history yet', onDragStart, onDragOver, onDrop, onDragEnd }) {
  const showChart = viewMode === 'chart';
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => onToggleView?.(id)}
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
        <MiniChart series={series} formatter={chartFormatter} emptyMessage={seriesStatus || emptyChartMessage} type={chartType} />
      ) : (
        <div style={{ color: C.t1, fontSize: 28, lineHeight: 1, fontWeight: 900 }}>{value}</div>
      )}
    </button>
  );
}

function GrantNuggetsPanel({ onGranted, t = {} }) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('25');
  const [reason, setReason] = useState(t.defaultGrantReason || 'Admin test credit');
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState('info');
  const [loading, setLoading] = useState(false);

  const searchUsers = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);
    setStatus('');
    setStatusKind('info');
    try {
      const { data, error } = await supabase.rpc('admin_find_users', { p_search: search, p_limit: 8 });
      if (error) throw error;
      setUsers(data || []);
      if ((data || []).length === 1) setSelected(data[0]);
    } catch (error) {
      setStatusKind('error');
      setStatus(`${t.searchFailed || 'Search failed'}: ${error?.message || t.adminRpcUnavailable || 'admin RPC unavailable'}`);
    } finally {
      setLoading(false);
    }
  };

  const grant = async () => {
    if (!selected?.id) {
      setStatus(t.selectUserFirst || 'Select a user first.');
      setStatusKind('error');
      return;
    }
    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setStatus(t.amountGreaterThanZero || 'Amount must be greater than zero.');
      setStatusKind('error');
      return;
    }
    setLoading(true);
    setStatus('');
    setStatusKind('info');
    try {
      const { data, error } = await supabase.rpc('admin_grant_nuggets', {
        p_target_user_id: selected.id,
        p_amount: parsedAmount,
        p_reason: reason || t.defaultGrantReason || 'Admin test credit',
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const newBalance = row?.new_balance ?? selected.nuggets + parsedAmount;
      setSelected((prev) => prev ? { ...prev, nuggets: newBalance } : prev);
      setUsers((prev) => prev.map((u) => u.id === selected.id ? { ...u, nuggets: newBalance } : u));
      setStatusKind('success');
      setStatus((t.grantSuccess || 'Granted {amount} nuggets. New balance: {balance}.')
        .replace('{amount}', parsedAmount)
        .replace('{balance}', newBalance));
      onGranted?.();
    } catch (error) {
      setStatusKind('error');
      setStatus(`${t.grantFailed || 'Grant failed'}: ${error?.message || t.adminRpcUnavailable || 'admin RPC unavailable'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Block title={t.grantPanelTitle || 'Admin nugget grant'}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') searchUsers(); }}
            placeholder={t.searchUserPlaceholder || 'Search user by email or name'}
            style={{ minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg, color: C.t1, padding: '9px 10px', fontSize: 12 }}
          />
          <button type="button" onClick={searchUsers} disabled={loading} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.card, color: C.t1, padding: '9px 11px', fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>
            {t.search || 'Search'}
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
                    <span style={{ display: 'block', fontSize: 10, color: C.t3 }}>{user.full_name || t.noName || 'No name'} · {user.plan_id || 'free'}</span>
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
            placeholder={t.amount || 'Amount'}
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg, color: C.t1, padding: '9px 10px', fontSize: 12 }}
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.reason || 'Reason'}
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
          {t.grantButton || 'Grant nuggets without Stripe'}
        </button>
        {status ? <div style={{ fontSize: 11, color: statusKind === 'error' ? C.danger : C.t2 }}>{status}</div> : null}
      </div>
    </Block>
  );
}

function SupportDeskPanel({ onChanged, t = {} }) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState('info');

  const loadTickets = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);
    setStatus('');
    try {
      const { data, error } = await supabase.rpc('admin_get_support_tickets', { p_status: 'all', p_limit: 30 });
      if (error) throw error;
      const list = Array.isArray(data?.tickets) ? data.tickets : [];
      setTickets(list);
      if (!selectedTicket && list.length) setSelectedTicket(list[0]);
      if (selectedTicket && !list.some((ticket) => String(ticket.id) === String(selectedTicket.id))) {
        setSelectedTicket(list[0] || null);
        setMessages([]);
      }
    } catch (error) {
      setStatusKind('error');
      setStatus(`${t.supportLoadFailed || 'Support load failed'}: ${error?.message || 'RPC unavailable'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (ticket) => {
    if (!ticket?.id || !isSupabaseConfigured || !supabase) return;
    setSelectedTicket(ticket);
    setStatus('');
    try {
      const { data, error } = await supabase.rpc('admin_get_support_thread', { p_ticket_id: ticket.id });
      if (error) throw error;
      setSelectedTicket(data?.ticket || ticket);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      await loadTickets();
    } catch (error) {
      setStatusKind('error');
      setStatus(`${t.supportThreadFailed || 'Thread failed'}: ${error?.message || 'RPC unavailable'}`);
    }
  };

  const sendReply = async (closeAfter = false, sendEmail = false) => {
    const body = String(reply || '').trim();
    if (!body || !selectedTicket?.id || !isSupabaseConfigured || !supabase) return;
    setReplying(true);
    setStatus('');
    try {
      const { data, error } = await supabase.rpc('admin_reply_support_ticket', {
        p_ticket_id: selectedTicket.id,
        p_body: body,
        p_close: closeAfter,
      });
      if (error) throw error;
      setReply('');
      setSelectedTicket(data?.ticket || selectedTicket);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      if (sendEmail) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const accessToken = sessionData?.session?.access_token;
        const functionUrl = getSupabaseFunctionUrl('send-support-email');
        if (!accessToken || !functionUrl) throw new Error(t.supportEmailUnavailable || 'Support email service unavailable.');
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticketId: selectedTicket.id,
            direction: 'admin_to_user',
            message: body,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || t.supportEmailFailed || 'Support email failed.');
      }
      setStatusKind('success');
      setStatus(sendEmail
        ? (t.supportReplyEmailSent || 'Reply sent and email delivered.')
        : (closeAfter ? (t.supportClosed || 'Ticket closed.') : (t.supportReplySent || 'Reply sent.')));
      await loadTickets();
      await onChanged?.();
    } catch (error) {
      setStatusKind('error');
      setStatus(`${t.supportReplyFailed || 'Reply failed'}: ${error?.message || 'RPC unavailable'}`);
    } finally {
      setReplying(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTickets(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const unreadTotal = tickets.reduce((sum, ticket) => sum + Number(ticket?.unreadForAdmin || 0), 0);

  return (
    <Block title={t.supportDesk || 'Support desk'}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: C.t2, fontWeight: 800 }}>
            {fmtInt(tickets.length)} {t.supportTickets || 'tickets'}
            {unreadTotal > 0 ? <span style={{ marginLeft: 6, color: C.warning || '#f59e0b' }}>{fmtInt(unreadTotal)} unread</span> : null}
          </div>
          <button onClick={loadTickets} disabled={loading} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '6px 8px', cursor: loading ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800 }}>
            {loading ? (t.loading || 'Loading...') : (t.refresh || 'Refresh')}
          </button>
        </div>

        {status ? (
          <div style={{ border: `1px solid ${statusKind === 'error' ? C.alpha(C.danger, 0.45) : C.alpha(C.accent, 0.45)}`, background: statusKind === 'error' ? C.alpha(C.danger, 0.06) : C.alpha(C.accent, 0.08), color: statusKind === 'error' ? C.danger : C.t1, borderRadius: 9, padding: 8, fontSize: 11, fontWeight: 700 }}>
            {status}
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 8, maxHeight: 210, overflowY: 'auto' }}>
          {(tickets.length ? tickets : [{ id: 'empty', contactId: 'No tickets', subject: 'No support tickets yet', status: 'none' }]).map((ticket) => {
            const active = String(ticket.id) === String(selectedTicket?.id);
            return (
              <button
                key={ticket.id}
                type="button"
                disabled={ticket.id === 'empty'}
                onClick={() => loadThread(ticket)}
                style={{ border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.alpha(C.accent, 0.1) : 'transparent', color: C.t1, borderRadius: 10, padding: 9, display: 'grid', gap: 4, textAlign: 'left', cursor: ticket.id === 'empty' ? 'default' : 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 900 }}>
                  <span>{ticket.contactId || ticket.id}</span>
                  <span style={{ color: ticket.status === 'closed' ? C.t3 : C.accent }}>{ticket.status}</span>
                </div>
                <div style={{ fontSize: 11, color: C.t2, overflowWrap: 'anywhere' }}>{ticket.userEmail || ticket.userId || '-'}</div>
                <div style={{ fontSize: 10, color: C.t3 }}>{ticket.lastMessageAt ? new Date(ticket.lastMessageAt).toLocaleString() : ''}</div>
                {Number(ticket.unreadForAdmin || 0) > 0 ? (
                  <span style={{ justifySelf: 'start', borderRadius: 999, padding: '2px 6px', background: C.warning || '#f59e0b', color: C.bg, fontSize: 9, fontWeight: 950 }}>
                    {fmtInt(ticket.unreadForAdmin)} unread
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {selectedTicket?.id ? (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: 9, borderBottom: `1px solid ${C.border}`, display: 'grid', gap: 2 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: C.t1 }}>{selectedTicket.contactId} · #{selectedTicket.ticketNumber}</div>
              <div style={{ fontSize: 10, color: C.t3, overflowWrap: 'anywhere' }}>{selectedTicket.userEmail || selectedTicket.userId}</div>
            </div>
            <div style={{ padding: 9, display: 'grid', gap: 7, maxHeight: 240, overflowY: 'auto', background: C.alpha(C.bg, 0.35) }}>
              {(messages.length ? messages : [{ id: 'none', senderRole: 'system', body: 'Open a ticket to load messages.' }]).map((message) => (
                <div key={message.id} style={{ justifySelf: message.senderRole === 'admin' ? 'end' : 'start', maxWidth: '92%', border: `1px solid ${message.senderRole === 'admin' ? C.accent : C.border}`, borderRadius: 9, padding: '7px 8px', color: C.t1, background: message.senderRole === 'admin' ? C.alpha(C.accent, 0.12) : 'transparent', fontSize: 11 }}>
                  <div style={{ color: message.senderRole === 'admin' ? C.accent : C.t3, fontSize: 9, fontWeight: 900, marginBottom: 2 }}>{message.senderRole || 'system'}</div>
                  <div style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{message.body}</div>
                  <div style={{ marginTop: 4, color: C.t3, fontSize: 9 }}>{message.createdAt ? new Date(message.createdAt).toLocaleString() : ''}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: 9, borderTop: `1px solid ${C.border}`, display: 'grid', gap: 7 }}>
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder={t.supportReplyPlaceholder || 'Write admin/support reply...'}
                rows={3}
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', resize: 'vertical', border: `1px solid ${C.border}`, borderRadius: 9, padding: 9, background: C.bg, color: C.t1, fontSize: 12 }}
              />
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={() => sendReply(false)} disabled={replying || !reply.trim()} style={{ flex: 1, border: 'none', background: C.accent, color: '#fff', borderRadius: 8, padding: '8px 9px', cursor: replying ? 'wait' : 'pointer', opacity: replying || !reply.trim() ? 0.7 : 1, fontSize: 11, fontWeight: 900 }}>
                  {replying ? (t.sending || 'Sending...') : (t.send || 'Send')}
                </button>
                <button onClick={() => sendReply(false, true)} disabled={replying || !reply.trim()} style={{ flex: 1, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 9px', cursor: replying ? 'wait' : 'pointer', opacity: replying || !reply.trim() ? 0.7 : 1, fontSize: 11, fontWeight: 900 }}>
                  {t.replyEmail || 'Reply email'}
                </button>
                <button onClick={() => sendReply(true)} disabled={replying || !reply.trim()} style={{ flex: 1, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 9px', cursor: replying ? 'wait' : 'pointer', opacity: replying || !reply.trim() ? 0.7 : 1, fontSize: 11, fontWeight: 900 }}>
                  {t.replyAndClose || 'Reply + close'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
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

function KpiSection({ title, hint, tiles, order, group, draggingId, viewModes, emptyChartMessage, onToggleView, onDragStart, onDragOverTile, onDropTile, onDragEnd }) {
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
            id={tile.id}
            label={tile.label}
            value={tile.value}
            sub={tile.sub}
            series={tile.series}
            seriesStatus={tile.seriesStatus}
            chartFormatter={tile.chartFormatter}
            chartType={tile.chartType}
            viewMode={viewModes?.[tile.id] || 'number'}
            onToggleView={onToggleView}
            emptyChartMessage={tile.emptyChartMessage || emptyChartMessage}
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
  const t = useMemo(() => allT.admin || {}, [allT.admin]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [reprocessMessage, setReprocessMessage] = useState('');
  const [draggingTile, setDraggingTile] = useState(null);
  const [kpiOrder, setKpiOrder] = useState(() => readAdminKpiOrder());
  const [kpiView, setKpiView] = useState(() => readAdminKpiView());

  const loadMetrics = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setError(t.supabaseNotConfigured || 'Supabase is not configured.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_get_dashboard_snapshot');
      if (rpcError) throw rpcError;
      setMetrics(data || {});
    } catch (err) {
      setError(err?.message || t.metricsUnavailable || 'Admin metrics unavailable. Run the latest Supabase migration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMetrics(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const tiles = useMemo(() => {
    const m = metrics || {};
    const series = m.series || {};
    const seriesStatus = m.seriesStatus || {};
    const k = t.kpis || {};
    const noHistory = t.noRealHistory || 'No real history yet';
    const checkoutClicked = Number(m.checkoutClicked30d || 0);
    const checkoutCompleted = Number(m.checkoutCompleted30d || 0);
    const checkoutAbandoned = Math.max(0, checkoutClicked - checkoutCompleted);
    const checkoutAbandonedSeries = [
      { label: k.started || 'Started', value: checkoutClicked },
      { label: k.abandoned || 'Abandoned', value: checkoutAbandoned },
      { label: k.paid || 'Paid', value: checkoutCompleted },
    ];
    return {
      users: [
        { id: 'active-now', label: k.activeNow || 'Active now', value: fmtInt(m.activeUsersNow), sub: k.last5Min || 'last 5 min', series: series['active-now'], seriesStatus: seriesStatus['active-now'], emptyChartMessage: noHistory, chartType: 'bar' },
        { id: 'total-users', label: k.totalUsers || 'Total users', value: fmtInt(m.totalUsers), sub: k.allTime || 'all time', series: series['total-users'], chartType: 'line' },
        { id: 'new-users', label: k.newUsers || 'New users', value: `${fmtInt(m.newUsersDay)} / ${fmtInt(m.newUsersWeek)} / ${fmtInt(m.newUsersMonth)}`, sub: k.dayWeekMonth || 'day / week / month', series: series['new-users'], chartType: 'bar' },
        { id: 'deleted-users', label: k.deletedUsers || 'Deleted users', value: `${fmtInt(m.deletedUsersDay)} / ${fmtInt(m.deletedUsersWeek)} / ${fmtInt(m.deletedUsersMonth)}`, sub: k.dayWeekMonth || 'day / week / month', series: series['deleted-users'], chartType: 'bar' },
        { id: 'activation-funnel', label: k.activationFunnel || 'Activation funnel', value: fmtPct(m.activationRate), sub: k.usersWithCard || 'users with at least one card', series: series['activation-funnel'], chartType: 'donut' },
        { id: 'free-plan-pressure', label: k.freePlanPressure || 'Free plan pressure', value: fmtInt(m.freePlanPressureTotal), sub: (k.clickedUpgrade || '{rate} clicked upgrade').replace('{rate}', fmtPct(m.freePlanUpgradeRate)), series: series['free-plan-pressure'], chartType: 'bar' },
        { id: 'checkout-dropoff', label: k.checkoutDropoff || 'Checkout drop-off', value: fmtPct(m.checkoutCompletionRate), sub: (k.paidClicked || '{paid} paid / {clicked} clicked').replace('{paid}', fmtInt(m.checkoutCompleted30d)).replace('{clicked}', fmtInt(m.checkoutClicked30d)), series: series['checkout-dropoff'], chartType: 'donut' },
        { id: 'card-health', label: k.cardHealth || 'Card health', value: fmtPct(m.cardHealthPct), sub: (k.cardHealthSub || '{needs} need attention / {total} total').replace('{needs}', fmtInt(m.cardHealthNeedsAttention)).replace('{total}', fmtInt(m.cardHealthTotal)), series: series['card-health'], chartType: 'donut' },
        { id: 'unlocks', label: k.unlocks || 'Unlocks', value: fmtInt(m.totalUnlocks), sub: (k.usersCount || '{count} users').replace('{count}', fmtInt(m.usersWithUnlocks)), series: series.unlocks, chartType: 'line' },
        { id: 'swipes-today', label: k.swipesToday || 'Swipes today', value: fmtInt(m.swipesToday), sub: k.last10Days || 'last 10 days', series: series['swipes-today'], chartType: 'bar' },
        { id: 'packs-revenue', label: k.packsRevenue || 'Packs revenue', value: fmtUsd(m.packRevenueUsdCents), sub: `${fmtInt(m.packPurchasesCompleted)} packs · ${fmtInt(m.nuggetsPurchased)} ${k.nuggets || 'nuggets'}`, series: series['packs-revenue'], chartFormatter: fmtUsd, chartType: 'line' },
        { id: 'subscriptions', label: k.subscriptions || 'Subscriptions', value: fmtUsd(m.subscriptionRevenueUsdCents), sub: `${fmtInt(m.activeSubscriptions)} ${k.paidActive || 'paid active'}`, series: series.subscriptions, chartType: 'line' },
        { id: 'abandoned-cart', label: k.abandonedCart || 'Abandoned cart', value: fmtInt(checkoutAbandoned), sub: `${fmtInt(checkoutCompleted)} ${k.paid || 'paid'} / ${fmtInt(checkoutClicked)} ${k.started || 'started'}`, series: checkoutAbandonedSeries, chartType: 'donut' },
        { id: 'manual-grants', label: k.manualGrants || 'Manual grants', value: fmtNuggets(m.manualNuggetsGranted), sub: `${fmtInt(m.manualNuggetsGrantedToday)} ${k.today || 'today'}`, series: series['manual-grants'], chartFormatter: fmtNuggets, chartType: 'bar' },
        { id: 'support-msgs', label: k.supportMsgs || 'Support msgs', value: fmtInt(m.supportMessagesToday), sub: k.last10Days || 'last 10 days', series: series['support-msgs'], chartType: 'bar' },
        { id: 'highlights', label: k.highlights || 'Highlights', value: fmtNuggets(m.highlightsNuggetsSpent), sub: `${fmtInt(m.highlightsActive)} active · ${fmtInt(m.highlightsPurchasedToday)} ${k.today || 'today'}`, series: series.highlights, chartFormatter: fmtNuggets, chartType: 'bar' },
        { id: 'exclusive-contacts', label: k.exclusiveContacts || 'Exclusive contacts', value: fmtInt(m.exclusiveContactsTotal), sub: `${fmtInt(m.exclusiveContactsToday)} ${k.today || 'today'} · ${fmtNuggets(m.exclusiveContactsNuggetsSpent)}`, series: series['exclusive-contacts'], chartFormatter: fmtInt, chartType: 'bar' },
        { id: 'properties', label: k.properties || 'Properties', value: fmtInt(m.totalProperties), sub: k.publishedSaved || 'published + saved', series: series.properties, chartType: 'line' },
      ],
      system: [
        { id: 'db-storage-guardrail', label: k.dbGuardrail || 'DB guardrail', value: fmtPct(m.dbUsagePct), sub: `${fmtMb(m.dbSizeBytes)} / ${fmtMb(m.dbLimitBytes)}`, series: series['db-storage-guardrail'], seriesStatus: seriesStatus['db-storage-guardrail'], chartFormatter: (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })} MB`, chartType: 'donut' },
        { id: 'stripe-issues', label: k.stripeIssues || 'Stripe issues', value: fmtInt(m.stripeIssuesDay), sub: k.last10Days || 'last 10 days', series: series['stripe-issues'], chartType: 'bar' },
        { id: 'stripe-webhook-skips', label: k.stripeWebhookSkips || 'Stripe webhook skips', value: fmtInt(m.stripeWebhookSkippedDay), sub: k.last24h || 'last 24h', series: series['stripe-webhook-skips'], chartType: 'bar' },
        { id: 'supabase-issues', label: k.supabaseIssues || 'Supabase issues', value: fmtInt(m.supabaseIssuesDay), sub: k.last10Days || 'last 10 days', series: series['supabase-issues'], chartType: 'bar' },
        { id: 'admin-accounts', label: k.adminAccounts || 'Admin accounts', value: fmtInt(m.adminAccounts), sub: k.restricted || 'restricted', series: series['admin-accounts'], chartType: 'donut' },
      ],
    };
  }, [metrics, t]);

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
  const handleToggleKpiView = (id) => {
    if (!id) return;
    setKpiView((prev) => {
      const next = {
        ...(prev || {}),
        [id]: prev?.[id] === 'chart' ? 'number' : 'chart',
      };
      writeAdminKpiView(next);
      return next;
    });
  };

  const handleStripeQueueReprocess = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setReprocessMessage(t.supabaseNotConfigured || 'Supabase is not configured.');
      return;
    }
    setReprocessLoading(true);
    setReprocessMessage('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error(t.adminSessionRequired || 'Admin session required.');
      const functionUrl = getSupabaseFunctionUrl('stripe-reprocess-queue');
      if (!functionUrl) throw new Error(t.supabaseNotConfigured || 'Supabase is not configured.');

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: 'admin_dashboard' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t.stripeReprocessFailed || 'Stripe queue reprocess failed.');

      setReprocessMessage(
        (t.stripeReprocessSummary || 'Stripe queue processed: {processed} processed, {retried} retried, {failed} failed.')
          .replace('{processed}', fmtInt(payload.processed))
          .replace('{retried}', fmtInt(payload.retried))
          .replace('{failed}', fmtInt(payload.failed))
      );
      await loadMetrics();
    } catch (err) {
      setReprocessMessage(err?.message || t.stripeReprocessFailed || 'Stripe queue reprocess failed.');
    } finally {
      setReprocessLoading(false);
    }
  };

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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={handleStripeQueueReprocess} disabled={reprocessLoading} style={{ border: `1px solid ${Number(metrics?.stripeReprocessPending || 0) > 0 ? C.warning || '#f59e0b' : C.border}`, background: Number(metrics?.stripeReprocessPending || 0) > 0 ? C.alpha(C.warning || '#f59e0b', 0.1) : 'transparent', color: Number(metrics?.stripeReprocessPending || 0) > 0 ? C.warning || '#f59e0b' : C.t2, borderRadius: 8, padding: '8px 10px', cursor: reprocessLoading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: reprocessLoading ? 0.75 : 1 }}>
              {reprocessLoading ? (t.reprocessingStripeQueue || 'Reprocessing...') : (t.reprocessStripeQueue || 'Reprocessar fila Stripe')}
              {Number(metrics?.stripeReprocessPending || 0) > 0 ? (
                <span style={{ minWidth: 18, height: 18, borderRadius: 999, display: 'inline-grid', placeItems: 'center', background: C.warning || '#f59e0b', color: C.bg, fontSize: 10, fontWeight: 950 }}>
                  {fmtInt(metrics.stripeReprocessPending)}
                </span>
              ) : null}
            </button>
            <button onClick={loadMetrics} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {t.refresh || 'Refresh'}
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

        {reprocessMessage ? (
          <div style={{ marginBottom: 12, border: `1px solid ${C.alpha(reprocessMessage.toLowerCase().includes('fail') || reprocessMessage.toLowerCase().includes('erro') ? C.danger : C.accent, 0.45)}`, borderRadius: 12, padding: 12, color: C.t1, background: C.alpha(reprocessMessage.toLowerCase().includes('fail') || reprocessMessage.toLowerCase().includes('erro') ? C.danger : C.accent, 0.07), fontSize: 12, fontWeight: 700 }}>
            {reprocessMessage}
          </div>
        ) : null}

        {Number(metrics?.stripeReprocessPending || 0) > 0 ? (
          <div style={{ marginBottom: 12, border: `1px solid ${C.alpha(C.warning || '#f59e0b', 0.5)}`, borderRadius: 12, padding: 12, background: C.alpha(C.warning || '#f59e0b', 0.08), color: C.t1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <strong style={{ fontSize: 13 }}>{t.stripeReprocessPendingTitle || 'Stripe reprocess queue pending'}</strong>
              <span style={{ fontSize: 11, color: C.t2 }}>{t.stripeReprocessPendingHint || 'Run the manual reprocessor or check the Stripe runbook if the count does not clear.'}</span>
            </div>
            <span style={{ borderRadius: 999, padding: '5px 9px', background: C.warning || '#f59e0b', color: C.bg, fontSize: 11, fontWeight: 950 }}>
              {fmtInt(metrics.stripeReprocessPending)}
            </span>
          </div>
        ) : null}

        {Array.isArray(metrics?.stripeWebhookAlerts) && metrics.stripeWebhookAlerts.length ? (
          <div style={{ marginBottom: 12, border: `1px solid ${C.alpha(C.warning || '#f59e0b', 0.5)}`, borderRadius: 12, padding: 12, background: C.alpha(C.warning || '#f59e0b', 0.08), display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <strong style={{ color: C.t1, fontSize: 13 }}>{t.stripeWebhookAlerts || 'Stripe webhook alerts'}</strong>
              <span style={{ color: C.warning || '#f59e0b', fontSize: 11, fontWeight: 900 }}>{fmtInt(metrics.stripeWebhookSkippedDay)} {t.last24h || 'last 24h'}</span>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {metrics.stripeWebhookAlerts.slice(0, 4).map((alert) => (
                <div key={`${alert.eventId}-${alert.receivedAt}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 220px) minmax(0, 1fr) auto', gap: 8, alignItems: 'center', fontSize: 11, color: C.t2 }}>
                  <span style={{ fontWeight: 900, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.eventType || 'stripe.event'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.skipReason || 'skipped'}</span>
                  <span style={{ color: C.t3, fontVariantNumeric: 'tabular-nums' }}>{alert.receivedAt ? new Date(alert.receivedAt).toLocaleString() : ''}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="admin-workspace">
          <Block title={loading ? (t.loadingKpis || 'Loading KPIs...') : (t.kpiWorkspace || 'KPI workspace')}>
            <div className="admin-kpi-panel" style={{ display: 'grid', gap: 16 }}>
              <KpiSection
                title={t.userKpis || 'User KPIs'}
                hint={t.dragCardsHint || 'Drag cards to customize your view'}
                tiles={tiles.users}
                order={kpiOrder.users}
                group="users"
                draggingId={draggingTile}
                viewModes={kpiView}
                emptyChartMessage={t.noRealHistory || 'No real history yet'}
                onToggleView={handleToggleKpiView}
                onDragStart={handleDragStart}
                onDragOverTile={handleDragOverTile}
                onDropTile={handleDropTile}
                onDragEnd={handleDragEnd}
              />
              <KpiSection
                title={t.systemKpis || 'System KPIs'}
                hint={t.systemKpisHint || 'Stripe, Supabase and admin controls'}
                tiles={tiles.system}
                order={kpiOrder.system}
                group="system"
                draggingId={draggingTile}
                viewModes={kpiView}
                emptyChartMessage={t.noRealHistory || 'No real history yet'}
                onToggleView={handleToggleKpiView}
                onDragStart={handleDragStart}
                onDragOverTile={handleDragOverTile}
                onDropTile={handleDropTile}
                onDragEnd={handleDragEnd}
              />
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: C.t3 }}>
              {t.kpiHelp || 'Click a card to alternate between number and compact chart. Drag/drop works inside each KPI section and is saved locally.'}
            </div>
          </Block>
          <div style={{ display: 'grid', gap: 12 }}>
            <SupportDeskPanel onChanged={loadMetrics} t={t} />
            <GrantNuggetsPanel onGranted={loadMetrics} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}


