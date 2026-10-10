// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortfolioPinCarousel } from './PortfolioPinCarousel';
import { linkedPortfolioSlides } from './portfolioPinData';

afterEach(cleanup);
const owner = { id: 'owner:fsbo', ownerId: 'owner', primaryProfile: 'fsbo',
  linkedProperties: [{ id: 'property', ownerId: 'owner', primaryProfile: 'fsbo', title: 'A property', images: ['/first.jpg', '/second.jpg'], image: '/first.jpg' }],
  linkedServices: [{ id: 'service', ownerId: 'owner', primaryProfile: 'fsbo', title: 'A service', media: { images: ['/service.jpg'] } }] };
describe('Owner-scoped portfolio pin carousel', () => {
  it('retains all distinct property/service images and removes duplicate image aliases', () => {
    expect(linkedPortfolioSlides(owner).map(slide => slide.src)).toEqual(['/first.jpg', '/second.jpg', '/service.jpg']);
  });
  it('never includes another owner, inactive item, or another profile scope', () => {
    const bad = [{ id: 'wrong', ownerId: 'other', images: ['/wrong.jpg'] },
      { id: 'scope', ownerId: 'owner', primaryProfile: 'personal', images: ['/wrong.jpg'] },
      { id: 'closed', ownerId: 'owner', dealClosed: true, images: ['/wrong.jpg'] }];
    expect(linkedPortfolioSlides({ ...owner, linkedProperties: bad, linkedServices: [] })).toEqual([]);
  });
  it('uses the publication flag of the item kind, not the unrelated flag', () => {
    const property = { ...owner.linkedProperties[0], publishToConnections: false };
    const service = { ...owner.linkedServices[0], publishToShowcase: false };
    expect(linkedPortfolioSlides({ ...owner, linkedProperties: [property], linkedServices: [service] })).toHaveLength(3);
  });
  it('uses arrows without opening feed and opens only the selected portfolio item', () => {
    const onOpen = vi.fn();
    render(<PortfolioPinCarousel owner={owner} language="pt" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima imagem' }));
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima imagem' }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir item do portfólio: A service/ }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'service' }), 'service');
    fireEvent.click(screen.getByRole('button', { name: 'Próxima imagem' }));
    expect(screen.getByText('1/3')).toBeTruthy();
  });
  it('does not manufacture portfolio photos when there are none', () => {
    render(<PortfolioPinCarousel owner={{ ownerId: 'owner' }} language="pt" />);
    expect(screen.getByText('Portfólio sem imagens')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
