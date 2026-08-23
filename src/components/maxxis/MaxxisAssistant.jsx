import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { C } from '../../theme/colors';
import { MAXXIS_WIDGET_POSITION_KEY } from '../../lib/localStoragePolicy';
import {
  analyzeMaxxisProviderConversation,
  cancelMaxxisProfileAction,
  cancelMaxxisProviderContactUnlock,
  confirmMaxxisProfileAction,
  cancelMaxxisProviderMessageSend,
  confirmMaxxisProviderContactUnlock,
  confirmMaxxisProviderMessageSend,
  getMaxxisGreeting,
  prepareMaxxisProviderMessageSend,
  prepareMaxxisProviderMessageDraft,
  prepareMaxxisProviderContactUnlock,
  setMaxxisDealWorkflowManualItem,
  sendMaxxisMessage,
} from '../../services/maxxisService';
import { captureAppException } from '../../lib/observability';
import { trackProductEvent } from '../../lib/productAnalytics';
import {
  buildMaxxisContextSnapshot,
  describeMaxxisContext,
  isSurfaceContextQuestion,
  resolveMaxxisNaturalReference,
  selectMaxxisContextForMessage,
  shouldResetMaxxisContextSession,
} from '../../features/maxxis/context/maxxisContextSnapshot';
import {
  buildLocalDealIntelligenceReply,
  enhanceMaxxisAssistantResponse,
  promptForMaxxisFollowUp,
} from '../../features/maxxis/intelligence/maxxisDealIntelligence';
import {
  buildMaxxisSmartActions,
  findSmartActionTargetService,
  safeSmartActionAnalytics,
} from '../../features/maxxis/actions/maxxisSmartActions';
import {
  buildMaxxisProactiveSignals,
  composeMaxxisProactiveMessage,
  createMaxxisProactiveSessionMemory,
  evaluateMaxxisProactiveAttention,
  MAXXIS_PROACTIVE_DEFAULT_CONFIG,
  markMaxxisProactiveSignalDismissed,
  markMaxxisProactiveSignalSurfaced,
  resetMaxxisProactiveSessionIfNeeded,
  safeProactiveAnalytics,
  selectMaxxisProactiveCandidate,
} from '../../features/maxxis/proactive/maxxisProactiveIntelligence';
import { resolveMaxxisAvatarState } from '../../features/maxxis/avatar/maxxisAvatarStateMachine';
import { MaxxisAvatarRenderer } from '../../features/maxxis/avatar/MaxxisAvatarRenderer';
import { useMaxxisAvatarTimeline } from '../../features/maxxis/avatar/maxxisAvatarTimeline';
import {
  MAXXIS_AVATAR_ANIMATION_INTENSITY,
  MAXXIS_AVATAR_STATES,
} from '../../features/maxxis/avatar/maxxisAvatarStates';
import { fetchFeatureFlags, isFeatureEnabled } from '../../services/featureFlagService';
import './MaxxisAssistant.css';

import {
  COPY,
  MessageBubble,
  PROPERTY_SERVICE_NEEDS_COPY,
  UUID_PATTERN,
  clampWidgetPosition,
  findLatestProviderConversationContext,
  getUiLang,
  isProviderConversationIntent,
  normalizeActionId,
  readStoredWidgetPosition,
  stripActionTokens,
} from './MaxxisCapabilities';

function readMaxxisProactiveFlagOverrides() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  try {
    if (window.localStorage.getItem('ds_e2e_maxxis_proactive') === '1') {
      return { maxxis_proactive_insights: true };
    }
    const raw = window.localStorage.getItem('ds_feature_flag_overrides');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function mergeDevMaxxisProactiveEvents(appContext) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return appContext;
  try {
    const raw = window.localStorage.getItem('ds_e2e_maxxis_proactive_events');
    if (!raw) return appContext;
    const parsed = JSON.parse(raw);
    const events = Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
    if (!events.length) return appContext;
    return {
      ...(appContext || {}),
      proactiveEvents: [...(Array.isArray(appContext?.proactiveEvents) ? appContext.proactiveEvents : []), ...events],
    };
  } catch {
    return appContext;
  }
}

function readDevMaxxisAvatarPresentation() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  try {
    const state = String(window.localStorage.getItem('ds_e2e_maxxis_avatar_state') || '').toUpperCase();
    const intensity = String(window.localStorage.getItem('ds_e2e_maxxis_avatar_intensity') || '').toUpperCase();
    const validState = Object.values(MAXXIS_AVATAR_STATES).includes(state) ? state : '';
    const validIntensity = Object.values(MAXXIS_AVATAR_ANIMATION_INTENSITY).includes(intensity) ? intensity : '';
    return validState || validIntensity
      ? { state: validState, intensity: validIntensity, at: Date.now() }
      : null;
  } catch {
    return null;
  }
}

