import React from 'react';
import {TriangleAlert} from 'lucide-react';
import {factCopy} from './copy';
import './propertyFacts.css';
export function FactReviewIndicator({language,onClick,variant='portfolio'}){
 const modal=variant==='modal',copy=factCopy(language),label=modal?copy.reviewCta:copy.warningLabel;
 const icon=<TriangleAlert size={modal?24:18} strokeWidth={2} aria-hidden="true"/>;
 return onClick?<button type="button" className={`property-fact-warning${modal?' property-fact-warning-cta':''}`} aria-label={label} title={label} onClick={onClick}>{icon}{modal?<span>{label}</span>:null}</button>:<span className="property-fact-warning" role="img" aria-label={label} title={label}>{icon}</span>;
}
