import React from 'react';
import { buildMaxxisIntelligenceUpgradeExperience } from './maxxisIntelligenceUpgrade';
import './MaxxisIntelligenceUpgradeModal.css';

export function MaxxisIntelligenceUpgradeModal({ experience: suppliedExperience = null, plan = 'free', entitlements = [], requestedReportType = null, language = 'en', onRequestUnlock = null }) {
  const experience = suppliedExperience || buildMaxxisIntelligenceUpgradeExperience({ plan, entitlements, requestedReportType });
  if (!experience?.showModal) return null;
  const isPro = experience.accessLevel === 'PRO';
  const copy = language === 'pt' ? {
    title: 'MAXXIS INTELLIGENCE', intro: 'Transforme os dados do imóvel em uma análise pronta para investidores.',
    owned: isPro ? 'Seu plano PRO inclui Maxxis Analysis.' : 'Você já possui:', deeper: 'Desbloqueie inteligência mais profunda quando precisar.',
    available: 'Acesso contínuo ou avulso', preview: 'Prévia das análises adicionais', ongoing: isPro ? 'Prefere acesso contínuo? Faça upgrade para Enterprise.' : 'Prefere acesso contínuo? O plano PRO inclui Maxxis Analysis e o Enterprise inclui Deal Intelligence.', noCharge: 'O valor é debitado uma única vez para este imóvel. Reabrir o relatório não consome Nuggets.', nuggets: 'Nuggets',
  } : language === 'es' ? {
    title: 'MAXXIS INTELLIGENCE', intro: 'Transforma los datos de la propiedad en análisis listo para inversores.',
    owned: isPro ? 'Tu plan PRO incluye Maxxis Analysis.' : 'Ya tienes:', deeper: 'Desbloquea inteligencia más profunda cuando la necesites.',
    available: 'Acceso continuo o individual', preview: 'Vista previa de análisis adicionales', ongoing: isPro ? '¿Prefieres acceso continuo? Mejora a Enterprise.' : '¿Prefieres acceso continuo? PRO incluye Maxxis Analysis y Enterprise incluye Deal Intelligence.', noCharge: 'Se cobra una sola vez por propiedad. Reabrir un informe adquirido no consume Nuggets.', nuggets: 'Nuggets',
  } : {
    title: 'MAXXIS INTELLIGENCE', intro: 'Transform your property data into investor-ready analysis.',
    owned: isPro ? 'Your PRO plan includes Maxxis Analysis.' : 'You already have:', deeper: 'Unlock deeper investment intelligence when you need it.',
    available: 'Ongoing or one-time access', preview: 'Preview of additional analysis', ongoing: isPro ? 'Prefer ongoing access? Upgrade to Enterprise.' : 'Prefer ongoing access? PRO includes Maxxis Analysis and Enterprise includes Deal Intelligence.', noCharge: 'Charged once for this property. Reopening an acquired report does not consume Nuggets.', nuggets: 'Nuggets',
  };

  return <section className="maxxis-intelligence-upgrade" role="dialog" aria-label={copy.title} data-access-level={experience.accessLevel}>
    <header><small>{copy.title}</small><strong>{copy.intro}</strong><span>{copy.deeper}</span></header>
    <div className="maxxis-intelligence-current"><span>{copy.owned}</span>{experience.included.map((item) => <strong key={item.reportType}>✓ {item.title}</strong>)}</div>
    <div className="maxxis-intelligence-options">{experience.options.map((item) => <article key={item.reportType} data-report-type={item.reportType}>
      <span className="maxxis-intelligence-badge">{copy.available}</span><h4>{item.title}</h4>
      {Number(item.price) > 0 ? <strong>{item.price} {copy.nuggets}</strong> : null}
      <ul>{item.benefits.map((benefit) => <li key={benefit}>✓ {benefit}</li>)}</ul>
      {item.premiumPreview.length ? <div className="maxxis-intelligence-preview"><small>{copy.preview}</small>{item.premiumPreview.map((label) => <span key={label}>◇ {label}</span>)}</div> : null}
      <button type="button" onClick={() => onRequestUnlock?.(item.accessDecision)}>{item.actionLabel}</button>
    </article>)}</div>
    <strong className="maxxis-intelligence-ongoing">{copy.ongoing}</strong>
    <small className="maxxis-intelligence-no-charge">{copy.noCharge}</small>
  </section>;
}
