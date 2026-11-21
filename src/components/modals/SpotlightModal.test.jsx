// @vitest-environment jsdom
import React from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {SpotlightModal} from './SpotlightModal';
import {setLang} from '../../i18n/translations';
beforeEach(()=>setLang('en'));
afterEach(cleanup);
it('keeps selections from different pages and confirms all selected cards only on the final action',()=>{
  const confirm=vi.fn();
  render(<SpotlightModal open items={Array.from({length:14},(_,i)=>({key:String(i),cardId:'card-'+i,cardKind:'property',title:'Fixture '+(i+1),label:'QA'}))} nuggets={100} onConfirm={confirm} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByText('Fixture 1'));
  fireEvent.click(screen.getByRole('button',{name:'Next page'}));
  fireEvent.click(screen.getByText('Fixture 7'));
  fireEvent.click(screen.getByRole('button',{name:'Previous page'}));
  expect(screen.getByRole('button',{name:/Fixture 1 QA/}).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText(/Total:/).textContent).toContain('20');
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Activate Spotlight'}));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm.mock.calls[0][0].map(item=>item.cardId)).toEqual(['card-0','card-6']);
});
