import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../data/mockData';
import { activityLabel, activityLabels, profileActivities, servicePresentation } from './activityLabels';

describe('readable profile activities', () => {
  it.each(['en-US', 'pt-BR', 'es-ES'])('expands every published category ID in %s', language => {
    for (const category of CATEGORIES.flatMap(row => [row, ...(row.sub || [])]).filter(row => row.id !== 'all')) {
      expect(activityLabel(category.id, language)).not.toBe(category.id);
    }
  });
  it('explains abbreviations and deduplicates aliases without changing custom skills', () => {
    expect(activityLabels(['ff', 'Fix & Flip', 'gc', 'ff_gc', 'Historic homes'], 'pt-BR', true)).toEqual(['Reforma e revenda', 'Empreiteiro geral', 'Historic homes']);
    expect(activityLabel('svc_photo', 'es-ES')).toBe('Fotografía inmobiliaria');
    expect(activityLabel('FSBO', 'en-US')).toBe('For sale by owner');
    expect(activityLabel('FL', 'pt-BR')).toBe('FL');
  });
  it('uses saved activities and service categories without mixing location into skills', () => {
    expect(profileActivities({ type: 'ff_gc', cat: 'gc', loc: 'FL', linkedServices: [{ category: 'svc_photo' }] }, 'pt-BR', true)).toEqual(['Empreiteiro geral', 'Fotografia imobiliária']);
    expect(profileActivities({ type: 'Business', cat: 'ff_rehab' }, 'en-US')).toEqual(['Renovation services']);
  });
  it('keeps the original service title and does not invent missing details or prices', () => {
    expect(servicePresentation({ title: 'Custom photography package', category: 'svc_photo', state: 'FL', price: 0 }, 'pt-BR')).toEqual({ title: 'Custom photography package', category: 'Fotografia imobiliária', location: 'FL', description: '' });
  });
  it('does not advertise another profile, owner or unpublished service as this profile’s specialty', () => {
    expect(profileActivities({ ownerId: 'a', primaryProfile: 'personal', type: 'investor', linkedServices: [
      { ownerId: 'a', primaryProfile: 'personal', category: 'svc_photo' },
      { ownerId: 'a', primaryProfile: 'professional', category: 'ff_gc' },
      { ownerId: 'b', primaryProfile: 'personal', category: 'svc_notary' },
      { ownerId: 'a', primaryProfile: 'personal', category: 'svc_drone', publishToConnections: false },
    ] }, 'pt-BR')).toEqual(['Investidor imobiliário', 'Fotografia imobiliária']);
  });
});
