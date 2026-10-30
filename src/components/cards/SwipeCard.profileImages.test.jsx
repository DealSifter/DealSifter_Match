// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {SwipeCard} from './SwipeCard';
vi.mock('../../hooks/useMediaQuery',()=>({useMediaQuery:()=>false}));
afterEach(cleanup);
const card={id:'same-owner',ownerId:'owner',primaryProfile:'personal',name:'Investor',photo:'/personal.jpg',linkedServices:[{id:'s1',ownerId:'owner',primaryProfile:'personal',media:{images:['/personal-service.jpg']}},{id:'s2',ownerId:'owner',primaryProfile:'fsbo',media:{images:['/wrong-fsbo-service.jpg']}},{id:'s3',ownerId:'someone-else',primaryProfile:'personal',media:{images:['/wrong-user-service.jpg']}}]};
describe('profile card gallery identity',()=>{
  it('shows only linked images from the same profile and owner',()=>{
    const {container}=render(<SwipeCard card={card} previewOnly showActions={false}/>);
    const next=()=>fireEvent.click(container.querySelectorAll('[role="button"]')[1]);
    next();expect(screen.getByRole('img',{name:'Investor'}).getAttribute('src')).toBe('/personal-service.jpg');
    next();expect(screen.getByRole('img',{name:'Investor'}).getAttribute('src')).toBe('/personal.jpg');
  });
  it.each([{ownerId:'owner',primaryProfile:'fsbo'},{ownerId:'another',primaryProfile:'personal'}])('starts with the profile portrait on identity change: %o',identity=>{
    const {container,rerender}=render(<SwipeCard card={card} previewOnly showActions={false}/>);
    fireEvent.click(container.querySelectorAll('[role="button"]')[1]);
    rerender(<SwipeCard card={{...card,...identity,name:'New identity',photo:'/new.jpg',images:['/new-service.jpg'],linkedServices:[]}} previewOnly showActions={false}/>);
    expect(screen.getByRole('img',{name:'New identity'}).getAttribute('src')).toBe('/new.jpg');
  });
});
