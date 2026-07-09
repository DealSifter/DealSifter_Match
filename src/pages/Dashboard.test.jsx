import { describe, expect, it } from 'vitest';
import { normalizeCard } from '../lib/normalizeFeedCard';
import { sanitizePublicCardInput } from '../lib/sanitizePublicCardInput';

const buildDashboardPublicProfileCard = (ownerPreview) => {
  const publicOwnerPreview = sanitizePublicCardInput(ownerPreview);
  return normalizeCard({
    cardKind: 'person',
    id: 'owner-1:professional',
    ownerId: 'owner-1',
    primaryProfile: 'professional',
    name: publicOwnerPreview.name,
    type: publicOwnerPreview.type,
    loc: publicOwnerPreview.loc,
    photo: publicOwnerPreview.photo,
    portfolioCount: 1,
    ownerPreview: { ...publicOwnerPreview, primaryProfile: 'professional' },
    linkedServices: [{ id: 'service-1', publishToConnections: true }],
  }, 'viewer-1');
};

describe('Dashboard public card builders', () => {
  it('does not create public profile cards with contact fields from ownerPreview', () => {
    const card = buildDashboardPublicProfileCard({
      primaryProfile: 'professional',
      name: 'Valid Owner',
      type: 'Investor',
      loc: 'FL',
      email: 'owner@example.com',
      phone: '+15551230000',
      primaryPhone: '+15551230001',
      secondaryPhone: '+15551230002',
      whatsapp: '+15551230003',
      contactMethods: ['email', 'phone'],
    });

    expect(card).toBeTruthy();
    expect(card).not.toHaveProperty('email');
    expect(card).not.toHaveProperty('phone');
    expect(card).not.toHaveProperty('primaryPhone');
    expect(card).not.toHaveProperty('secondaryPhone');
    expect(card).not.toHaveProperty('whatsapp');
    expect(card).not.toHaveProperty('contactMethods');
    expect(card.ownerPreview).not.toHaveProperty('email');
    expect(card.ownerPreview).not.toHaveProperty('primaryPhone');
    expect(card.ownerPreview).not.toHaveProperty('contactMethods');
  });

  it('does not mutate canonical unlocked contact objects outside Dashboard', () => {
    const canonicalUnlockedContact = {
      ownerId: 'owner-1',
      contact: {
        email: 'owner@example.com',
        phonePrimary: '+15551230001',
        whatsapp: '+15551230003',
        contactMethods: ['email', 'phone'],
      },
    };

    buildDashboardPublicProfileCard({
      primaryProfile: 'professional',
      name: 'Valid Owner',
      type: 'Investor',
      loc: 'FL',
      email: canonicalUnlockedContact.contact.email,
      primaryPhone: canonicalUnlockedContact.contact.phonePrimary,
      whatsapp: canonicalUnlockedContact.contact.whatsapp,
      contactMethods: canonicalUnlockedContact.contact.contactMethods,
    });

    expect(canonicalUnlockedContact.contact).toMatchObject({
      email: 'owner@example.com',
      phonePrimary: '+15551230001',
      whatsapp: '+15551230003',
      contactMethods: ['email', 'phone'],
    });
  });
});