export function MaxxisAssistant({ page = 'dashboard', onOpenSupport = null, onNavigateAction = null, propertyAnalysisRequest = null, propertyContextId = '', appContext = null, sessionKey = '', onExportAnalysisPdf = null, onNuggetBalanceChange = null, onProviderUnlockConfirmed = null, enabled = true }) {
  const language = getUiLang();
  const t = COPY[language] || COPY.en;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proactiveEnabled, setProactiveEnabled] = useState(false);
  const [exportingAnalysisId, setExportingAnalysisId] = useState(null);
  const [activeProfileActionId, setActiveProfileActionId] = useState('');
  const [activeProviderUnlockId, setActiveProviderUnlockId] = useState('');
  const [activeProviderDraftId, setActiveProviderDraftId] = useState('');
  const [activeProviderMessageSendId, setActiveProviderMessageSendId] = useState('');
  const [activeProviderConversationAnalysisId, setActiveProviderConversationAnalysisId] = useState('');
  const [activeWorkflowItemCode, setActiveWorkflowItemCode] = useState('');
  const [pendingProviderUnlock, setPendingProviderUnlock] = useState(null);
  const [pendingProviderMessageSend, setPendingProviderMessageSend] = useState(null);
  const [devAvatarPresentation, setDevAvatarPresentation] = useState(readDevMaxxisAvatarPresentation);
  const [widgetPosition, setWidgetPosition] = useState(readStoredWidgetPosition);
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState(() => [{
    id: 'maxxis-greeting',
    role: 'assistant',
    content: getMaxxisGreeting(language),
    createdAt: new Date(),
  }]);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const handledAnalysisRequestsRef = useRef(new Set());
  const seenSmartActionsRef = useRef(new Set());
  const detectedProactiveSignalsRef = useRef(new Set());
  const suppressedProactiveSignalsRef = useRef(new Set());
  const proactiveSessionRef = useRef(createMaxxisProactiveSessionMemory(String(sessionKey || '')));
  const maxxisAvatarStateRef = useRef(null);
  const propertyAnalysisRequestRef = useRef(propertyAnalysisRequest);
  const sessionKeyRef = useRef(String(sessionKey || ''));
  const submitMessageRef = useRef(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
  });
  const avatarTimelineIdentityKey = `${String(sessionKey || '')}:${String(
    propertyContextId || appContext?.entity?.propertyId || 'global',
  )}`;
  const {
    pendingProactiveBubble,
    proactiveBubble,
    proactiveSignalSurfaced,
    lastActionResult: lastAvatarActionResult,
    stageProactiveBubble,
    dismissProactiveBubble,
    consumeProactiveBubble,
    clearProactiveBubble,
    markSuccess: markAvatarTimelineSuccess,
    clearSuccess: clearAvatarTimelineSuccess,
    reset: resetAvatarTimeline,
  } = useMaxxisAvatarTimeline({
    identityKey: avatarTimelineIdentityKey,
    enabled,
    intensity: devAvatarPresentation?.intensity || MAXXIS_AVATAR_ANIMATION_INTENSITY.SUBTLE,
  });

  useEffect(() => {
    propertyAnalysisRequestRef.current = propertyAnalysisRequest;
  }, [propertyAnalysisRequest]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return undefined;
    const updatePresentation = () => setDevAvatarPresentation(readDevMaxxisAvatarPresentation());
    window.addEventListener('ds:e2e:maxxis-avatar', updatePresentation);
    return () => window.removeEventListener('ds:e2e:maxxis-avatar', updatePresentation);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setProactiveEnabled(false);
      clearProactiveBubble();
      return () => {
        cancelled = true;
      };
    }
    fetchFeatureFlags({ overrides: readMaxxisProactiveFlagOverrides() })
      .then((snapshot) => {
        if (cancelled) return;
        setProactiveEnabled(isFeatureEnabled(snapshot, 'maxxis_proactive_insights'));
      })
      .catch(() => {
        if (!cancelled) setProactiveEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearProactiveBubble, enabled, sessionKey]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) clearProactiveBubble();
  }, [clearProactiveBubble, open]);

  useEffect(() => {
    if (!open) return undefined;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length || prev[0]?.id !== 'maxxis-greeting') return prev;
      return [{ ...prev[0], content: getMaxxisGreeting(language) }, ...prev.slice(1)];
    });
  }, [language]);

  useEffect(() => {
    const handleResize = () => {
      setWidgetPosition((prev) => {
        const next = clampWidgetPosition(prev);
        if (!next) return prev;
        try {
          window.localStorage.setItem(MAXXIS_WIDGET_POSITION_KEY, JSON.stringify(next));
        } catch {
          // UI preference persistence is best-effort.
        }
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      const deltaX = Math.abs(event.clientX - drag.startX);
      const deltaY = Math.abs(event.clientY - drag.startY);
      if (deltaX > 4 || deltaY > 4) {
        drag.moved = true;
        setDragging(true);
      }
      if (!drag.moved) return;
      event.preventDefault();
      persistWidgetPosition({
        x: event.clientX - drag.offsetX,
        y: event.clientY - drag.offsetY,
      });
    };

    const handlePointerUp = (event) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      dragRef.current = { ...drag, active: false };
      window.setTimeout(() => setDragging(false), 0);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const trimmedInput = input.trim();
  const canSend = Boolean(trimmedInput && !loading);

  const historyForRequest = useMemo(
    () => messages
      .filter((item) => item.id !== 'maxxis-greeting' && !item.error)
      .map((item) => ({ role: item.role, content: stripActionTokens(item.content) })),
    [messages],
  );

  const comparisonPropertyIds = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.type !== 'properties' || !Array.isArray(message.data?.properties)) continue;
      return Array.from(new Set(
        message.data.properties
          .map((property) => String(property?.id || '').trim())
          .filter((id) => UUID_PATTERN.test(id)),
      )).slice(0, 20);
    }
    return [];
  }, [messages]);

  const maxxisContextSnapshot = useMemo(() => buildMaxxisContextSnapshot({
    page,
    propertyId: propertyContextId,
    surface: appContext?.surface || { page },
    serviceId: appContext?.entity?.serviceId || '',
    conversationId: appContext?.entity?.conversationId || '',
    workflowVisible: Boolean(appContext?.entity?.workflowVisible),
    profileScope: appContext?.entity?.profileScope || '',
    appSignals: appContext?.operational || {},
    messages,
    pendingProviderUnlock,
    pendingProviderMessageSend,
    activeProviderUnlockId,
    activeProviderDraftId,
    activeProviderMessageSendId,
    activeProviderConversationAnalysisId,
    activeWorkflowItemCode,
  }), [
    activeProviderConversationAnalysisId,
    activeProviderDraftId,
    activeProviderMessageSendId,
    activeProviderUnlockId,
    activeWorkflowItemCode,
    appContext,
    messages,
    page,
    pendingProviderMessageSend,
    pendingProviderUnlock,
    propertyContextId,
  ]);

  const maxxisAvatarState = useMemo(() => resolveMaxxisAvatarState({
    previousState: maxxisAvatarStateRef.current,
    accountKey: sessionKeyRef.current,
    enabled,
    open,
    loading,
    timelineManaged: true,
    proactiveBubble,
    proactiveSignalSurfaced,
    pendingProviderUnlock,
    pendingProviderMessageSend,
    activeProviderUnlockId,
    activeProviderDraftId,
    activeProviderMessageSendId,
    activeProviderConversationAnalysisId,
    activeWorkflowItemCode,
    activeProfileActionId,
    exportingAnalysisId,
    contextSnapshot: maxxisContextSnapshot,
    appContext,
    lastActionResult: lastAvatarActionResult,
    now: Date.now(),
  }), [
    activeProfileActionId,
    activeProviderConversationAnalysisId,
    activeProviderDraftId,
    activeProviderMessageSendId,
    activeProviderUnlockId,
    activeWorkflowItemCode,
    appContext,
    enabled,
    exportingAnalysisId,
    lastAvatarActionResult,
    loading,
    maxxisContextSnapshot,
    open,
    pendingProviderMessageSend,
    pendingProviderUnlock,
    proactiveBubble,
    proactiveSignalSurfaced,
  ]);

  useEffect(() => {
    maxxisAvatarStateRef.current = maxxisAvatarState;
  }, [maxxisAvatarState]);

  const maxxisAvatarRenderState = useMemo(() => {
    if (!devAvatarPresentation) return maxxisAvatarState;
    const state = devAvatarPresentation.state || maxxisAvatarState.state;
    return {
      ...maxxisAvatarState,
      state,
      intensity: devAvatarPresentation.intensity || maxxisAvatarState.intensity,
      transition: {
        ...maxxisAvatarState.transition,
        to: state,
        at: devAvatarPresentation.at,
      },
    };
  }, [devAvatarPresentation, maxxisAvatarState]);

  const resetConversation = useCallback(() => {
    setMessages([{
      id: `maxxis-greeting-${Date.now()}`,
      role: 'assistant',
      content: getMaxxisGreeting(language),
      createdAt: new Date(),
    }]);
    setInput('');
    setPendingProviderUnlock(null);
    setPendingProviderMessageSend(null);
    setActiveProviderDraftId('');
    setActiveProviderMessageSendId('');
    setActiveProviderConversationAnalysisId('');
    clearAvatarTimelineSuccess();
  }, [clearAvatarTimelineSuccess, language]);

  const markAvatarActionSuccess = useCallback((status = 'completed') => {
    markAvatarTimelineSuccess({ status });
  }, [markAvatarTimelineSuccess]);

  useEffect(() => {
    const nextSessionKey = String(sessionKey || '');
    proactiveSessionRef.current = resetMaxxisProactiveSessionIfNeeded(proactiveSessionRef.current, nextSessionKey);
    if (!shouldResetMaxxisContextSession(sessionKeyRef.current, nextSessionKey)) return;
    sessionKeyRef.current = nextSessionKey;
    handledAnalysisRequestsRef.current.clear();
    detectedProactiveSignalsRef.current.clear();
    suppressedProactiveSignalsRef.current.clear();
    resetAvatarTimeline();
    setOpen(false);
    resetConversation();
  }, [resetAvatarTimeline, resetConversation, sessionKey]);

  const persistWidgetPosition = (position) => {
    const next = clampWidgetPosition(position);
    if (!next) return;
    setWidgetPosition(next);
    try {
      window.localStorage.setItem(MAXXIS_WIDGET_POSITION_KEY, JSON.stringify(next));
    } catch {
      // UI preference persistence is best-effort.
    }
  };

  const handleFabPointerDown = (event) => {
    if (open || event.button > 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handleAction = (actionId) => {
    const normalized = normalizeActionId(actionId);
    if (!normalized) return;
    setOpen(false);
    if (normalized === 'support') {
      onOpenSupport?.();
      return;
    }
    onNavigateAction?.(normalized);
  };

  const submitMessage = async (messageText, meta = {}) => {
    const cleanMessage = String(messageText || '').trim();
    if (!cleanMessage || loading) return;
    const userMessage = {
      id: `maxxis-user-${Date.now()}`,
      role: 'user',
      content: cleanMessage,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      if (isProviderConversationIntent(cleanMessage)) {
        const providerConversationContext = findLatestProviderConversationContext(messages);
        if (!providerConversationContext) {
          setMessages((prev) => [...prev, {
            id: `maxxis-provider-conversation-context-missing-${Date.now()}`,
            role: 'assistant',
            content: t.providerConversationContextMissing,
            createdAt: new Date(),
          }]);
          return;
        }
        const result = await analyzeMaxxisProviderConversation({
          ...providerConversationContext,
          question: cleanMessage,
        });
        setMessages((prev) => [...prev, {
          id: `maxxis-provider-conversation-analysis-${Date.now()}`,
          role: 'assistant',
          content: result?.data?.summary || t.unavailable,
          createdAt: new Date(),
          type: 'provider_conversation_analysis',
          data: result?.data || null,
        }]);
        return;
      }
      if (isSurfaceContextQuestion(cleanMessage)) {
        setMessages((prev) => [...prev, {
          id: `maxxis-context-${Date.now()}`,
          role: 'assistant',
          content: describeMaxxisContext(maxxisContextSnapshot, language),
          createdAt: new Date(),
          type: 'context_snapshot',
          data: {
            contextVersion: maxxisContextSnapshot.contextVersion,
            surface: maxxisContextSnapshot.surface,
            entity: maxxisContextSnapshot.entity,
            operational: maxxisContextSnapshot.operational,
            freshness: maxxisContextSnapshot.freshness,
          },
        }]);
        return;
      }
      const localDealIntelligence = buildLocalDealIntelligenceReply({
        message: cleanMessage,
        language,
        messages,
        sourceMessageId: meta.sourceMessageId || '',
        forcedIntent: meta.controlledIntent || '',
      });
      if (localDealIntelligence) {
        if (localDealIntelligence.eventName) {
          void trackProductEvent(localDealIntelligence.eventName, {
            dedupeKey: `${localDealIntelligence.eventName}:${userMessage.id}`,
            properties: { source: 'maxxis', response_type: localDealIntelligence.type },
          });
        }
        setMessages((prev) => [...prev, {
          id: `maxxis-intelligence-${Date.now()}`,
          role: 'assistant',
          content: localDealIntelligence.content,
          createdAt: new Date(),
          type: localDealIntelligence.type,
          data: localDealIntelligence.data,
          followUps: localDealIntelligence.followUps,
          smartActionsEnabled: localDealIntelligence.type === 'deal_snapshot',
          smartActionSurface: 'snapshot',
        }]);
        return;
      }
      const referenceResolution = resolveMaxxisNaturalReference(cleanMessage, maxxisContextSnapshot);
      if (referenceResolution.status === 'ambiguous') {
        const entityLabel = String(referenceResolution.entityType || 'item').toLowerCase();
        setMessages((prev) => [...prev, {
          id: `maxxis-context-ambiguous-${Date.now()}`,
          role: 'assistant',
          content: language === 'pt'
            ? `Encontrei ${referenceResolution.count || 'varias'} opcoes de ${entityLabel}. Qual delas voce quer usar?`
            : language === 'es'
              ? `Encontre ${referenceResolution.count || 'varias'} opciones de ${entityLabel}. Cual quieres usar?`
              : `I found ${referenceResolution.count || 'multiple'} ${entityLabel} options. Which one do you want to use?`,
          createdAt: new Date(),
          type: 'context_clarification',
          data: { entityType: referenceResolution.entityType || 'UNKNOWN', count: referenceResolution.count || 0 },
        }]);
        return;
      }
      const resolvedPropertyId = referenceResolution.status === 'resolved' && referenceResolution.entity?.type === 'PROPERTY'
        ? referenceResolution.entity.id
        : '';
      const result = await sendMaxxisMessage({
        message: cleanMessage,
        history: historyForRequest,
        page,
        language,
        propertyId: propertyContextId || resolvedPropertyId,
        propertyIds: comparisonPropertyIds,
        maxxisContext: selectMaxxisContextForMessage(maxxisContextSnapshot, cleanMessage),
      });
      const responseType = String(result?.type || 'text');
      if (responseType === 'properties') {
        void trackProductEvent('maxxis_property_search', { dedupeKey: `maxxis-search:${userMessage.id}`, properties: { source: 'maxxis', response_type: responseType } });
      }
      if (responseType === 'deal_copilot_overview') {
        const propertyId = String(result?.data?.property?.id || propertyContextId || '');
        void trackProductEvent('deal_copilot_opened', { entityType: 'property', entityId: propertyId, dedupeKey: `deal-copilot:${userMessage.id}`, properties: { source: 'maxxis', response_type: responseType } });
      }
      const providerCount = Array.isArray(result?.data?.services)
        ? result.data.services.length
        : (Array.isArray(result?.data?.serviceMatches) ? result.data.serviceMatches.reduce((total, match) => total + (Array.isArray(match?.services) ? match.services.length : 0), 0) : 0);
      if (providerCount > 0) {
        void trackProductEvent('provider_suggested', { dedupeKey: `provider-suggested:${userMessage.id}`, properties: { source: 'maxxis', provider_count: providerCount, response_type: responseType } });
      }
      if (result?.data?.nextBestAction?.code) {
        void trackProductEvent('next_best_action_seen', { entityType: 'property', entityId: result?.data?.property?.id || propertyContextId, dedupeKey: `next-action-seen:${userMessage.id}`, properties: { source: 'maxxis', workflow_code: result.data.nextBestAction.code } });
      }
      const intelligence = enhanceMaxxisAssistantResponse({
        message: cleanMessage,
        result,
        language,
        forcedIntent: meta.controlledIntent || '',
      });
      if (intelligence.eventName) {
        void trackProductEvent(intelligence.eventName, {
          entityType: 'property',
          entityId: result?.data?.property?.id || result?.data?.propertySummary?.id || propertyContextId || '',
          dedupeKey: `${intelligence.eventName}:${userMessage.id}`,
          properties: { source: 'maxxis', response_type: intelligence.type || responseType },
        });
      }
      setMessages((prev) => [...prev, {
        id: `maxxis-assistant-${Date.now()}`,
        role: 'assistant',
        content: intelligence.content || result.answer,
        createdAt: new Date(),
        error: Boolean(result.unavailable),
        type: intelligence.type || result.type,
        data: intelligence.data || result.data,
        followUps: intelligence.followUps,
        smartActionsEnabled: intelligence.type === 'deal_snapshot',
        smartActionSurface: 'snapshot',
        analysisExport: result.unavailable ? null : (meta.analysisExport || null),
      }]);
    } catch (error) {
      captureAppException(error, { area: 'maxxis_assistant', page });
      setMessages((prev) => [...prev, {
        id: `maxxis-error-${Date.now()}`,
        role: 'assistant',
        content: t.unavailable,
        createdAt: new Date(),
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    submitMessageRef.current = submitMessage;
  });

  const updateProfileSuggestionMessage = (messageId, pendingActionId, feedback) => {
    setMessages((prev) => prev.map((message) => {
      if (message.id !== messageId) return message;
      const suggestions = Array.isArray(message.data?.profileSuggestions)
        ? message.data.profileSuggestions.filter((item) => String(item.pendingActionId || '') !== pendingActionId)
        : [];
      return { ...message, data: { ...(message.data || {}), profileSuggestions: suggestions, profileActionFeedback: feedback } };
    }));
  };

  const handleConfirmProfileSuggestion = async (messageId, suggestion) => {
    const actionId = String(suggestion?.pendingActionId || '');
    if (!actionId || activeProfileActionId) return;
    setActiveProfileActionId(actionId);
    try {
      await confirmMaxxisProfileAction(actionId);
      updateProfileSuggestionMessage(messageId, actionId, { status: 'success', value: suggestion.suggestedValue });
      markAvatarActionSuccess('profile_updated');
    } catch (error) {
      captureAppException(error, { area: 'maxxis_profile_action_confirm', operation: suggestion?.operation });
      setMessages((prev) => prev.map((message) => message.id === messageId
        ? { ...message, data: { ...(message.data || {}), profileActionFeedback: { status: 'error' } } }
        : message));
    } finally {
      setActiveProfileActionId('');
    }
  };

  const handleCancelProfileSuggestion = async (messageId, suggestion) => {
    const actionId = String(suggestion?.pendingActionId || '');
    if (!actionId || activeProfileActionId) return;
    setActiveProfileActionId(actionId);
    try {
      await cancelMaxxisProfileAction(actionId);
      updateProfileSuggestionMessage(messageId, actionId, null);
    } catch (error) {
      captureAppException(error, { area: 'maxxis_profile_action_cancel', operation: suggestion?.operation });
      setMessages((prev) => prev.map((message) => message.id === messageId
        ? { ...message, data: { ...(message.data || {}), profileActionFeedback: { status: 'error' } } }
        : message));
    } finally {
      setActiveProfileActionId('');
    }
  };

  const updateProviderContactAccess = (messageId, serviceId, contactAccess, contact = null) => {
    const cleanServiceId = String(serviceId || '');
    setMessages((prev) => prev.map((message) => {
      if (message.id !== messageId) return message;
      const updateService = (service) => {
        if (String(service?.id || '') !== cleanServiceId) return service;
        return {
          ...service,
          contactAccess: {
            ...(service.contactAccess || {}),
            ...(contactAccess || {}),
            ...(contact ? { contact } : {}),
          },
        };
      };
      const data = { ...(message.data || {}) };
      if (Array.isArray(data.services)) data.services = data.services.map(updateService);
      if (Array.isArray(data.serviceMatches)) {
        data.serviceMatches = data.serviceMatches.map((match) => ({
          ...match,
          services: Array.isArray(match.services) ? match.services.map(updateService) : match.services,
        }));
      }
      return { ...message, data };
    }));
  };

  const handlePrepareProviderUnlock = async (messageId, service) => {
    const serviceId = String(service?.id || '');
    if (!serviceId || activeProviderUnlockId) return;
    const startedAt = Date.now();
    setActiveProviderUnlockId(serviceId);
    try {
      const result = await prepareMaxxisProviderContactUnlock(serviceId);
      if (result?.contactAccess) {
        updateProviderContactAccess(messageId, serviceId, result.contactAccess, result.contact || null);
      }
      setPendingProviderUnlock(result?.action?.intentToken
        ? { ...result.action, messageId, serviceId }
        : null);
      void trackProductEvent('provider_unlock_started', { entityType: 'service', entityId: serviceId, dedupeKey: `provider-unlock-started:${result?.action?.intentToken || serviceId}`, properties: { source: 'maxxis' } });
      void trackProductEvent('maxxis_action_prepared', {
        entityType: 'service',
        entityId: serviceId,
        dedupeKey: `smart-action-prepared:UNLOCK_PROVIDER_CONTACT:${result?.action?.intentToken || serviceId}`,
        properties: safeSmartActionAnalytics({ code: 'UNLOCK_PROVIDER_CONTACT', state: 'available', capability: 'provider_contact_unlock' }, { result: result?.action?.intentToken ? 'awaiting_confirmation' : 'prepared', duration: Date.now() - startedAt, surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
      });
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_unlock_prepare', serviceId });
      if (error?.contactAccess) updateProviderContactAccess(messageId, serviceId, error.contactAccess);
      void trackProductEvent('maxxis_action_failed', {
        entityType: 'service',
        entityId: serviceId,
        dedupeKey: `smart-action-failed:UNLOCK_PROVIDER_CONTACT:prepare:${serviceId}:${Date.now()}`,
        properties: safeSmartActionAnalytics({ code: 'UNLOCK_PROVIDER_CONTACT', state: 'available', capability: 'provider_contact_unlock' }, { result: 'prepare_failed', duration: Date.now() - startedAt, surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
      });
    } finally {
      setActiveProviderUnlockId('');
    }
  };

  const handleConfirmProviderUnlock = async (pending) => {
    const serviceId = String(pending?.serviceId || '');
    const intentToken = String(pending?.intentToken || '');
    if (!serviceId || !intentToken || activeProviderUnlockId) return;
    const preparedMessage = messages.find((message) => message.id === pending.messageId);
    const stillValid = Boolean(preparedMessage) && JSON.stringify(preparedMessage?.data || {}).includes(serviceId);
    if (!stillValid) {
      setPendingProviderUnlock(null);
      setMessages((prev) => [...prev, {
        id: `maxxis-action-stale-${Date.now()}`,
        role: 'assistant',
        content: language === 'pt' ? 'O contexto mudou. Nada foi alterado.' : language === 'es' ? 'El contexto cambio. No se modifico nada.' : 'The context changed. Nothing was changed.',
        createdAt: new Date(),
        type: 'smart_action_feedback',
        data: { status: 'STALE_CONTEXT', actionCode: 'UNLOCK_PROVIDER_CONTACT' },
      }]);
      void trackProductEvent('maxxis_action_failed', {
        entityType: 'service',
        entityId: serviceId,
        dedupeKey: `smart-action-stale:UNLOCK_PROVIDER_CONTACT:${intentToken}`,
        properties: safeSmartActionAnalytics({ code: 'UNLOCK_PROVIDER_CONTACT', state: 'blocked', capability: 'provider_contact_unlock' }, { result: 'stale_context', surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
      });
      return;
    }
    const startedAt = Date.now();
    setActiveProviderUnlockId(serviceId);
    try {
      const result = await confirmMaxxisProviderContactUnlock({ serviceId, intentToken });
      updateProviderContactAccess(
        pending.messageId,
        serviceId,
        result?.contactAccess || { status: 'already_unlocked', cost: 0, currency: 'nuggets' },
        result?.contact || null,
      );
      const confirmedBalance = result?.remainingNuggets ?? result?.remaining_nuggets ?? null;
      if (confirmedBalance !== null && typeof onNuggetBalanceChange === 'function') {
        onNuggetBalanceChange(confirmedBalance);
      }
      if (typeof onProviderUnlockConfirmed === 'function') onProviderUnlockConfirmed(result);
      markAvatarActionSuccess('unlocked');
      void trackProductEvent('provider_unlocked', { entityType: 'service', entityId: serviceId, dedupeKey: `provider-unlocked:${intentToken}`, properties: { source: 'maxxis', status: result?.contactAccess?.status || 'unlocked' } });
      void trackProductEvent('maxxis_action_completed', {
        entityType: 'service',
        entityId: serviceId,
        dedupeKey: `smart-action-completed:UNLOCK_PROVIDER_CONTACT:${intentToken}`,
        properties: safeSmartActionAnalytics({ code: 'UNLOCK_PROVIDER_CONTACT', state: 'available', capability: 'provider_contact_unlock' }, { result: 'success', duration: Date.now() - startedAt, surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
      });
      setPendingProviderUnlock(null);
      setMessages((prev) => [...prev, {
        id: `maxxis-action-unlock-success-${Date.now()}`,
        role: 'assistant',
        content: language === 'pt' ? 'Contato desbloqueado.' : language === 'es' ? 'Contacto desbloqueado.' : 'Contact unlocked.',
        createdAt: new Date(),
        type: 'smart_action_feedback',
        data: { status: 'SUCCESS', actionCode: 'UNLOCK_PROVIDER_CONTACT', serviceId },
      }]);
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_unlock_confirm', serviceId });
      if (error?.contactAccess) updateProviderContactAccess(pending.messageId, serviceId, error.contactAccess);
      void trackProductEvent('maxxis_action_failed', {
        entityType: 'service',
        entityId: serviceId,
        dedupeKey: `smart-action-failed:UNLOCK_PROVIDER_CONTACT:confirm:${intentToken}`,
        properties: safeSmartActionAnalytics({ code: 'UNLOCK_PROVIDER_CONTACT', state: 'available', capability: 'provider_contact_unlock' }, { result: 'confirm_failed', duration: Date.now() - startedAt, surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
      });
    } finally {
      setActiveProviderUnlockId('');
    }
  };

  const handleCancelProviderUnlock = async (pending) => {
    const serviceId = String(pending?.serviceId || '');
    const intentToken = String(pending?.intentToken || '');
    if (!serviceId || !intentToken || activeProviderUnlockId) return;
    setActiveProviderUnlockId(serviceId);
    try {
      await cancelMaxxisProviderContactUnlock(intentToken);
      setPendingProviderUnlock(null);
      void trackProductEvent('maxxis_action_cancelled', {
        entityType: 'service',
        entityId: serviceId,
        dedupeKey: `smart-action-cancelled:UNLOCK_PROVIDER_CONTACT:${intentToken}`,
        properties: safeSmartActionAnalytics({ code: 'UNLOCK_PROVIDER_CONTACT', state: 'pending', capability: 'provider_contact_unlock' }, { result: 'cancelled', surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
      });
      setMessages((prev) => [...prev, {
        id: `maxxis-action-cancelled-${Date.now()}`,
        role: 'assistant',
        content: language === 'pt' ? 'Nada foi alterado.' : language === 'es' ? 'No se modifico nada.' : 'Nothing was changed.',
        createdAt: new Date(),
        type: 'smart_action_feedback',
        data: { status: 'CANCELLED', actionCode: 'UNLOCK_PROVIDER_CONTACT', serviceId },
      }]);
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_unlock_cancel', serviceId });
    } finally {
      setActiveProviderUnlockId('');
    }
  };

  const handlePrepareProviderMessageDraft = async (messageId, service, propertyId) => {
    const serviceId = String(service?.id || '');
    const cleanPropertyId = String(propertyId || '');
    if (!serviceId || !cleanPropertyId || activeProviderDraftId) return;
    const startedAt = Date.now();
    setActiveProviderDraftId(serviceId);
    try {
      const result = await prepareMaxxisProviderMessageDraft({ serviceId, propertyId: cleanPropertyId, language });
      if (result?.data?.draft) {
        void trackProductEvent('provider_message_drafted', { entityType: 'service', entityId: serviceId, dedupeKey: `provider-message-drafted:${serviceId}:${cleanPropertyId}`, properties: { source: 'maxxis' } });
        void trackProductEvent('maxxis_action_prepared', {
          entityType: 'service',
          entityId: serviceId,
          dedupeKey: `smart-action-prepared:DRAFT_PROVIDER_MESSAGE:${serviceId}:${cleanPropertyId}`,
          properties: safeSmartActionAnalytics({ code: 'DRAFT_PROVIDER_MESSAGE', state: 'available', capability: 'provider_message_draft' }, { result: 'draft_ready', duration: Date.now() - startedAt, surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
        });
        setMessages((prev) => [...prev, {
          id: `maxxis-provider-message-draft-${Date.now()}`,
          role: 'assistant',
          content: result.message || 'Provider message draft prepared.',
          createdAt: new Date(),
          type: 'provider_message_draft',
          data: result.data,
          smartActionsEnabled: true,
          smartActionSurface: 'message',
        }]);
      }
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_message_draft', serviceId, propertyId: cleanPropertyId });
      if (error?.contactAccess) updateProviderContactAccess(messageId, serviceId, error.contactAccess);
      const copy = PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en;
      setMessages((prev) => [...prev, {
        id: `maxxis-provider-message-draft-error-${Date.now()}`,
        role: 'assistant',
        content: copy.draftUnavailable,
        createdAt: new Date(),
        error: true,
      }]);
      void trackProductEvent('maxxis_action_failed', {
        entityType: 'service',
        entityId: serviceId,
        dedupeKey: `smart-action-failed:DRAFT_PROVIDER_MESSAGE:${serviceId}:${Date.now()}`,
        properties: safeSmartActionAnalytics({ code: 'DRAFT_PROVIDER_MESSAGE', state: 'available', capability: 'provider_message_draft' }, { result: 'draft_failed', duration: Date.now() - startedAt, surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
      });
    } finally {
      setActiveProviderDraftId('');
    }
  };

  const handleUpdateProviderMessageDraft = (messageId, draft) => {
    setMessages((prev) => prev.map((message) => (message.id === messageId
      ? { ...message, data: { ...(message.data || {}), draft: String(draft || '').slice(0, 1800), sendError: null, sendIdempotencyKey: null } }
      : message)));
    setPendingProviderMessageSend((current) => (current?.messageId === messageId ? null : current));
  };

  const updateProviderMessageDraftSendState = (messageId, patch) => {
    setMessages((prev) => prev.map((message) => (message.id === messageId
      ? { ...message, data: { ...(message.data || {}), ...(patch || {}) } }
      : message)));
  };

  const handlePrepareProviderMessageSend = async (message) => {
    const messageId = String(message?.id || '');
    const serviceId = String(message?.data?.serviceId || '');
    const propertyId = String(message?.data?.propertyId || '');
    const messageText = String(message?.data?.draft || message?.data?.suggestedReply || '').trim();
    if (!messageId || !serviceId || !propertyId || !messageText || activeProviderMessageSendId) return;
    const idempotencyKey = String(message?.data?.sendIdempotencyKey || `maxxis-send:${messageId}:${Date.now()}`).slice(0, 120);
    updateProviderMessageDraftSendState(messageId, { sendIdempotencyKey: idempotencyKey, sendError: null });
    setActiveProviderMessageSendId(messageId);
    try {
      const result = await prepareMaxxisProviderMessageSend({
        serviceId,
        propertyId,
        message: messageText,
        idempotencyKey,
      });
      if (result?.data?.actionId) {
        setPendingProviderMessageSend({
          ...result.data,
          messageId,
          draftSnapshot: messageText,
          sourceType: message.type || '',
        });
      }
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_message_prepare', serviceId, propertyId });
      updateProviderMessageDraftSendState(messageId, { sendError: String(error?.code || error?.message || 'send_prepare_failed') });
    } finally {
      setActiveProviderMessageSendId('');
    }
  };

  const handleConfirmProviderMessageSend = async (pending) => {
    const actionId = String(pending?.actionId || '');
    const messageId = String(pending?.messageId || '');
    if (!actionId || !messageId || activeProviderMessageSendId) return;
    setActiveProviderMessageSendId(actionId);
    try {
      const result = await confirmMaxxisProviderMessageSend(actionId);
      updateProviderMessageDraftSendState(messageId, {
        sentStatus: result?.data?.status || 'sent',
        sentMessageId: result?.data?.messageId || null,
        sendError: null,
      });
      setPendingProviderMessageSend(null);
      markAvatarActionSuccess('sent');
      void trackProductEvent('provider_message_sent', { entityType: 'service', entityId: pending?.serviceId, dedupeKey: `provider-message-sent:${result?.data?.messageId || actionId}`, properties: { source: 'maxxis', status: result?.data?.status || 'sent' } });
      void trackProductEvent('maxxis_action_completed', {
        entityType: 'service',
        entityId: pending?.serviceId,
        dedupeKey: `smart-action-completed:PROVIDER_MESSAGE_SEND:${result?.data?.messageId || actionId}`,
        properties: safeSmartActionAnalytics({ code: 'DRAFT_PROVIDER_MESSAGE', state: 'available', capability: 'provider_message_send' }, { result: 'message_sent', surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
      });
      const sendCopy = PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en;
      setMessages((prev) => [...prev, {
        id: `maxxis-provider-message-sent-${Date.now()}`,
        role: 'assistant',
        content: pending?.sourceType === 'provider_conversation_analysis' ? sendCopy.replySent : sendCopy.messageSent,
        createdAt: new Date(),
        type: 'provider_message_sent',
        data: result?.data || { serviceId: pending.serviceId, propertyId: pending.propertyId, status: 'sent' },
        smartActionsEnabled: true,
        smartActionSurface: 'conversation',
      }]);
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_message_confirm', actionId });
      updateProviderMessageDraftSendState(messageId, { sendError: String(error?.code || error?.message || 'send_confirm_failed') });
    } finally {
      setActiveProviderMessageSendId('');
    }
  };

  const handleCancelProviderMessageSend = async (pending) => {
    const actionId = String(pending?.actionId || '');
    const messageId = String(pending?.messageId || '');
    if (!actionId || activeProviderMessageSendId) return;
    setActiveProviderMessageSendId(actionId);
    try {
      await cancelMaxxisProviderMessageSend(actionId);
      setPendingProviderMessageSend(null);
      if (messageId) updateProviderMessageDraftSendState(messageId, { sendError: null });
      void trackProductEvent('maxxis_action_cancelled', {
        entityType: 'service',
        entityId: pending?.serviceId,
        dedupeKey: `smart-action-cancelled:PROVIDER_MESSAGE_SEND:${actionId}`,
        properties: safeSmartActionAnalytics({ code: 'DRAFT_PROVIDER_MESSAGE', state: 'pending', capability: 'provider_message_send' }, { result: 'cancelled', surface: page, contextVersion: maxxisContextSnapshot.contextVersion }),
      });
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_message_cancel', actionId });
      if (messageId) updateProviderMessageDraftSendState(messageId, { sendError: String(error?.code || error?.message || 'send_cancel_failed') });
    } finally {
      setActiveProviderMessageSendId('');
    }
  };

  const handleAnalyzeProviderConversation = async (message) => {
    const messageId = String(message?.id || '');
    const serviceId = String(message?.data?.serviceId || '');
    const propertyId = String(message?.data?.propertyId || '');
    if (!messageId || !serviceId || activeProviderConversationAnalysisId) return;
    setActiveProviderConversationAnalysisId(messageId);
    try {
      const result = await analyzeMaxxisProviderConversation({ serviceId, propertyId });
      setMessages((prev) => [...prev, {
        id: `maxxis-provider-conversation-analysis-${Date.now()}`,
        role: 'assistant',
        content: result?.data?.summary || 'Conversation analysis prepared.',
        createdAt: new Date(),
        type: 'provider_conversation_analysis',
        data: result?.data || null,
        smartActionsEnabled: true,
        smartActionSurface: 'conversation',
      }]);
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_conversation_analysis', serviceId, propertyId });
      const copy = PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en;
      setMessages((prev) => [...prev, {
        id: `maxxis-provider-conversation-analysis-error-${Date.now()}`,
        role: 'assistant',
        content: copy.analysisUnavailable,
        createdAt: new Date(),
        error: true,
      }]);
    } finally {
      setActiveProviderConversationAnalysisId('');
    }
  };

  const handleUpdateProviderConversationSuggestedReply = (messageId, suggestedReply) => {
    setMessages((prev) => prev.map((message) => (message.id === messageId
      ? { ...message, data: { ...(message.data || {}), suggestedReply: String(suggestedReply || '').slice(0, 1800), sendError: null, sendIdempotencyKey: null } }
      : message)));
    setPendingProviderMessageSend((current) => (current?.messageId === messageId ? null : current));
  };

  const handleToggleWorkflowManualItem = async (message, entry, status) => {
    const messageId = String(message?.id || '');
    const propertyId = String(message?.data?.property?.id || entry?.propertyId || '');
    const code = String(entry?.code || '');
    if (!messageId || !UUID_PATTERN.test(propertyId) || !code || activeWorkflowItemCode) return;
    setActiveWorkflowItemCode(code);
    setMessages((prev) => prev.map((item) => (item.id === messageId
      ? { ...item, data: { ...(item.data || {}), workflowError: null } }
      : item)));
    try {
      const workflow = await setMaxxisDealWorkflowManualItem({ propertyId, code, status });
      if (status === 'completed') {
        void trackProductEvent('workflow_item_completed', { entityType: 'property', entityId: propertyId, dedupeKey: `workflow-completed:${propertyId}:${code}`, properties: { source: 'maxxis', workflow_code: code, status } });
      }
      markAvatarActionSuccess('workflow_updated');
      setMessages((prev) => prev.map((item) => (item.id === messageId
        ? { ...item, data: { ...(item.data || {}), workflow, workflowError: null } }
        : item)));
    } catch (error) {
      captureAppException(error, { area: 'maxxis_deal_workflow_manual_item', propertyId, code, status });
      setMessages((prev) => prev.map((item) => (item.id === messageId
        ? { ...item, data: { ...(item.data || {}), workflowError: String(error?.code || error?.message || 'workflow_update_failed') } }
        : item)));
    } finally {
      setActiveWorkflowItemCode('');
    }
  };

  const handleExportAnalysisPdf = async (analysisExport, analysisText, messageId) => {
    if (!analysisExport?.onExportPdf || !onExportAnalysisPdf || exportingAnalysisId) return;
    setExportingAnalysisId(messageId || analysisExport.requestId || 'active');
    try {
      await onExportAnalysisPdf(analysisExport, analysisText);
    } finally {
      setExportingAnalysisId(null);
    }
  };

  const handleDealFollowUp = (followUp, sourceMessage) => {
    const intent = String(followUp?.intent || '');
    const code = String(followUp?.code || intent || '');
    if (!intent || loading) return;
    void trackProductEvent('followup_clicked', {
      dedupeKey: `maxxis-followup:${sourceMessage?.id || 'message'}:${code}`,
      properties: { source: 'maxxis', followup_code: code, intent },
    });
    void submitMessage(promptForMaxxisFollowUp(followUp, language), {
      controlledIntent: intent,
      sourceMessageId: sourceMessage?.id || '',
    });
  };

  const smartActionSourcePayload = (message) => {
    if (!message) return null;
    if (message.data?.sourceData) return { type: message.data.sourceType || 'property_details', data: message.data.sourceData };
    return { type: message.type, data: message.data };
  };

  const getMessageSmartActions = useCallback((message) => {
    if (!message?.smartActionsEnabled) return [];
    return buildMaxxisSmartActions(smartActionSourcePayload(message), {
      language,
      pendingProviderUnlock,
      surface: message.smartActionSurface || (message.type === 'smart_provider_actions' ? 'providers' : 'snapshot'),
      maxVisible: 3,
    }).filter((action) => action.enabled);
  }, [language, pendingProviderUnlock]);

  useEffect(() => {
    messages.forEach((message) => {
      if (!message?.smartActionsEnabled) return;
      getMessageSmartActions(message).forEach((action) => {
        const key = `${message.id}:${action.code}:${action.state}`;
        if (seenSmartActionsRef.current.has(key)) return;
        seenSmartActionsRef.current.add(key);
        void trackProductEvent('maxxis_smart_action_seen', {
          entityType: action.target?.serviceId ? 'service' : 'property',
          entityId: action.target?.serviceId || action.target?.propertyId || propertyContextId || '',
          dedupeKey: `smart-action-seen:${key}`,
          properties: safeSmartActionAnalytics(action, {
            result: 'seen',
            surface: message.smartActionSurface || page,
            contextVersion: maxxisContextSnapshot.contextVersion,
          }),
        });
      });
    });
  }, [getMessageSmartActions, maxxisContextSnapshot.contextVersion, messages, page, propertyContextId]);

  const latestStructuredDealMessage = useCallback(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role !== 'assistant' || message?.error) continue;
      if (message.type === 'property_details' || message.type === 'deal_copilot_overview' || message.data?.property || message.data?.propertySummary) {
        return message;
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    const avatarBusy = [
      MAXXIS_AVATAR_STATES.PROCESSING,
      MAXXIS_AVATAR_STATES.WAITING,
      MAXXIS_AVATAR_STATES.SUCCESS,
    ].includes(maxxisAvatarState.state);
    if (!proactiveEnabled || open || proactiveBubble || pendingProactiveBubble || loading || avatarBusy) return;
    const proactiveAppContext = mergeDevMaxxisProactiveEvents(appContext);
    const signals = buildMaxxisProactiveSignals({
      contextSnapshot: maxxisContextSnapshot,
      appContext: proactiveAppContext,
      messages,
      now: Date.now(),
      accountKey: sessionKeyRef.current,
    });
    signals.forEach((signal) => {
      if (!detectedProactiveSignalsRef.current.has(signal.dedupeKey)) {
        detectedProactiveSignalsRef.current.add(signal.dedupeKey);
        void trackProductEvent('maxxis_proactive_signal_detected', {
          entityType: signal.entityType?.toLowerCase?.() || 'product',
          entityId: '',
          dedupeKey: `proactive-detected:${signal.dedupeKey}`,
          properties: safeProactiveAnalytics(signal, {}, {
            surface: page,
            contextVersion: maxxisContextSnapshot.contextVersion,
          }),
        });
      }
      const attention = evaluateMaxxisProactiveAttention(signal, {
        config: { enabled: proactiveEnabled },
        contextSnapshot: maxxisContextSnapshot,
        sessionMemory: proactiveSessionRef.current,
        now: Date.now(),
        maxxisOpen: open,
        userActivity: {
          typing: Boolean(input.trim()),
          modalOpen: Boolean(appContext?.surface?.modal),
        },
      });
      if (!attention.shouldSurface) {
        const suppressKey = `${signal.dedupeKey}:${attention.reasonCode}`;
        if (!suppressedProactiveSignalsRef.current.has(suppressKey)) {
          suppressedProactiveSignalsRef.current.add(suppressKey);
          void trackProductEvent('maxxis_proactive_signal_suppressed', {
            entityType: signal.entityType?.toLowerCase?.() || 'product',
            entityId: '',
            dedupeKey: `proactive-suppressed:${suppressKey}`,
            properties: safeProactiveAnalytics(signal, attention, {
              surface: page,
              contextVersion: maxxisContextSnapshot.contextVersion,
            }),
          });
        }
      }
    });
    const candidate = selectMaxxisProactiveCandidate(signals, {
      config: { enabled: proactiveEnabled },
      contextSnapshot: maxxisContextSnapshot,
      sessionMemory: proactiveSessionRef.current,
      now: Date.now(),
      maxxisOpen: open,
      userActivity: {
        typing: Boolean(input.trim()),
        modalOpen: Boolean(appContext?.surface?.modal),
      },
    });
    if (!candidate) return;
    const message = composeMaxxisProactiveMessage(candidate.signal, language);
    const bubble = {
      id: `maxxis-proactive-${candidate.signal.dedupeKey}`,
      signal: candidate.signal,
      attention: candidate.attention,
      message,
    };
    const staged = stageProactiveBubble(bubble, {
      autoDismissMs: MAXXIS_PROACTIVE_DEFAULT_CONFIG.autoDismissMs,
    });
    if (!staged) return;
    markMaxxisProactiveSignalSurfaced(proactiveSessionRef.current, candidate.signal, Date.now());
    void trackProductEvent('maxxis_proactive_signal_surfaced', {
      entityType: candidate.signal.entityType?.toLowerCase?.() || 'product',
      entityId: '',
      dedupeKey: `proactive-surfaced:${candidate.signal.dedupeKey}`,
      properties: safeProactiveAnalytics(candidate.signal, candidate.attention, {
        surface: page,
        contextVersion: maxxisContextSnapshot.contextVersion,
      }),
    });
  }, [
    appContext,
    input,
    language,
    loading,
    maxxisContextSnapshot,
    maxxisAvatarState.state,
    messages,
    open,
    page,
    pendingProactiveBubble,
    proactiveBubble,
    proactiveEnabled,
    stageProactiveBubble,
  ]);

  const appendSmartProviderMessage = (sourceMessage) => {
    const payload = smartActionSourcePayload(sourceMessage);
    const data = payload?.data?.sourceData || payload?.data || null;
    if (!data?.property || !Array.isArray(data?.serviceNeeds)) return;
    setMessages((prev) => [...prev, {
      id: `maxxis-smart-providers-${Date.now()}`,
      role: 'assistant',
      content: language === 'pt'
        ? 'Providers carregados para este deal. Nada sera desbloqueado sem sua confirmacao.'
        : language === 'es'
          ? 'Providers cargados para este deal. Nada se desbloquea sin tu confirmacion.'
          : 'Providers loaded for this deal. Nothing will be unlocked without your confirmation.',
      createdAt: new Date(),
      type: 'smart_provider_actions',
      data,
      smartActionsEnabled: true,
      smartActionSurface: 'providers',
    }]);
  };

  const appendProactiveContextMessage = (bubble) => {
    const signal = bubble?.signal || {};
    const serviceId = signal.evidence?.serviceId || (signal.entityType === 'SERVICE' ? signal.entityId : '');
    const propertyIdForSignal = signal.evidence?.propertyId || (signal.entityType === 'PROPERTY' ? signal.entityId : propertyContextId);
    if (signal.code === 'PROVIDER_REPLIED' || signal.code === 'PROVIDER_QUOTE_DETECTED') {
      setMessages((prev) => [...prev, {
        id: `maxxis-proactive-context-${Date.now()}`,
        role: 'assistant',
        content: language === 'pt'
          ? 'Contexto da resposta do provider carregado. Nada sera enviado sem sua confirmacao.'
          : language === 'es'
            ? 'Contexto de la respuesta del provider cargado. Nada se enviara sin tu confirmacion.'
            : 'Provider reply context loaded. Nothing will be sent without your confirmation.',
        createdAt: new Date(),
        type: 'provider_message_sent',
        data: {
          serviceId,
          propertyId: propertyIdForSignal,
          status: 'reply_received',
          sourceSignalCode: signal.code,
        },
        smartActionsEnabled: true,
        smartActionSurface: 'conversation',
      }]);
      return;
    }
    const structuredMessage = latestStructuredDealMessage();
    if (signal.code === 'SERVICE_MATCH_AVAILABLE' && structuredMessage) {
      appendSmartProviderMessage(structuredMessage);
      return;
    }
    if (structuredMessage?.data) {
      setMessages((prev) => [...prev, {
        id: `maxxis-proactive-deal-${Date.now()}`,
        role: 'assistant',
        content: signal.code === 'WORKFLOW_ITEM_CHANGED'
          ? (language === 'pt'
            ? 'Contexto do workflow carregado. Revise antes de marcar qualquer etapa.'
            : language === 'es'
              ? 'Contexto del workflow cargado. Revisa antes de marcar cualquier etapa.'
              : 'Workflow context loaded. Review before marking any step.')
          : (language === 'pt'
            ? 'Contexto do deal carregado para revisao. Nada foi alterado.'
            : language === 'es'
              ? 'Contexto del deal cargado para revision. Nada fue cambiado.'
              : 'Deal context loaded for review. Nothing was changed.'),
        createdAt: new Date(),
        type: structuredMessage.type || 'property_details',
        data: structuredMessage.data,
        followUps: structuredMessage.followUps,
        smartActionsEnabled: true,
        smartActionSurface: 'snapshot',
      }]);
      return;
    }
    setMessages((prev) => [...prev, {
      id: `maxxis-proactive-fallback-${Date.now()}`,
      role: 'assistant',
      content: language === 'pt'
        ? 'Tenho um sinal contextual para revisar, mas preciso que voce abra ou carregue o deal antes de mostrar detalhes.'
        : language === 'es'
          ? 'Tengo una senal contextual para revisar, pero necesito que abras o cargues el deal antes de mostrar detalles.'
          : 'I have a contextual signal to review, but open or load the deal first before I show details.',
      createdAt: new Date(),
    }]);
  };

  const handleDismissProactiveBubble = () => {
    const currentBubble = dismissProactiveBubble();
    if (!currentBubble) return;
    markMaxxisProactiveSignalDismissed(proactiveSessionRef.current, currentBubble.signal);
    void trackProductEvent('maxxis_proactive_bubble_dismissed', {
      entityType: currentBubble.signal?.entityType?.toLowerCase?.() || 'product',
      entityId: '',
      dedupeKey: `proactive-dismissed:${currentBubble.signal?.dedupeKey || currentBubble.id}`,
      properties: safeProactiveAnalytics(currentBubble.signal, currentBubble.attention, {
        surface: page,
        contextVersion: maxxisContextSnapshot.contextVersion,
      }),
    });
  };

  const handleClickProactiveBubble = () => {
    const currentBubble = consumeProactiveBubble();
    if (!currentBubble) return;
    void trackProductEvent('maxxis_proactive_bubble_clicked', {
      entityType: currentBubble.signal?.entityType?.toLowerCase?.() || 'product',
      entityId: '',
      dedupeKey: `proactive-clicked:${currentBubble.signal?.dedupeKey || currentBubble.id}`,
      properties: safeProactiveAnalytics(currentBubble.signal, currentBubble.attention, {
        surface: page,
        contextVersion: maxxisContextSnapshot.contextVersion,
      }),
    });
    setOpen(true);
    appendProactiveContextMessage(currentBubble);
  };

  const handleSmartAction = (action, sourceMessage) => {
    if (!action?.enabled || loading) return;
    const sourcePayload = smartActionSourcePayload(sourceMessage);
    void trackProductEvent('maxxis_smart_action_clicked', {
      entityType: action.target?.serviceId ? 'service' : 'property',
      entityId: action.target?.serviceId || action.target?.propertyId || propertyContextId || '',
      dedupeKey: `smart-action-clicked:${sourceMessage?.id || 'message'}:${action.code}`,
      properties: safeSmartActionAnalytics(action, {
        result: 'clicked',
        surface: sourceMessage?.smartActionSurface || page,
        contextVersion: maxxisContextSnapshot.contextVersion,
      }),
    });
    if (action.code === 'VIEW_DEAL_GAPS') {
      void submitMessage(promptForMaxxisFollowUp({ code: 'deal_gaps', label: action.label }, language), {
        controlledIntent: 'deal_gaps',
        sourceMessageId: sourceMessage?.id || '',
      });
      return;
    }
    if (action.code === 'EXPLAIN_INSIGHT') {
      void submitMessage(promptForMaxxisFollowUp({ code: 'why_current_signal', label: action.label }, language), {
        controlledIntent: 'explain_current_insight',
        sourceMessageId: sourceMessage?.id || '',
      });
      return;
    }
    if (action.code === 'REVIEW_NEXT_STEP' || action.code === 'REVIEW_WORKFLOW') {
      void submitMessage(promptForMaxxisFollowUp({ code: 'review_next', label: action.label }, language), {
        controlledIntent: 'review_next',
        sourceMessageId: sourceMessage?.id || '',
      });
      return;
    }
    if (action.code === 'COMPARE_PROPERTIES') {
      void submitMessage(promptForMaxxisFollowUp({ code: 'compare_these', label: action.label }, language), {
        controlledIntent: 'compare_these',
        sourceMessageId: sourceMessage?.id || '',
      });
      return;
    }
    if (action.code === 'VIEW_PROVIDERS') {
      appendSmartProviderMessage(sourceMessage);
      return;
    }
    if (action.code === 'UNLOCK_PROVIDER_CONTACT') {
      const service = findSmartActionTargetService(sourcePayload, action);
      if (service?.id) void handlePrepareProviderUnlock(sourceMessage.id, service);
      return;
    }
    if (action.code === 'DRAFT_PROVIDER_MESSAGE') {
      const service = findSmartActionTargetService(sourcePayload, action);
      const propertyIdForDraft = action.target?.propertyId || sourcePayload?.data?.property?.id || sourcePayload?.data?.sourceData?.property?.id || '';
      if (service?.id && propertyIdForDraft) void handlePrepareProviderMessageDraft(sourceMessage.id, service, propertyIdForDraft);
      return;
    }
    if (action.code === 'REVIEW_PROVIDER_REPLY') {
      void handleAnalyzeProviderConversation(sourceMessage);
    }
  };

  const submit = async () => {
    if (!canSend) return;
    await submitMessage(trimmedInput);
  };

  useEffect(() => {
    const request = propertyAnalysisRequestRef.current;
    const requestId = String(request?.id || '').trim();
    const prompt = String(request?.prompt || '').trim();
    if (!requestId || !prompt || handledAnalysisRequestsRef.current.has(requestId)) return;
    handledAnalysisRequestsRef.current.add(requestId);
    setOpen(true);
    setInput('');
    void submitMessageRef.current?.(prompt, {
      analysisExport: {
        requestId,
        title: request?.title || '',
        onExportPdf: request?.onExportPdf || null,
      },
    });
  }, [propertyAnalysisRequest?.id]);

  if (!enabled) return null;

  return (
    <div className={`maxxis-shell ${open ? 'maxxis-shell-open' : ''}`}>
      {open ? (
        <section className="maxxis-panel" data-testid="maxxis-panel" role="dialog" aria-modal="true" aria-label={t.title}>
          <header className="maxxis-header">
            <div className="maxxis-avatar" aria-hidden="true">
              <MaxxisAvatarRenderer
                avatarState={maxxisAvatarRenderState}
                testId="maxxis-avatar-header"
              />
            </div>
            <div className="maxxis-heading">
              <strong>{t.title}</strong>
              <span><i />{t.status}</span>
            </div>
            <div className="maxxis-actions">
              <button type="button" onClick={resetConversation} title={t.reset} aria-label={t.reset}>
                <Icon name="rotateCcw" size={15} color="currentColor" strokeWidth={2} />
              </button>
              <button type="button" onClick={() => setOpen(false)} title={t.close} aria-label={t.close}>
                <Icon name="close" size={15} color="currentColor" strokeWidth={2} />
              </button>
            </div>
          </header>

          <div className="maxxis-scope">{t.scope}</div>

          <div className="maxxis-messages" data-testid="maxxis-messages">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                language={language}
                onAction={handleAction}
                onConfirmProfileSuggestion={handleConfirmProfileSuggestion}
                onCancelProfileSuggestion={handleCancelProfileSuggestion}
                activeProfileActionId={activeProfileActionId}
                activeProviderUnlockId={activeProviderUnlockId}
                activeProviderDraftId={activeProviderDraftId}
                activeProviderMessageSendId={activeProviderMessageSendId}
                activeProviderConversationAnalysisId={activeProviderConversationAnalysisId}
                activeWorkflowItemCode={activeWorkflowItemCode}
                pendingProviderUnlock={pendingProviderUnlock}
                pendingProviderMessageSend={pendingProviderMessageSend}
                onPrepareProviderUnlock={handlePrepareProviderUnlock}
                onConfirmProviderUnlock={handleConfirmProviderUnlock}
                onCancelProviderUnlock={handleCancelProviderUnlock}
                onPrepareProviderMessageDraft={handlePrepareProviderMessageDraft}
                onPrepareProviderMessageSend={handlePrepareProviderMessageSend}
                onConfirmProviderMessageSend={handleConfirmProviderMessageSend}
                onCancelProviderMessageSend={handleCancelProviderMessageSend}
                onAnalyzeProviderConversation={handleAnalyzeProviderConversation}
                onUpdateProviderMessageDraft={handleUpdateProviderMessageDraft}
                onUpdateProviderConversationSuggestedReply={handleUpdateProviderConversationSuggestedReply}
                onToggleWorkflowManualItem={handleToggleWorkflowManualItem}
                onDealFollowUp={handleDealFollowUp}
                smartActions={getMessageSmartActions(message)}
                onSmartAction={handleSmartAction}
                onExportAnalysisPdf={handleExportAnalysisPdf}
                exportAnalysisLabel={t.exportAnalysisPdf}
                exportingAnalysisLabel={t.exportingAnalysisPdf}
                isExportingAnalysis={exportingAnalysisId === message.id}
              />
            ))}
            {loading ? (
              <div className="maxxis-message maxxis-message-assistant">
                <div className="maxxis-typing" aria-label={t.typing}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form
            className="maxxis-input-row"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <textarea
              ref={inputRef}
              data-testid="maxxis-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={t.placeholder}
              rows={2}
              disabled={loading}
              maxLength={1800}
            />
            <div className="maxxis-input-actions">
              <button data-testid="maxxis-send" className="maxxis-send-button" type="submit" disabled={!canSend} aria-label={t.send} title={t.send}>
                <Icon name="send" size={16} color="#fff" strokeWidth={2} />
                <span>{t.send}</span>
              </button>
              <button
                className="maxxis-support-button"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenSupport?.();
                }}
              >
                {t.support}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {!open ? (
        <>
          {proactiveBubble ? (
            <div
              className="maxxis-proactive-bubble"
              data-testid="maxxis-proactive-bubble"
              role="status"
              aria-live="polite"
              style={widgetPosition ? {
                left: `${Math.max(12, widgetPosition.x - 260)}px`,
                top: `${Math.max(12, widgetPosition.y - 82)}px`,
                right: 'auto',
                bottom: 'auto',
              } : {}}
            >
              <span>{proactiveBubble.message?.text}</span>
              <button
                type="button"
                className="maxxis-proactive-review"
                data-testid="maxxis-proactive-review"
                onClick={handleClickProactiveBubble}
              >
                {proactiveBubble.message?.ctaLabel}
              </button>
              <button
                type="button"
                className="maxxis-proactive-dismiss"
                data-testid="maxxis-proactive-dismiss"
                aria-label={language === 'pt' ? 'Fechar sugestao do Maxxis' : language === 'es' ? 'Cerrar sugerencia de Maxxis' : 'Dismiss Maxxis suggestion'}
                onClick={handleDismissProactiveBubble}
              >
                ×
              </button>
            </div>
          ) : null}
          <button
            type="button"
            data-guide="maxxis-widget"
            data-testid="maxxis-fab"
            className={`maxxis-fab ${dragging ? 'maxxis-fab-dragging' : ''}`}
            onPointerDown={handleFabPointerDown}
            onClick={(event) => {
              if (dragRef.current.moved) {
                event.preventDefault();
                dragRef.current = { ...dragRef.current, moved: false };
                return;
              }
              void trackProductEvent('maxxis_opened', { dedupeKey: `maxxis-opened:${page}`, properties: { source: page } });
              setOpen(true);
            }}
            aria-label={t.open}
            title={t.open}
            style={{
              '--maxxis-accent': C.accent,
              ...(widgetPosition ? {
                left: `${widgetPosition.x}px`,
                top: `${widgetPosition.y}px`,
                right: 'auto',
                bottom: 'auto',
              } : {}),
            }}
          >
            <MaxxisAvatarRenderer
              avatarState={maxxisAvatarRenderState}
              className="maxxis-fab-logo"
              testId="maxxis-avatar-fab"
            />
            <span>AI</span>
          </button>
        </>
      ) : null}
    </div>
  );
}

export default MaxxisAssistant;
