// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render} from '@testing-library/react';
import {SwipeableNotificationItem} from './Navbar';
afterEach(cleanup);
const pointer=(element,type,x)=>fireEvent(element,new MouseEvent(type,{bubbles:true,clientX:x}));
describe('notification tap versus swipe ownership',()=>{
 it('leaves an ordinary click with the actionable child rather than capturing it',()=>{
  const open=vi.fn(),{container}=render(<SwipeableNotificationItem item={{id:'synthetic'}}><div role="button" onClick={open}>Review facts</div></SwipeableNotificationItem>);
  const wrapper=container.firstChild,child=wrapper.firstChild,capture=vi.fn();wrapper.setPointerCapture=capture;
  pointer(child,'pointerdown',100);pointer(child,'pointerup',100);fireEvent.click(child);
  expect(capture).not.toHaveBeenCalled();expect(open).toHaveBeenCalledTimes(1);
 });
 it('captures only a real drag and suppresses its follow-up click',()=>{
  const open=vi.fn(),swipe=vi.fn(),{container}=render(<SwipeableNotificationItem item={{id:'synthetic'}} onSwipeRight={swipe} onClick={open}><div role="button" onClick={open}>Review facts</div></SwipeableNotificationItem>);
  const wrapper=container.firstChild,child=wrapper.firstChild,capture=vi.fn();wrapper.setPointerCapture=capture;
  pointer(child,'pointerdown',100);pointer(wrapper,'pointermove',185);pointer(wrapper,'pointerup',185);fireEvent.click(child);
  expect(capture).toHaveBeenCalledTimes(1);expect(swipe).toHaveBeenCalledTimes(1);expect(open).not.toHaveBeenCalled();
 });
 it('keeps the explicit delete button independent of the swipe surface',()=>{
  const remove=vi.fn(),{container}=render(<SwipeableNotificationItem item={{id:'synthetic'}}><button onClick={remove}>Delete</button></SwipeableNotificationItem>);
  const wrapper=container.firstChild,button=wrapper.firstChild,capture=vi.fn();wrapper.setPointerCapture=capture;
  pointer(button,'pointerdown',100);pointer(button,'pointerup',100);fireEvent.click(button);expect(remove).toHaveBeenCalledTimes(1);expect(capture).not.toHaveBeenCalled();
 });
});
