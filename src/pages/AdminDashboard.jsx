import React, { useState, useEffect } from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function Block({ title, children }) {
  return (
    <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden' }}>
      <div style={{ padding: '11px 13px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 800, color: C.t1 }}>{title}</div>
      <div style={{ padding: 13 }}>{children}</div>
    </section>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <span style={{ color: C.t2 }}>{label}</span>
      <strong style={{ color: C.t1 }}>{value}</strong>
    </div>
  );
}

export function AdminDashboard({ setPage, prevPage, logoutAdmin }) {
  const allT = useT('global');
  const t = allT.admin || {};
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      try {
        const [usersRes, propsRes, unlocksRes] = await Promise.all([
          supabase.from('users').select('id, created_at, is_admin', { count: 'exact', head: false }),
          supabase.from('properties').select('id, created_at', { count: 'exact', head: false }),
          supabase.from('unlocks').select('id', { count: 'exact', head: false }),
        ]);
        if (!active) return;
        setMetrics({
          totalUsers: usersRes.count ?? 0,
          totalProperties: propsRes.count ?? 0,
          totalUnlocks: unlocksRes.count ?? 0,
          admins: (usersRes.data || []).filter((u) => u.is_admin).length,
        });
      } catch {
        // ignore, show fallback
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  return (
    <div style={{ paddingTop: 58, minHeight: '100dvh', background: C.bg }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '16px 18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.t1 }}>{t.title || 'Adm.System Dashboard'}</h2>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: C.t3 }}>{t.subtitle || 'Control center for system management.'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPage?.(prevPage || 'dashboard')} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {t.backToApp || 'Back to app'}
            </button>
            <button onClick={logoutAdmin} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {t.logout || 'Admin logout'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          <Block title={t.metricsGeneral || 'General Metrics'}>
            {loading ? (
              <div style={{ fontSize: 12, color: C.t3 }}>{t.loading || 'Loading...'}</div>
            ) : metrics ? (
              <>
                <StatRow label={t.totalUsers || 'Total users'} value={metrics.totalUsers} />
                <StatRow label={t.totalProperties || 'Total properties'} value={metrics.totalProperties} />
                <StatRow label={t.totalUnlocks || 'Total unlocks'} value={metrics.totalUnlocks} />
                <StatRow label={t.adminAccounts || 'Admin accounts'} value={metrics.admins} />
              </>
            ) : (
              <div style={{ fontSize: 12, color: C.t3 }}>{t.metricsUnavailable || 'Metrics unavailable. Check Supabase connection.'}</div>
            )}
          </Block>
          <Block title={t.metricsSystem || 'System Status'}>
            <StatRow label="Supabase" value={isSupabaseConfigured ? '✓ Connected' : '✗ Not configured'} />
            <div style={{ marginTop: 12, fontSize: 11, color: C.t3 }}>
              {t.adminBetaNote || 'Admin panel is in beta. Additional controls will be added progressively.'}
            </div>
          </Block>
        </div>
      </div>
    </div>
  );
}
