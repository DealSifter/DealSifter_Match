// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {FactReviewIndicator} from './FactReviewIndicator';
afterEach(cleanup);
describe('single borderless modal review CTA',()=>{
 it.each([['pt-BR','Revise clicando aqui'],['en-US','Review — click here'],['es-ES','Revise haciendo clic aquí']])('uses exact localized one-control copy %s',(language,label)=>{
  const open=vi.fn();render(<FactReviewIndicator variant="modal" language={language} onClick={open}/>);
  const button=screen.getByRole('button',{name:label});expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(button.querySelector('svg').getAttribute('width')).toBe('24');expect(button.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  fireEvent.click(screen.getByText(label));fireEvent.click(button.querySelector('svg'));expect(open).toHaveBeenCalledTimes(2);
 });
 it('keeps the portfolio icon compact and non-interactive',()=>{
  render(<FactReviewIndicator language="pt-BR"/>);expect(screen.getByRole('img').querySelector('svg').getAttribute('width')).toBe('18');expect(screen.queryByRole('button')).toBeNull();
 });
 it('preserves shared pulse, yellow token and reduced-motion disable, with no CTA border/pill',()=>{
  const css=readFileSync('src/features/propertyFacts/propertyFacts.css','utf8');
  expect(css).toContain('animation:ds-fact-attention 2.2s ease-in-out infinite');expect(css).toContain('color:var(--gold');expect(css).toContain('border:0');
  expect(css).toContain('prefers-reduced-motion:reduce');expect(css).toContain('.property-fact-warning,.property-fact-edit-attention{animation:none}');
  expect(css).toContain('border-radius:0;box-shadow:none');
 });
 it('uses actionable conflicts and only a local page change at the existing modal title',()=>{
  const source=readFileSync('src/pages/Onboarding.jsx','utf8');
  expect(source).toContain('summary.conflicts>0?<FactReviewIndicator variant="modal"');expect(source).toContain("onClick={()=>setPropertyEditPage('review')}");
 });
});
