// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FeedPreviewModal } from './FeedPreviewModal';
vi.mock('../ui/FittedPreviewCard', () => ({ FittedPreviewCard: ({children}) => <div>{children}</div> }));
vi.mock('./SwipeCard', () => ({ SwipeCard: ({card}) => <article data-testid="profile-card">{card.name}</article> }));
vi.mock('./PropertyCard', () => ({ PropertyCard: ({property,owner}) => <article>{property.address} · {owner.name}</article> }));
afterEach(cleanup);
const profiles = {personal:{name:'Investor'},fsbo:{name:'Seller'}};
const groups = [
  {profileScope:'personal',properties:[],services:[{id:'s1',title:'Rehab',media:{images:['/one.jpg','/two.jpg']}},{id:'s2',title:'Second service',media:{images:[]}}]},
  {profileScope:'fsbo',properties:[{id:'p1',address:'Seller property'}],services:[]},
];
const copy = {previewTitle:'Review publication',previewBackToEdit:'Edit',previewConfirmPublish:'Publish',myCardsProfileTab:'Profile',myCardsShowcaseTab:'Portfolio'};
function mount(overrides={}) {return render(<FeedPreviewModal groups={groups} profileCards={profiles} copy={copy} onClose={()=>{}} onPublish={()=>{}} {...overrides}/>);}
describe('feed publication preview',()=>{
  it('keeps each profile linked to its own portfolio and retains the selected tab',()=>{
    mount();fireEvent.click(screen.getByRole('tab',{name:'Portfolio'}));
    fireEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
    expect(screen.getByText('Second service')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('region',{name:'Feed Card'})).getByRole('button',{name:'Next profile'}));
    expect(screen.getByTestId('profile-card').textContent).toBe('Seller');
    expect(screen.getByText('Seller property · Seller')).toBeTruthy();
    expect(screen.queryByText('Second service')).toBeNull();
    expect(screen.getByRole('tab',{name:'Portfolio'}).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(within(screen.getByRole('region',{name:'Feed Card'})).getByRole('button',{name:'Previous profile'}));
    expect(screen.getByText('Rehab')).toBeTruthy();
    expect(screen.queryByText('Seller property · Seller')).toBeNull();
  });
  it('shows exactly one service image and resets the image on profile change',()=>{
    mount();const media=document.querySelector('.preview-service-media');
    expect(within(media).getAllByRole('img')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'Next image'}));
    expect(within(media).getByRole('img').getAttribute('src')).toBe('/two.jpg');
    fireEvent.click(within(screen.getByRole('region',{name:'Feed Card'})).getByRole('button',{name:'Next profile'}));
    fireEvent.click(within(screen.getByRole('region',{name:'Feed Card'})).getByRole('button',{name:'Previous profile'}));
    expect(document.querySelector('.preview-service-media img').getAttribute('src')).toBe('/one.jpg');
  });
  it('preserves edit and publish callbacks and disables publishing while saving',()=>{
    const onClose=vi.fn(),onPublish=vi.fn();const view=mount({onClose,onPublish});
    fireEvent.click(screen.getByRole('button',{name:'Edit'}));expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button',{name:'Publish'}));expect(onPublish).toHaveBeenCalledTimes(1);
    view.rerender(<FeedPreviewModal groups={groups} profileCards={profiles} copy={copy} onClose={onClose} onPublish={onPublish} publishing/>);
    expect(screen.getByRole('button',{name:'Publish'}).disabled).toBe(true);
  });
  it('previews the requested profile when no portfolio exists',()=>{
    mount({groups:[],defaultScope:'fsbo'});
    expect(screen.getByTestId('profile-card').textContent).toBe('Seller');
    expect(screen.queryByRole('button',{name:'Next profile'})).toBeNull();
  });
});
