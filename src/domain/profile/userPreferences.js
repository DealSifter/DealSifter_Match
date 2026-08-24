import {
  DEFAULT_MAXXIS_PREFERENCES,
  normalizeMaxxisPreferences,
} from '../../features/maxxis/preferences/maxxisPreferences';

export const DEFAULT_USER_PREFERENCES = {
  map: {
    initialZoom: 4,
    defaultStyle: 'simple',
    clusterBehavior: 'pins_city',
    defaultFilters: {
      showPeople: true,
      showProperties: true,
      showOnlyUnlocked: false,
      showOnlyMyPins: false,
    },
  },
  feedMatches: {
    sortOrder: 'random',
    autoplayMedia: false,
  },
  chatLanguage: {
    input: 'pt',
    output: 'en',
  },
  privacy: {
    presenceStatus: 'online',
    readReceipts: true,
    messagePreview: true,
  },
  maxxis: DEFAULT_MAXXIS_PREFERENCES,
};

export const normalizeUserPreferences = (value) => {
  const input = value && typeof value === 'object' ? value : {};
  const map = input.map && typeof input.map === 'object' ? input.map : {};
  const defaultFilters = map.defaultFilters && typeof map.defaultFilters === 'object' ? map.defaultFilters : {};
  const feedMatches = input.feedMatches && typeof input.feedMatches === 'object' ? input.feedMatches : {};
  const chatLanguage = input.chatLanguage && typeof input.chatLanguage === 'object' ? input.chatLanguage : {};
  const privacy = input.privacy && typeof input.privacy === 'object' ? input.privacy : {};
  const maxxis = normalizeMaxxisPreferences(input.maxxis);
  const initialZoomRaw = Number(map.initialZoom);
  const initialZoom = Number.isFinite(initialZoomRaw) ? Math.max(3, Math.min(13, initialZoomRaw)) : DEFAULT_USER_PREFERENCES.map.initialZoom;
  const rawDefaultStyle = String(map.defaultStyle || '').trim();
  const defaultStyle = ['simple', 'satellite_streets', 'topo'].includes(rawDefaultStyle)
    ? rawDefaultStyle
    : (rawDefaultStyle === 'flood' ? 'satellite_streets' : DEFAULT_USER_PREFERENCES.map.defaultStyle);
  const clusterBehavior = ['pins_city', 'mixed'].includes(String(map.clusterBehavior || '').trim())
    ? String(map.clusterBehavior).trim()
    : DEFAULT_USER_PREFERENCES.map.clusterBehavior;
  const sortOrder = ['random', 'recent', 'name_asc', 'price_asc', 'price_desc', 'my_cards_first'].includes(String(feedMatches.sortOrder || '').trim())
    ? String(feedMatches.sortOrder).trim()
    : DEFAULT_USER_PREFERENCES.feedMatches.sortOrder;
  const presenceStatus = ['online', 'standby', 'offline'].includes(String(privacy.presenceStatus || '').trim())
    ? String(privacy.presenceStatus).trim()
    : DEFAULT_USER_PREFERENCES.privacy.presenceStatus;

  return {
    map: {
      initialZoom,
      defaultStyle,
      clusterBehavior,
      defaultFilters: {
        showPeople: Boolean(defaultFilters.showPeople ?? DEFAULT_USER_PREFERENCES.map.defaultFilters.showPeople),
        showProperties: Boolean(defaultFilters.showProperties ?? DEFAULT_USER_PREFERENCES.map.defaultFilters.showProperties),
        showOnlyUnlocked: Boolean(defaultFilters.showOnlyUnlocked ?? DEFAULT_USER_PREFERENCES.map.defaultFilters.showOnlyUnlocked),
        showOnlyMyPins: Boolean(defaultFilters.showOnlyMyPins ?? DEFAULT_USER_PREFERENCES.map.defaultFilters.showOnlyMyPins),
      },
    },
    feedMatches: {
      sortOrder,
      autoplayMedia: Boolean(feedMatches.autoplayMedia ?? DEFAULT_USER_PREFERENCES.feedMatches.autoplayMedia),
    },
    chatLanguage: {
      input: ['pt', 'en', 'es'].includes(String(chatLanguage.input || '').trim()) ? String(chatLanguage.input).trim() : DEFAULT_USER_PREFERENCES.chatLanguage.input,
      output: ['pt', 'en', 'es'].includes(String(chatLanguage.output || '').trim()) ? String(chatLanguage.output).trim() : DEFAULT_USER_PREFERENCES.chatLanguage.output,
    },
    privacy: {
      presenceStatus,
      readReceipts: Boolean(privacy.readReceipts ?? DEFAULT_USER_PREFERENCES.privacy.readReceipts),
      messagePreview: Boolean(privacy.messagePreview ?? DEFAULT_USER_PREFERENCES.privacy.messagePreview),
    },
    maxxis,
  };
};
