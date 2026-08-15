export function getMissingRequiredProfile({ name, phone, email, contactMethods, copy }) {
  const missing = [];
  if (!String(name || '').trim()) missing.push(copy.requiredFullName);
  if (!String(phone || '').trim()) missing.push(copy.requiredPriorityPhone);
  if (!String(email || '').trim()) missing.push(copy.requiredEmail);
  if (!Array.isArray(contactMethods) || contactMethods.length === 0) {
    missing.push(copy.requiredBusinessContactOptions);
  }
  return missing;
}

export function evaluateMinimumProfileCompletion({
  accountType,
  name,
  phone,
  email,
  profileAComplete,
  profileBComplete,
  profileAReady,
  profileBReady,
  preferProfessionalPath,
  copy,
}) {
  if (accountType === 'fsbo_owner') {
    const missing = [];
    if (!String(name || '').trim()) missing.push(copy.requiredFullName || 'Full name');
    if (!String(phone || '').trim() && !String(email || '').trim()) {
      missing.push(copy.requiredPriorityPhone || 'Priority phone');
    }
    return missing.length
      ? {
        valid: false,
        primaryProfile: null,
        profileAComplete,
        profileBComplete,
        target: 'profile-a-fields',
        message: `${copy.requiredPrefix}: ${missing.join(' | ')}`,
      }
      : { valid: true, primaryProfile: 'C', profileAComplete, profileBComplete };
  }

  if (profileAReady || profileBReady) {
    return {
      valid: true,
      primaryProfile: profileBReady && !profileAReady
        ? 'B'
        : (profileAReady && !profileBReady ? 'A' : (preferProfessionalPath ? 'B' : 'A')),
      profileAComplete,
      profileBComplete,
    };
  }

  if (preferProfessionalPath) {
    return !profileBComplete
      ? {
        valid: false,
        primaryProfile: null,
        profileAComplete,
        profileBComplete,
        target: 'tab-business',
        message: copy.errorCompleteBusinessProfile || 'Complete the Business profile: full name, priority phone, email and contact methods.',
      }
      : {
        valid: false,
        primaryProfile: null,
        profileAComplete,
        profileBComplete,
        target: 'tab-operation',
        message: copy.errorCompleteOperationsTab || 'Complete Operations tab for Business: category, primary category and at least one state.',
      };
  }

  return !profileAComplete
    ? {
      valid: false,
      primaryProfile: null,
      profileAComplete,
      profileBComplete,
      target: 'tab-personal',
      message: copy.errorCompletePersonalProfile || 'Complete the Personal profile: full name, priority phone, email and contact methods.',
    }
    : {
      valid: false,
      primaryProfile: null,
      profileAComplete,
      profileBComplete,
      target: 'tab-skills',
      message: copy.errorCompleteSkillsTab || 'Complete Skills tab for Personal: category, primary category and at least one state.',
    };
}

export function buildMobileStepCompletion(missing) {
  return {
    profileAName: !missing.profileAFullName,
    profileAPhone: !missing.profileAPhone,
    profileAEmail: !missing.profileAEmail,
    profileAEmailOrPhone: !missing.profileAPhone || !missing.profileAEmail,
    profileAContact: !missing.profileAContactMethods,
    skillsCategories: !missing.skillsCategories,
    skillsMarkets: !missing.skillsMarkets,
    skillsPrimaryCategory: !missing.skillsPrimaryCategory,
    profileBName: !missing.profileBFullName,
    profileBPhone: !missing.profileBPhone,
    profileBEmail: !missing.profileBEmail,
    profileBContact: !missing.profileBContactMethods,
    opsCategories: !missing.opsCategories,
    opsMarkets: !missing.opsMarkets,
    opsPrimaryCategory: !missing.opsPrimaryCategory,
    portfolioAddress: !missing.portfolioAddress,
    portfolioCity: !missing.portfolioCity,
    portfolioZip: !missing.portfolioZip,
    portfolioPrice: !missing.portfolioPrice,
    portfolioType: !missing.portfolioType,
    portfolioPrimaryProfile: !missing.portfolioPrimaryProfile,
    serviceTitle: !missing.serviceTitle,
    serviceCategory: !missing.serviceCategory,
    servicePrice: !missing.servicePrice,
    servicePrimaryProfile: !missing.servicePrimaryProfile,
  };
}
