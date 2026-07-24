const DEFAULT_PROFILE_SCOPE_LABELS = {
  personal: 'Personal',
  professional: 'Business',
  fsbo: 'FSBO',
};

export function PrimaryProfileSelect({
  t,
  C,
  value,
  onChange,
  label,
  labelStyle,
  selectStyle,
  selectStyleOverrides = {},
  containerStyle,
  dataMobileStep,
  name,
  required = false,
  invalid,
  emptyLabel,
  ariaLabel,
  showLabel = true,
}) {
  const resolvedLabel = label || t.labelLinkToProfile || 'Link to Profile';
  const labels = {
    personal: t.profileScopePersonal || DEFAULT_PROFILE_SCOPE_LABELS.personal,
    professional: t.profileScopeBusiness || DEFAULT_PROFILE_SCOPE_LABELS.professional,
    fsbo: t.profileScopeFsbo || DEFAULT_PROFILE_SCOPE_LABELS.fsbo,
  };
  const baseSelectStyle = typeof selectStyle === 'function'
    ? selectStyle(selectStyleOverrides)
    : { ...(selectStyle || {}), ...selectStyleOverrides };
  const showInvalid = invalid ?? (required && !value);

  return (
    <div data-guide="onboarding-link-profile" style={{ position: 'relative', minWidth: 0, ...(containerStyle || {}) }}>
      {showLabel ? <span style={labelStyle}>{resolvedLabel}</span> : null}
      <select
        data-mobile-step={dataMobileStep}
        name={name}
        aria-label={ariaLabel || resolvedLabel}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...baseSelectStyle,
          ...(showInvalid && C ? { borderColor: C.danger } : null),
        }}
      >
        <option value="">{emptyLabel || t.optionSelectPlaceholder || 'Select'}</option>
        <option value="personal">{labels.personal}</option>
        <option value="professional">{labels.professional}</option>
        <option value="fsbo">{labels.fsbo}</option>
      </select>
    </div>
  );
}
