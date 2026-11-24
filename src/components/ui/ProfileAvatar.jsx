import React from 'react';
import { SmartImage } from './SmartImage';
import { Icon } from './Icon';
import { C } from '../../theme/colors';

export function ProfileAvatar({ photo, size = 34 }) {
  return <span aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: C.alpha(C.accent, 0.08) }}>
    <SmartImage src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
      fallback={<Icon name="user" size={Math.round(size * 0.6)} color={C.t2} />} />
  </span>;
}
