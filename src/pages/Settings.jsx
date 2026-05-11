import React, { useEffect, useState } from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';
import { Icon } from '../components/ui/Icon';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { redirectToPortal } from '../lib/stripeClient';

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? C.accent : C.border}`,
        background: active ? C.alpha(C.accent, 0.12) : 'transparent',
        color: active ? C.accent : C.t2,
        borderRadius: 10,
        padding: '8px 10px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>{title}</div>
        {subtitle ? <div style={{ marginTop: 4, fontSize: 11, color: C.t3 }}>{subtitle}</div> : null}
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

export function Settings({ setPage, initialTab = 'profile', systemAccount, setSystemAccount, authSession, setAuthSession, subscription, addToast, supabaseUserId, onDeleteAccount, onRevokeConsent }) {
  const allT = useT('settings');
  const t = allT.settings || {};
  const [tab, setTab] = useState(initialTab);
  const [commPrefs, setCommPrefs] = useState({ email: true, chat: true, marketing: false });
  const activeSubscription = subscription || {
    planId: 'free',
    planName: 'Free',
    price: 0,
    status: 'active',
    nextBillingAt: null,
  };

  useEffect(() => {
    setTab(initialTab || 'profile');
  }, [initialTab]);

  const setPaymentTab = () => setTab('payments');

  const updateField = (field, value) => {
    setSystemAccount?.((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        void e;
      }
    }
    setAuthSession?.(null);
    // Clear ALL application data from localStorage
    const keysToKeep = ['theme', 'ds_lgpd_consent'];
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      allKeys.push(localStorage.key(i));
    }
    allKeys.forEach((key) => {
      if (key && !keysToKeep.includes(key)) {
        try { localStorage.removeItem(key); } catch (e) { void e; }
      }
    });
    setPage?.('landing');
  };

  const toggleComm = (key) => {
    setCommPrefs((prev) => ({ ...prev, [key]: !prev?.[key] }));
  };

  return (
    <div style={{ paddingTop: 58, minHeight: '100dvh', background: C.bg, boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.t1 }}>{t.title || 'System Settings'}</h2>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: C.t3 }}>{t.subtitle || 'Manage account, payments and support.'}</p>
          </div>
          <button onClick={() => setPage?.('dashboard')} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {t.backToApp || 'Back to app'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 14 }}>
          <TabButton active={tab === 'profile'} onClick={() => setTab('profile')} label={t.tabProfile || 'User Profile'} />
          <TabButton active={tab === 'payments'} onClick={setPaymentTab} label={t.tabPayments || 'Payments (Stripe)'} />
          <TabButton active={tab === 'communication'} onClick={() => setTab('communication')} label={t.tabCommunication || 'Communication'} />
          <TabButton active={tab === 'security'} onClick={() => setTab('security')} label={t.tabSecurity || 'Security & Access'} />
          <TabButton active={tab === 'preferences'} onClick={() => setTab('preferences')} label={t.tabPreferences || 'Preferences'} />
          <TabButton active={tab === 'privacy'} onClick={() => setTab('privacy')} label={t.tabPrivacy || 'Privacy & Data'} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {tab === 'profile' ? (
            <>
              <Panel title={t.profileTitle || 'System Account'} subtitle={t.profileSub || 'Credentials and account identity'}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.fullName || 'Full name'}</span>
                    <input value={systemAccount?.fullName || ''} onChange={(e) => updateField('fullName', e.target.value)} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 10px', background: C.bg, color: C.t1, fontSize: 12 }} />
                  </label>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.email || 'Email'}</span>
                    <input value={systemAccount?.email || ''} onChange={(e) => updateField('email', e.target.value)} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 10px', background: C.bg, color: C.t1, fontSize: 12 }} />
                  </label>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.phone || 'Phone'}</span>
                    <input value={systemAccount?.phone || ''} onChange={(e) => updateField('phone', e.target.value)} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 10px', background: C.bg, color: C.t1, fontSize: 12 }} />
                  </label>
                </div>
              </Panel>

              <Panel title={t.sessionTitle || 'Current Session'} subtitle={t.sessionSub || 'System-level session state'}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12, color: C.t2 }}>
                    {t.loggedAs || 'Logged as'}: <strong style={{ color: C.t1 }}>{authSession?.email || '-'}</strong>
                  </div>
                  <button onClick={logout} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    {t.logout || 'Sign out'}
                  </button>
                </div>
              </Panel>
            </>
          ) : null}

          {tab === 'payments' ? (
            <>
              <Panel title={t.subscriptionTitle || 'Subscription'} subtitle={t.subscriptionSub || 'Current plan and lifecycle'}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.currentPlan || 'Current plan'}: <strong style={{ color: C.t1 }}>{activeSubscription?.planName || 'Free'}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.planStatus || 'Status'}: <strong style={{ color: C.t1 }}>{activeSubscription?.status || 'active'}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.nextBilling || 'Next billing'}:{' '}
                      <strong style={{ color: C.t1 }}>
                        {activeSubscription?.nextBillingAt
                          ? new Date(activeSubscription.nextBillingAt).toLocaleDateString('en-US')
                          : (t.notApplicable || 'N/A')}
                      </strong>
                    </div>
                  </div>

                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12, color: C.t3 }}>
                    {t.stripeManaged || 'Plan changes and billing are managed via Stripe. Use the button below to access the Stripe Customer Portal.'}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await redirectToPortal();
                      } catch (err) {
                        addToast?.({ type: 'error', message: String(err?.message || 'Falha ao abrir portal Stripe.') });
                      }
                    }}
                    style={{ border: 'none', background: C.accent, color: '#fff', borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                  >
                    {t.manageStripe || 'Manage via Stripe Portal'}
                  </button>
                </div>
              </Panel>

              <Panel title={t.paymentsTitle || 'Payment Methods'} subtitle={t.paymentsSub || 'Managed by Stripe'}>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 12, color: C.t3 }}>
                  {t.paymentsManagedInfo || 'Payment methods are securely managed by Stripe. Access the portal above to add or update cards.'}
                </div>
              </Panel>
            </>
          ) : null}

          {tab === 'communication' ? (
            <>
              <Panel title={t.commTitle || 'Communication'} subtitle={t.commSub || 'Support and contact channels'}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <button style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 7, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="email" size={13} color={C.t2} /> {t.contactEmail || 'Contact by email'}
                  </button>
                  <button style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 7, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="chat" size={13} color={C.t2} /> {t.contactChat || 'Open support chat'}
                  </button>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                      <span>Email alerts</span>
                      <input type="checkbox" checked={Boolean(commPrefs?.email)} onChange={() => toggleComm('email')} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                      <span>Chat notifications</span>
                      <input type="checkbox" checked={Boolean(commPrefs?.chat)} onChange={() => toggleComm('chat')} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                      <span>Marketing updates</span>
                      <input type="checkbox" checked={Boolean(commPrefs?.marketing)} onChange={() => toggleComm('marketing')} />
                    </label>
                  </div>
                </div>
              </Panel>
            </>
          ) : null}

          {tab === 'security' ? (
            <Panel title={t.securityTitle || 'Security & Access'} subtitle={t.securitySub || 'Login password and access controls'}>
              <div style={{ fontSize: 12, color: C.t2 }}>{t.securityMockInfo || 'Security controls are mocked for now and prepared for real auth integration.'}</div>
            </Panel>
          ) : null}

          {tab === 'preferences' ? (
            <Panel title={t.preferencesTitle || 'Preferences'} subtitle={t.preferencesSub || 'Interface and notification preferences'}>
              <div style={{ fontSize: 12, color: C.t2 }}>{t.preferencesMockInfo || 'Preferences panel prepared for future persistence expansion.'}</div>
            </Panel>
          ) : null}

          {tab === 'privacy' ? (
            <>
              <Panel title={t.privacyTitle || 'Privacy & Data'} subtitle={t.privacySub || 'Manage your data in compliance with LGPD'}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12, lineHeight: '1.5', color: C.t2 }}>
                    <div style={{ fontWeight: 700, color: C.t1, marginBottom: 4 }}>Seus direitos (LGPD Art. 18)</div>
                    Você pode a qualquer momento: acessar, corrigir, excluir ou exportar seus dados pessoais.
                    Para revogar o consentimento, exclua sua conta abaixo.
                  </div>

                  <button
                    onClick={async () => {
                      if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
                        addToast?.({ type: 'error', message: 'Faça login para exportar seus dados.' });
                        return;
                      }
                      try {
                        const { data, error } = await supabase.rpc('export_user_data', { target_user_id: supabaseUserId });
                        if (error) throw error;
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `dealsifter-dados-${new Date().toISOString().slice(0, 10)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        addToast?.({ type: 'success', title: 'Dados exportados', message: 'Download iniciado com sucesso.' });
                      } catch (err) {
                        addToast?.({ type: 'error', message: String(err?.message || 'Falha ao exportar dados.') });
                      }
                    }}
                    style={{
                      border: `1px solid ${C.border}`,
                      background: 'transparent',
                      color: C.t1,
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon name="download" size={13} color={C.t1} />
                    {t.exportData || 'Exportar meus dados (JSON)'}
                  </button>

                  {onRevokeConsent && (
                    <button
                      onClick={() => {
                        if (window.confirm('Deseja revogar seu consentimento de processamento de dados? Você será redirecionado à tela inicial e precisará consentir novamente para usar a plataforma.')) {
                          onRevokeConsent();
                        }
                      }}
                      style={{
                        border: `1px solid ${C.alpha?.(C.warning || '#f59e0b', 0.5) || '#f59e0b'}`,
                        background: C.alpha?.(C.warning || '#f59e0b', 0.08) || 'transparent',
                        color: C.warning || '#f59e0b',
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Icon name="alertTriangle" size={13} color={C.warning || '#f59e0b'} />
                      Revogar consentimento (LGPD Art. 8 §5)
                    </button>
                  )}

                  <div style={{ fontSize: 11, color: C.t3 }}>
                    Contato DPO: <strong>privacidade@dealsifter.com</strong>
                  </div>
                </div>
              </Panel>

              <Panel title={t.dangerZone || 'Zona de Risco'} subtitle={t.dangerSub || 'Ações irreversíveis'}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ border: `1px solid ${C.alpha?.(C.danger || '#ef4444', 0.3) || '#ef4444'}`, borderRadius: 10, padding: 10, fontSize: 12, lineHeight: '1.5', color: C.t2 }}>
                    <div style={{ fontWeight: 700, color: C.danger || '#ef4444', marginBottom: 4 }}>Excluir minha conta</div>
                    Isso removerá permanentemente todos os seus dados: perfil, imóveis, serviços, matches,
                    desbloqueios e registros de consentimento. Esta ação <strong>não pode ser desfeita</strong>.
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Tem certeza que deseja excluir sua conta e todos os seus dados? Esta ação é IRREVERSÍVEL.')) {
                        onDeleteAccount?.();
                      }
                    }}
                    style={{
                      border: `1px solid ${C.danger || '#ef4444'}`,
                      background: C.alpha?.(C.danger || '#ef4444', 0.1) || 'transparent',
                      color: C.danger || '#ef4444',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon name="alertTriangle" size={13} color={C.danger || '#ef4444'} />
                    {t.deleteAccount || 'Excluir minha conta permanentemente'}
                  </button>
                </div>
              </Panel>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

