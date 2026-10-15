import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { translations } from '../../i18n/translations';
import { PortfolioPropertyFacts } from './PortfolioPropertyFacts';
import { buildPortfolioPropertyFacts, formatPortfolioArea } from './portfolioPropertyFactsModel';

const property={type:'SFR',objective:'Sell',price:90000,capRate:null,rehab:35000,beds:3,baths:2,sqft:1760,zip:'72204',lot:'5000'};
describe('portfolio property fact presentation',()=>{
  it.each(['pt','en','es'])('renders complete, unique labels and units in %s',language=>{
    const labels=translations[language].matches;
    const model=buildPortfolioPropertyFacts(property,labels,language);
    const fields=[...model.summary,...model.details];
    expect(new Set(fields.map(field=>field.id)).size).toBe(fields.length);
    expect(fields.every(field=>typeof field.label==='string'&&field.label.trim().length>0)).toBe(true);
    expect(model.details.some(field=>['rehab','capRate','price'].includes(field.id))).toBe(false);
    expect(fields.find(field=>field.id==='buildingArea').value).toContain('sqft');
    expect(fields.find(field=>field.id==='lot').value).toContain('sqft');
    expect(fields.find(field=>field.id==='zip').value).toBe('72204');
    const html=renderToStaticMarkup(<PortfolioPropertyFacts item={property} labels={labels} language={language}/>);
    for(const field of fields)expect(html.match(new RegExp(`data-fact="${field.id}"`,'g'))).toHaveLength(1);
    expect(html.match(/\$35K/g)).toHaveLength(1);expect(html).not.toContain('undefined');
  });
  it('uses complete dictionary labels even if a caller passes missing labels',()=>{
    const model=buildPortfolioPropertyFacts(property,{zip:undefined,lot:''},'pt');
    expect(model.details.find(field=>field.id==='zip').label).toBe('CEP');
    expect(model.details.find(field=>field.id==='lot').label).toBe('Área do terreno');
  });
  it('does not manufacture zero from missing numeric data',()=>{
    const model=buildPortfolioPropertyFacts({type:'SFR',price:null,capRate:'',rehab:undefined,beds:null,baths:'',sqft:'',lot:'  '}, {}, 'en');
    expect(model.summary.every(field=>field.value==='—')).toBe(true);
    expect(model.details.filter(field=>['beds','baths','buildingArea','lot'].includes(field.id)).every(field=>field.value==='—')).toBe(true);
  });
  it('retains explicitly recorded zeros and leading zero ZIP codes',()=>{
    const model=buildPortfolioPropertyFacts({...property,capRate:0,rehab:0,beds:0,baths:0,zip:'01234'}, {}, 'en');
    expect(model.summary.find(field=>field.id==='capRate').value).toBe('0%');
    expect(model.summary.find(field=>field.id==='rehab').value).toBe('$0');
    expect(model.details.find(field=>field.id==='beds').value).toBe('0');
    expect(model.details.find(field=>field.id==='zip').value).toBe('01234');
  });
  it.each([[1760,'en','1,760 sqft'],['1.760','pt','1.760 sqft'],['1,760 sq ft','en','1,760 sqft'],['1.14 ac','en','1.14 ac'],['1.140 ac','en','1.14 ac'],['1,140 ac','pt','1,14 ac'],['100 m²','pt','100 m²'],[0,'en','0 sqft'],[1.234,'en','1.234 sqft'],['unknown','en','—']])('preserves explicit area units: %s', (value,language,expected)=>{
    expect(formatPortfolioArea(value,language)).toBe(expected);
  });
  it('does not show building-only fields for a land portfolio',()=>{
    const model=buildPortfolioPropertyFacts({...property,type:'LAND'}, {}, 'en');
    expect(model.details.some(field=>['beds','baths','buildingArea'].includes(field.id))).toBe(false);
    expect(model.summary.find(field=>field.id==='rehab').value).toBe('N/A');
    expect(model.details.find(field=>field.id==='lot').value).toBe('5,000 sqft');
  });
  it('does not change the property record or financial inputs',()=>{
    const item=Object.freeze({...property});
    buildPortfolioPropertyFacts(item,{},'pt');
    expect(item).toEqual(property);
  });
});
