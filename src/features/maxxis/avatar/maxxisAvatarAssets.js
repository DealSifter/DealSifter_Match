import avatarIdle from '../../../assets/maxxis/avatar/avatar-idle.png';
import avatarNoticed from '../../../assets/maxxis/avatar/avatar-noticed.png';
import avatarObserving from '../../../assets/maxxis/avatar/avatar-observing.png';
import avatarProcessing from '../../../assets/maxxis/avatar/avatar-processing.png';
import avatarSuccess from '../../../assets/maxxis/avatar/avatar-success.png';
import avatarWaiting from '../../../assets/maxxis/avatar/avatar-waiting.png';
import {
  MAXXIS_AVATAR_ASSET_KEYS,
  MAXXIS_AVATAR_STATES,
  isMaxxisAvatarState,
} from './maxxisAvatarStates';

function createAsset(state, src) {
  return Object.freeze({
    state,
    key: MAXXIS_AVATAR_ASSET_KEYS[state],
    src,
  });
}

export const MAXXIS_AVATAR_ASSETS = Object.freeze({
  [MAXXIS_AVATAR_STATES.IDLE]: createAsset(MAXXIS_AVATAR_STATES.IDLE, avatarIdle),
  [MAXXIS_AVATAR_STATES.OBSERVING]: createAsset(MAXXIS_AVATAR_STATES.OBSERVING, avatarObserving),
  [MAXXIS_AVATAR_STATES.PROCESSING]: createAsset(MAXXIS_AVATAR_STATES.PROCESSING, avatarProcessing),
  [MAXXIS_AVATAR_STATES.NOTICED]: createAsset(MAXXIS_AVATAR_STATES.NOTICED, avatarNoticed),
  [MAXXIS_AVATAR_STATES.WAITING]: createAsset(MAXXIS_AVATAR_STATES.WAITING, avatarWaiting),
  [MAXXIS_AVATAR_STATES.SUCCESS]: createAsset(MAXXIS_AVATAR_STATES.SUCCESS, avatarSuccess),
});

export const MAXXIS_AVATAR_ASSET_LIST = Object.freeze(Object.values(MAXXIS_AVATAR_ASSETS));

function normalizeState(state) {
  const normalized = String(state || '').trim().toUpperCase();
  return isMaxxisAvatarState(normalized) ? normalized : MAXXIS_AVATAR_STATES.IDLE;
}

function isUsableAsset(asset) {
  return Boolean(asset && typeof asset.src === 'string' && asset.src.trim());
}

export function resolveMaxxisAvatarAsset(state, assetMap = MAXXIS_AVATAR_ASSETS) {
  const normalizedState = normalizeState(state);
  const requestedAsset = assetMap?.[normalizedState];
  if (isUsableAsset(requestedAsset)) return requestedAsset;

  const idleAsset = assetMap?.[MAXXIS_AVATAR_STATES.IDLE];
  return isUsableAsset(idleAsset)
    ? idleAsset
    : MAXXIS_AVATAR_ASSETS[MAXXIS_AVATAR_STATES.IDLE];
}

