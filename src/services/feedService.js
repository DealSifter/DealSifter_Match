/**
 * @file Proposed public interface for the future global feed service.
 *
 * Documentation only. No runtime implementation should be added until the
 * extraction step that moves logic out of App.jsx.
 */

/**
 * Raw response shape returned by RPC ds_get_global_feed_inventory.
 *
 * @typedef {Object} GlobalFeedInventory
 * @property {Array<Object>} properties
 * @property {Array<Object>} services
 * @property {Array<Object>} spotlights
 * @property {Array<Object>} users
 * @property {Array<Object>} personalProfiles
 * @property {Array<Object>} professionalProfiles
 * @property {Array<Object>} propertyImages
 */

/**
 * Normalized global feed result consumed by Dashboard, MapView and MatchesPage.
 *
 * @typedef {Object} HydratedGlobalFeed
 * @property {Array<Object>} showcaseProperties Normalized property cards.
 * @property {Array<Object>} connectionServices Normalized service/contact cards.
 * @property {Array<Object>} activeSpotlights Active spotlight rows mapped to UI shape.
 * @property {GlobalFeedIdentityIndex} identityIndex Canonical lookup index for feed actions.
 */

/**
 * Canonical lookup index used to merge remote feed actions into current UI state.
 *
 * @typedef {Object} GlobalFeedIdentityIndex
 * @property {boolean} loaded
 * @property {Map<string, Object>} contactsByOwnerId
 * @property {Map<string, Object>} contactsByOwnerScope
 * @property {Map<string, Object>} propertiesById
 */

/**
 * Feed action rows stored in public.user_feed_actions.
 *
 * @typedef {Object} FeedActionRow
 * @property {'matched'|'interested'|'unlocked'} action
 * @property {'person'|'property'} entity_type
 * @property {string} entity_id
 * @property {Object} payload
 * @property {string=} updated_at
 */

/**
 * Fetch global feed inventory and return normalized feed lists.
 *
 * Proposed extraction from App.jsx:
 * - ds_get_global_feed_inventory RPC.
 * - Table fallback for properties/services/card_spotlights.
 * - Owner profile lookup and owner preview construction.
 * - property_images grouping.
 * - normalizeCard calls and global feed validity filters.
 *
 * @function hydrateGlobalFeedInventory
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.currentUserId
 * @param {(label: string, error: unknown) => void} params.safeLogError
 * @returns {Promise<HydratedGlobalFeed>}
 */

/**
 * Build the canonical identity index from normalized global feed cards.
 *
 * Proposed extraction from the globalFeedIdentityRef update effect.
 *
 * @function buildGlobalFeedIdentityIndex
 * @param {Object} params
 * @param {Array<Object>} params.connectionServices
 * @param {Array<Object>} params.showcaseProperties
 * @returns {GlobalFeedIdentityIndex}
 */

/**
 * Convert current matched/interested/unlocked state into compact DB rows.
 *
 * Proposed extraction from makeFeedActionRows/buildFeedActionPayload.
 *
 * @function makeFeedActionRows
 * @param {Object} params
 * @param {Array<Object>} params.matched
 * @param {Array<Object>} params.interested
 * @param {Array<string>} params.unlocked
 * @returns {Array<FeedActionRow>}
 */

/**
 * Hydrate persisted feed actions for the current user.
 *
 * The service should return normalized state deltas only. App.jsx remains
 * responsible for calling setMatched/setInterested/setUnlocked.
 *
 * @function hydrateUserFeedActions
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @param {GlobalFeedIdentityIndex} params.identityIndex
 * @returns {Promise<{ matched: Array<Object>, interested: Array<Object>, unlocked: Array<string>, replace: boolean }>}
 */

/**
 * Persist feed actions after local state changes using ds_upsert_user_feed_actions.
 *
 * @function syncUserFeedActions
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @param {Array<FeedActionRow>} params.rows
 * @returns {Promise<{ ok: boolean, skipped?: boolean }>}
 */

/**
 * Merge incoming remote action items with local arrays.
 *
 * @function mergeFeedActionItems
 * @param {Array<Object>} previous
 * @param {Array<Object>} incoming
 * @returns {Array<Object>}
 */

/**
 * Create Supabase realtime subscriptions that affect the global feed.
 *
 * The service should return an unsubscribe function, while App.jsx supplies the
 * refresh callback and owns state updates.
 *
 * @function subscribeGlobalFeedRefresh
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @param {() => void} params.onRefresh
 * @returns {() => void}
 */

/**
 * Create Supabase realtime subscription for user_feed_actions.
 *
 * @function subscribeUserFeedActions
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @param {(row: FeedActionRow) => void} params.onRow
 * @param {() => void} params.onFocusRefresh
 * @returns {() => void}
 */

/**
 * Hydrate spotlight purchase candidates owned by the current user.
 *
 * @function hydrateSpotlightCandidates
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @returns {Promise<Array<Object>>}
 */

/**
 * Resolve displayable spotlight candidates by combining profile candidates,
 * database card candidates and active spotlight keys.
 *
 * @function resolveSpotlightCandidates
 * @param {Object} params
 * @param {string} params.userId
 * @param {Object} params.accountType
 * @param {Object} params.personalProfile
 * @param {Object} params.professionalProfile
 * @param {Array<Object>} params.propertyPortfolio
 * @param {Array<Object>} params.dbCandidates
 * @param {Set<string>} params.activeSpotlightKeys
 * @returns {Array<Object>}
 */

/**
 * Purchase paid card spotlights through ds_purchase_card_spotlights.
 *
 * The service should return new spotlight rows and remaining nuggets. App.jsx
 * decides whether to show pricing, close modal, or display toast.
 *
 * @function purchaseCardSpotlights
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @param {Array<{ cardKind: string, cardId: string, scope?: string, title?: string }>} params.items
 * @returns {Promise<{ rows: Array<Object>, remainingNuggets: number|null, totalCost: number }>}
 */

