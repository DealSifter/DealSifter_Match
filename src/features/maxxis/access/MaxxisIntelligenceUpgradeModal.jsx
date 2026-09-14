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
    available: 'Disponível com upgrade', preview: 'Prévia das análises adicionais', noCharge: 'Valores ainda não configurados. Nenhuma cobrança ou débito será realizado.',
  } : language === 'es' ? {
    title: 'MAXXIS INTELLIGENCE', intro: 'Transforma los datos de la propiedad en análisis listo para inversores.',
    owned: isPro ? 'Tu plan PRO incluye Maxxis Analysis.' : 'Ya tienes:', deeper: 'Desbloquea inteligencia más profunda cuando la necesites.',
    available: 'Disponible con upgrade', preview: 'Vista previa de análisis adicionales', noCharge: 'Los valores aún no están configurados. No se realizará ningún cobro ni débito.',
  } : {
    title: 'MAXXIS INTELLIGENCE', intro: 'Transform your property data into investor-ready analysis.',
    owned: isPro ? 'Your PRO plan includes Maxxis Analysis.' : 'You already have:', deeper: 'Unlock deeper investment intelligence when you need it.',
    available: 'Available with upgrade', preview: 'Preview of additional analysis', noCharge: 'Values are not configured yet. No charge or debit will be made.',
  };

  return <section className="maxxis-intelligence-upgrade" role="dialog" aria-label={copy.title} data-access-level={experience.accessLevel}>
    <header><small>{copy.title}</small><strong>{copy.intro}</strong><span>{copy.deeper}</span></header>
    <div className="maxxis-intelligence-current"><span>{copy.owned}</span>{experience.included.map((item) => <strong key={item.reportType}>✓ {item.title}</strong>)}</div>
    <div className="maxxis-intelligence-options">{experience.options.map((item) => <article key={item.reportType} data-report-type={item.reportType}>
      <span className="maxxis-intelligence-badge">{copy.available}</span><h4>{item.title}</h4>
      <ul>{item.benefits.map((benefit) => <li key={benefit}>✓ {benefit}</li>)}</ul>
      {item.premiumPreview.length ? <div className="maxxis-intelligence-preview"><small>{copy.preview}</small>{item.premiumPreview.map((label) => <span key={label}>◇ {label}</span>)}</div> : null}
      <button type="button" onClick={() => onRequestUnlock?.(item.accessDecision)}>{item.actionLabel}</button>
    </article>)}</div>
    <small className="maxxis-intelligence-no-charge">{copy.noCharge}</small>
  </section>;
}
