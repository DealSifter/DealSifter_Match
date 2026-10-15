import React from 'react';
import {TriangleAlert} from 'lucide-react';
import {factCopy} from './copy';
import './propertyFacts.css';
export function FactReviewIndicator({language,onClick}){
 const label=factCopy(language).warningLabel;
 const icon=<TriangleAlert size={18} strokeWidth={2} aria-hidden="true"/>;
 return onClick?<button type="button" className="property-fact-warning" aria-label={label} title={label} onClick={onClick}>{icon}</button>:<span className="property-fact-warning" role="img" aria-label={label} title={label}>{icon}</span>;
}
