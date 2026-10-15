import React from 'react';
import { BedDouble, Bath } from 'lucide-react';
import { C } from '../../theme/colors';
import { buildPortfolioPropertyFacts } from './portfolioPropertyFactsModel';
import './PortfolioPropertyFacts.css';

export function PortfolioPropertyFacts({ item, labels, language }) {
  const facts = buildPortfolioPropertyFacts(item, labels, language);
  const rooms = facts.details.filter(fact=>fact.id==='beds'||fact.id==='baths');
  return <div className="portfolio-property-facts">
    <div className="portfolio-property-summary" data-testid="matches-property-summary">
      {facts.summary.map(fact=><div key={fact.id} className="portfolio-property-metric" data-fact={fact.id}
        style={{ background:C.alpha(C[fact.tone], .08) }}>
        <div className="portfolio-property-label">{fact.label}</div>
        <div className="portfolio-property-metric-value">{fact.value}</div>
      </div>)}
    </div>
    <div className="portfolio-property-details" data-testid="matches-property-detail-grid">
      {facts.details.map(fact=>fact.id==='baths'?null:fact.id==='beds'?<div key="rooms" className="portfolio-property-detail portfolio-property-rooms" data-fact-group="rooms">
        {rooms.map(room=>{
          const RoomIcon=room.id==='beds'?BedDouble:Bath;
          return <span key={room.id} className="portfolio-property-room" data-fact={room.id}>
            <RoomIcon size={17} strokeWidth={1.7} aria-hidden="true" focusable="false" />
            <span className="portfolio-property-detail-value">{room.value}</span>
            <span className="portfolio-property-label">{room.label}</span>
          </span>;
        })}
      </div>:<div key={fact.id} className="portfolio-property-detail" data-fact={fact.id}>
        <div className="portfolio-property-label">{fact.label}</div>
        <div className="portfolio-property-detail-value">{fact.value}</div>
      </div>)}
    </div>
  </div>;
}
