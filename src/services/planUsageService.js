/**
 * @file Proposed public interface for the future plan usage service.
 *
 * Documentation only. No runtime implementation should be added until the
 * extraction step that moves plan/nugget logic out of App.jsx.
 */

/**
 * Subscription shape currently passed to pages as `subscription`.
 *
 * @typedef {Object} AccessSubscription
 * @property {string} planId
 * @property {string=} id
 * @property {string} planName
 * @property {number} price
 * @property {string} status
 * @property {string|null} nextBillingAt
 */

/**
 * User plan and balance snapshot.
 *
 * @typedef {Object} PlanUsageSnapshot
 * @property {number} nuggets
 * @property {AccessSubscription} subscription
 * @property {Object|null} settingsPayload
 */

/**
 * Convert users/subscriptions rows into the app subscription model.
 *
 * Proposed extraction from the profile hydration effect.
 *
 * @function mapSubscriptionRowsToAccessSubscription
 * @param {Object} params
 * @param {Object|null} params.userRow
 * @param {Object|null} params.subscriptionRow
 * @param {Array<Object>} params.planDefinitions
 * @returns {AccessSubscription}
 */

/**
 * Hydrate nugget balance, subscription and settings payload.
 *
 * App.jsx should call this during profile/session hydration, then update React
 * state with the returned snapshot.
 *
 * @function hydratePlanUsage
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @param {Array<Object>} params.planDefinitions
 * @returns {Promise<PlanUsageSnapshot>}
 */

/**
 * Persist local/mock plan usage for non-Supabase mode.
 *
 * Proposed extraction from ds_nuggets and ds_subscription_mock persistence
 * effects.
 *
 * @function persistLocalPlanUsage
 * @param {Object} params
 * @param {number} params.nuggets
 * @param {AccessSubscription} params.subscription
 * @returns {{ ok: boolean }}
 */

/**
 * Return the subscription object that feature gates should use.
 *
 * Proposed extraction from accessSubscription useMemo.
 *
 * @function resolveAccessSubscription
 * @param {Object} params
 * @param {boolean} params.isAdmin
 * @param {AccessSubscription} params.subscription
 * @returns {AccessSubscription}
 */

/**
 * Classify RPC/service errors related to plan limits.
 *
 * Proposed extraction from inline unlock plan-gate handling. This function only
 * classifies; App.jsx remains responsible for toast/routing side effects.
 *
 * @function isPlanLimitError
 * @param {unknown} error
 * @returns {boolean}
 */

/**
 * Build a UI-agnostic plan gate event payload.
 *
 * App.jsx should continue to call trackAppEvent and openPricingHub until a
 * later UI-flow extraction.
 *
 * @function buildPlanGateEvent
 * @param {Object} params
 * @param {string} params.feature
 * @param {string} params.source
 * @returns {{ entityType: string, entityId: string, metadata: Object }}
 */

/**
 * Apply a successful nugget-consuming operation to the current balance.
 *
 * Used by unlock/exclusivity/spotlight flows after the server returns the
 * canonical remaining balance.
 *
 * @function resolveRemainingNuggets
 * @param {Object} params
 * @param {number} params.currentNuggets
 * @param {number|null|undefined} params.serverRemainingNuggets
 * @param {number} params.fallbackCost
 * @returns {number}
 */

/**
 * Validate whether the user has enough local/mock nuggets before calling a
 * non-server-backed feature.
 *
 * Server-backed flows should still validate in RPCs.
 *
 * @function assertLocalNuggetBalance
 * @param {Object} params
 * @param {number} params.currentNuggets
 * @param {number} params.requiredNuggets
 * @throws {Error} When local balance is insufficient.
 * @returns {{ ok: true }}
 */

