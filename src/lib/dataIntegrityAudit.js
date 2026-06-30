import { inferRecordProfileScope, normalizeProfileScope, resolveScopedProfile } from './profileScopeResolver';

const text = (value) => String(value || '').trim();

const isSuspiciousIdentityName = (value) => {
  const normalized = text(value).toLowerCase();
  if (!normalized) return false;
  return normalized === 'd4$'
    || normalized === 'drive4$'
    || normalized === 'new user'
    || normalized === 'owner'
    || normalized === 'select';
};

const warning = (code, message, context = {}) => ({
  code,
  message,
  context,
});

const profileSummary = (scope, state) => {
  const resolved = resolveScopedProfile(scope, state);
  return {
    scope: normalizeProfileScope(scope),
    name: text(resolved?.name),
    loc: text(resolved?.loc),
    photoPresent: Boolean(text(resolved?.photo)),
    primaryPhonePresent: Boolean(text(resolved?.primaryPhone)),
    emailPresent: Boolean(text(resolved?.email)),
    cardPriority: text(resolved?.cardPriority),
    verified: resolved?.verified === true,
  };
};

const summarizePortfolioRecord = (record, kind) => {
  const scope = inferRecordProfileScope(record, '');
  const ownerPreview = record?.ownerPreview && typeof record.ownerPreview === 'object'
    ? record.ownerPreview
    : null;
  return {
    kind,
    id: text(record?.id || record?.portfolioId),
    ownerId: text(record?.ownerId || record?.owner_id),
    scope,
    label: text(record?.title || record?.address || record?.name),
    published: kind === 'service'
      ? record?.publishToConnections !== false
      : record?.publishToShowcase !== false,
    ownerPreview: ownerPreview ? {
      name: text(ownerPreview.name),
      loc: text(ownerPreview.loc),
      type: text(ownerPreview.type || ownerPreview.cat || ownerPreview.badge),
      scope: normalizeProfileScope(ownerPreview.primaryProfile || scope),
      photoPresent: Boolean(text(ownerPreview.photo)),
    } : null,
  };
};

export function buildDataIntegrityAudit({
  currentUserId,
  accountType,
  userProfile,
  personalProfile,
  professionalProfile,
  propertyPortfolio = [],
  servicePortfolio = [],
  globalShowcaseProperties = [],
  globalConnectionServices = [],
} = {}) {
  const profileState = { accountType, userProfile, personalProfile, professionalProfile };
  const profiles = {
    personal: profileSummary('personal', profileState),
    professional: profileSummary('professional', profileState),
    fsbo: profileSummary('fsbo', profileState),
  };

  const localOwnerId = text(currentUserId);
  const localProperties = (propertyPortfolio || []).map((record) => summarizePortfolioRecord(record, 'property'));
  const localServices = (servicePortfolio || []).map((record) => summarizePortfolioRecord(record, 'service'));
  const globalProperties = (globalShowcaseProperties || []).map((record) => summarizePortfolioRecord(record, 'property'));
  const globalServices = (globalConnectionServices || []).map((record) => summarizePortfolioRecord(record, 'service'));
  const warnings = [];

  [...localProperties, ...localServices].forEach((record) => {
    if (!record.id) warnings.push(warning('local_record_missing_id', 'Local portfolio record has no stable id.', record));
    if (!record.ownerId) warnings.push(warning('local_record_missing_owner', 'Local portfolio record has no owner id.', record));
    if (localOwnerId && record.ownerId && record.ownerId !== localOwnerId) {
      warnings.push(warning('local_record_owner_mismatch', 'Local portfolio record belongs to a different owner id.', record));
    }
    const scopedProfile = profiles[record.scope];
    if (!scopedProfile?.name) {
      warnings.push(warning('local_record_scope_without_profile_name', 'Published local record points to a profile scope without identity name.', record));
    }
  });

  [...globalProperties, ...globalServices].forEach((record) => {
    if (!record.id) warnings.push(warning('global_record_missing_id', 'Global inventory record has no stable id.', record));
    if (!record.ownerId) warnings.push(warning('global_record_missing_owner', 'Global inventory record has no owner id.', record));
    if (!record.ownerPreview) {
      warnings.push(warning('global_record_missing_owner_preview', 'Global inventory record is missing owner preview.', record));
      return;
    }
    if (isSuspiciousIdentityName(record.ownerPreview.name)) {
      warnings.push(warning('global_owner_preview_suspicious_name', 'Global owner preview is using a technical/non-identity name.', record));
    }
    if (record.ownerPreview.scope !== record.scope) {
      warnings.push(warning('global_owner_preview_scope_mismatch', 'Global owner preview scope differs from record primary profile.', record));
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    currentUserId: localOwnerId,
    profiles,
    counts: {
      localProperties: localProperties.length,
      localServices: localServices.length,
      globalProperties: globalProperties.length,
      globalServices: globalServices.length,
      warnings: warnings.length,
    },
    localProperties,
    localServices,
    globalProperties,
    globalServices,
    warnings,
  };
}
