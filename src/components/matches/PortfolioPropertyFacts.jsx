import React from 'react';
import { C } from '../../theme/colors';
import { buildPortfolioPropertyFacts } from './portfolioPropertyFactsModel';
import './PortfolioPropertyFacts.css';

export function PortfolioPropertyFacts({ item, labels, language }) {
  const facts = buildPortfolioPropertyFacts(item, labels, language);
  return <div className="portfolio-property-facts">
    <div className="portfolio-property-summary" data-testid="matches-property-summary">
      {facts.summary.map(fact=><div key={fact.id} className="portfolio-property-metric" data-fact={fact.id}
        style={{ background:C.alpha(C[fact.tone], .08) }}>
        <div className="portfolio-property-label">{fact.label}</div>
        <div className="portfolio-property-metric-value">{fact.value}</div>
      </div>)}
    </div>
    <div className="portfolio-property-details" data-testid="matches-property-detail-grid">
      {facts.details.map(fact=><div key={fact.id} className="portfolio-property-detail" data-fact={fact.id}>
        <div className="portfolio-property-label">{fact.label}</div>
        <div className="portfolio-property-detail-value">{fact.value}</div>
      </div>)}
    </div>
  </div>;
}
