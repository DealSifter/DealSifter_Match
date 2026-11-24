// @vitest-environment jsdom
import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ProfileAvatar} from './ProfileAvatar';
afterEach(cleanup);
describe('mobile My Cards avatars',()=>{
  it('keeps the A and B photos separate, round and inside their original actions',()=>{
    const a=vi.fn(),b=vi.fn();
    const {container}=render(<><button onClick={a}><ProfileAvatar photo="https://example.invalid/a.jpg"/>My Card 1</button><button onClick={b}><ProfileAvatar photo="https://example.invalid/b.jpg"/>My Card B 4</button></>);
    const photos=container.querySelectorAll('img');
    expect(photos[0].getAttribute('src')).toContain('/a.jpg');expect(photos[1].getAttribute('src')).toContain('/b.jpg');
    expect(photos[0].style.borderRadius).toBe('50%');expect(photos[0].style.objectFit).toBe('cover');
    fireEvent.click(screen.getByRole('button',{name:'My Card B 4'}));expect(b).toHaveBeenCalledTimes(1);expect(a).not.toHaveBeenCalled();
  });
  it('shows a neutral icon when the profile photo is missing or fails, without taking another profile photo',()=>{
    const view=render(<ProfileAvatar photo="https://example.invalid/b.jpg"/>);
    fireEvent.error(view.container.querySelector('img'));expect(view.container.querySelector('img')).toBeNull();
    view.rerender(<ProfileAvatar/>);expect(view.container.querySelector('img')).toBeNull();expect(view.container.querySelector('svg')).toBeTruthy();
  });
});
