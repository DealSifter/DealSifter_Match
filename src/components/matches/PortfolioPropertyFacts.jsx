import React from 'react';
import { BedDouble, Bath } from 'lucide-react';
import { C } from '../../theme/colors';
import { buildPortfolioPropertyFacts } from './portfolioPropertyFactsModel';
import './PortfolioPropertyFacts.css';
import {usePropertyFactReview} from '../../features/propertyFacts/PropertyFactReviewContext';
import {factCopy} from '../../features/propertyFacts/copy';

export function PortfolioPropertyFacts({ item, labels, language }) {
  const review=usePropertyFactReview(),copy=factCopy(language);
  const facts = buildPortfolioPropertyFacts(item, labels, language, review?.facts[item.id]||{});
  const canReview=review?.ownedProperties.has(String(item.id));
  const display=fact=>fact.conflict&&canReview?<button type="button" aria-label={`${copy.review}: ${fact.label}`} onClick={()=>review.open(item.id,fact.field)}>{fact.value} ⚠</button>:fact.value;
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
            <span className="portfolio-property-detail-value">{display(room)}</span>
            <span className="portfolio-property-label">{room.label}</span>
          </span>;
        })}
      </div>:<div key={fact.id} className="portfolio-property-detail" data-fact={fact.id}>
        <div className="portfolio-property-label">{fact.label}</div>
        <div className="portfolio-property-detail-value">{display(fact)}</div>
      </div>)}
    </div>
    {canReview?<button type="button" className="portfolio-fact-review-action" onClick={()=>review.open(item.id)}>{copy.review}</button>:null}
  </div>;
}
