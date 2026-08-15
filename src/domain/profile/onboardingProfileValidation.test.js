import { describe, expect, it } from 'vitest';
import {
  buildMobileStepCompletion,
  evaluateMinimumProfileCompletion,
  getMissingRequiredProfile,
} from './onboardingProfileValidation';

const copy = {
  requiredFullName: 'Full name',
  requiredPriorityPhone: 'Phone',
  requiredEmail: 'Email',
  requiredBusinessContactOptions: 'Contact method',
  requiredPrefix: 'Required',
};

describe('onboarding profile validation domain', () => {
  it('reports the required professional identity fields', () => {
    expect(getMissingRequiredProfile({ name: '', phone: '', email: '', contactMethods: [], copy }))
      .toEqual(['Full name', 'Phone', 'Email', 'Contact method']);
  });

  it('keeps the FSBO phone-or-email rule', () => {
    expect(evaluateMinimumProfileCompletion({
      accountType: 'fsbo_owner',
      name: 'Owner',
      phone: '',
      email: 'owner@example.test',
      profileAComplete: false,
      profileBComplete: false,
      profileAReady: false,
      profileBReady: false,
      preferProfessionalPath: false,
      copy,
    })).toMatchObject({ valid: true, primaryProfile: 'C' });
  });

  it('selects the only complete professional path', () => {
    expect(evaluateMinimumProfileCompletion({
      accountType: 'professional',
      profileAComplete: false,
      profileBComplete: true,
      profileAReady: false,
      profileBReady: true,
      preferProfessionalPath: true,
      copy,
    })).toMatchObject({ valid: true, primaryProfile: 'B' });
  });

  it('returns a stable UI target for incomplete operations', () => {
    expect(evaluateMinimumProfileCompletion({
      accountType: 'professional',
      profileAComplete: false,
      profileBComplete: true,
      profileAReady: false,
      profileBReady: false,
      preferProfessionalPath: true,
      copy,
    })).toMatchObject({ valid: false, target: 'tab-operation' });
  });

  it('maps completion flags without UI dependencies', () => {
    expect(buildMobileStepCompletion({
      profileAFullName: false,
      profileAPhone: true,
      profileAEmail: false,
    })).toMatchObject({ profileAName: true, profileAPhone: false, profileAEmail: true });
  });
});
