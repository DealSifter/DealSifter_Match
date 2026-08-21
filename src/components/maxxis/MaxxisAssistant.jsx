import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import maxxisLogo from '../../assets/logo.png';
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

export function MaxxisAssistant({ page = 'dashboard', onOpenSupport = null, onNavigateAction = null, propertyAnalysisRequest = null, propertyContextId = '', onExportAnalysisPdf = null, onNuggetBalanceChange = null, onProviderUnlockConfirmed = null, enabled = true }) {
  const language = getUiLang();
  const t = COPY[language] || COPY.en;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportingAnalysisId, setExportingAnalysisId] = useState(null);
  const [activeProfileActionId, setActiveProfileActionId] = useState('');
  const [activeProviderUnlockId, setActiveProviderUnlockId] = useState('');
  const [activeProviderDraftId, setActiveProviderDraftId] = useState('');
  const [activeProviderMessageSendId, setActiveProviderMessageSendId] = useState('');
  const [activeProviderConversationAnalysisId, setActiveProviderConversationAnalysisId] = useState('');
  const [activeWorkflowItemCode, setActiveWorkflowItemCode] = useState('');
  const [pendingProviderUnlock, setPendingProviderUnlock] = useState(null);
  const [pendingProviderMessageSend, setPendingProviderMessageSend] = useState(null);
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
  const propertyAnalysisRequestRef = useRef(propertyAnalysisRequest);
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

  useEffect(() => {
    propertyAnalysisRequestRef.current = propertyAnalysisRequest;
  }, [propertyAnalysisRequest]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, open]);

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

  const resetConversation = () => {
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
  };

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
      const result = await sendMaxxisMessage({
        message: cleanMessage,
        history: historyForRequest,
        page,
        language,
        propertyId: propertyContextId,
        propertyIds: comparisonPropertyIds,
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
      setMessages((prev) => [...prev, {
        id: `maxxis-assistant-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        createdAt: new Date(),
        error: Boolean(result.unavailable),
        type: result.type,
        data: result.data,
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
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_unlock_prepare', serviceId });
      if (error?.contactAccess) updateProviderContactAccess(messageId, serviceId, error.contactAccess);
    } finally {
      setActiveProviderUnlockId('');
    }
  };

  const handleConfirmProviderUnlock = async (pending) => {
    const serviceId = String(pending?.serviceId || '');
    const intentToken = String(pending?.intentToken || '');
    if (!serviceId || !intentToken || activeProviderUnlockId) return;
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
      void trackProductEvent('provider_unlocked', { entityType: 'service', entityId: serviceId, dedupeKey: `provider-unlocked:${intentToken}`, properties: { source: 'maxxis', status: result?.contactAccess?.status || 'unlocked' } });
      setPendingProviderUnlock(null);
    } catch (error) {
      captureAppException(error, { area: 'maxxis_provider_unlock_confirm', serviceId });
      if (error?.contactAccess) updateProviderContactAccess(pending.messageId, serviceId, error.contactAccess);
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
    setActiveProviderDraftId(serviceId);
    try {
      const result = await prepareMaxxisProviderMessageDraft({ serviceId, propertyId: cleanPropertyId, language });
      if (result?.data?.draft) {
        void trackProductEvent('provider_message_drafted', { entityType: 'service', entityId: serviceId, dedupeKey: `provider-message-drafted:${serviceId}:${cleanPropertyId}`, properties: { source: 'maxxis' } });
        setMessages((prev) => [...prev, {
          id: `maxxis-provider-message-draft-${Date.now()}`,
          role: 'assistant',
          content: result.message || 'Provider message draft prepared.',
          createdAt: new Date(),
          type: 'provider_message_draft',
          data: result.data,
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
      void trackProductEvent('provider_message_sent', { entityType: 'service', entityId: pending?.serviceId, dedupeKey: `provider-message-sent:${result?.data?.messageId || actionId}`, properties: { source: 'maxxis', status: result?.data?.status || 'sent' } });
      const sendCopy = PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en;
      setMessages((prev) => [...prev, {
        id: `maxxis-provider-message-sent-${Date.now()}`,
        role: 'assistant',
        content: pending?.sourceType === 'provider_conversation_analysis' ? sendCopy.replySent : sendCopy.messageSent,
        createdAt: new Date(),
        type: 'provider_message_sent',
        data: result?.data || { serviceId: pending.serviceId, propertyId: pending.propertyId, status: 'sent' },
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
              <img src={maxxisLogo} alt="" draggable="false" />
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
          <img className="maxxis-fab-logo" src={maxxisLogo} alt="" aria-hidden="true" draggable="false" />
          <span>AI</span>
        </button>
      ) : null}
    </div>
  );
}

export default MaxxisAssistant;
