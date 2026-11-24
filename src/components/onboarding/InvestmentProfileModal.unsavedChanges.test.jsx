// @vitest-environment jsdom
import React from 'react';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {InvestmentProfileModal} from './InvestmentProfileModal';
import {normalizeInvestmentDraft} from '../../lib/investmentProfile';
afterEach(cleanup);
describe('investment profile save reminder', () => {
  it('starts clean, detects selections and text, and stops when reverted', () => {
    const initial=normalizeInvestmentDraft({});
    const props={investmentProfileDraft:initial,investmentScoreMeta:{color:'#35cac9',icon:'star'},investmentProfileStrength:0,
      investmentTriggerCategories:[],t:{},onSave:vi.fn(),onClose:vi.fn(),toggleInvestmentField:vi.fn(),setInvestmentField:vi.fn(),setInvestmentMarketInput:vi.fn(),addInvestmentMarket:vi.fn(),removeInvestmentMarket:vi.fn()};
    const view=render(<InvestmentProfileModal {...props}/>);
    const button=screen.getByRole('button',{name:'Save profile'});
    expect(button.dataset.savePending).toBe('false');
    view.rerender(<InvestmentProfileModal {...props} investmentProfileDraft={{...initial,investorRoles:['Investor']}}/>);
    expect(button.dataset.savePending).toBe('true');
    view.rerender(<InvestmentProfileModal {...props} investmentProfileDraft={{...initial,currentFocus:'Review new opportunities'}}/>);
    expect(button.dataset.savePending).toBe('true');
    view.rerender(<InvestmentProfileModal {...props}/>);
    expect(button.dataset.savePending).toBe('false');
    expect(props.onSave).not.toHaveBeenCalled();
  }, 15000);
});
