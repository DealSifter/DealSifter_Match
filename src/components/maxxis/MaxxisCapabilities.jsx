/* eslint-disable react-refresh/only-export-components -- capability registry intentionally co-locates renderers and their pure discriminators */
import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { getLang } from '../../i18n/translations';
import { C } from '../../theme/colors';
import { MAXXIS_WIDGET_POSITION_KEY } from '../../lib/localStoragePolicy';
import { trackProductEvent } from '../../lib/productAnalytics';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COPY = {
  en: {
    title: 'Maxxis Assistant',
    status: 'DealSifter guide',
    placeholder: 'Ask about DealSifter, Tax Deeds or Wholesale...',
    send: 'Send',
    reset: 'New conversation',
    close: 'Close',
    open: 'Open Maxxis Assistant',
    support: 'Human support',
    typing: 'Maxxis is thinking...',
    unavailable: 'I had a temporary issue. Please try again or contact human support.',
    providerConversationContextMissing: 'Open a provider message flow first, then I can analyze that provider conversation safely.',
    exportAnalysisPdf: 'Export analysis PDF',
    exportingAnalysisPdf: 'Exporting...',
    profileSuggestionTitle: 'Possible Investment Profile update',
    reviewProfile: 'Review Profile',
    notNow: 'Not now',
    profileUpdated: 'was added to your Investment Profile.',
    profileActionFailed: 'I could not apply this update safely. Please request a new personalized search.',
    propertyDetailsTitle: 'Property Details',
    priceNotProvided: 'Price not provided',
    missingDetails: 'Missing details',
    dealMetricsTitle: 'Deal Metrics',
    pricePerSqftMetric: 'Price / sqft',
    acquisitionPlusRehabMetric: 'Acquisition + rehab',
    capRateMetric: 'Reported cap rate',
    calculatedSource: 'Calculated',
    storedSource: 'Reported (stored)',
    metricMissing: 'Unavailable because this information is missing',
    metricInvalid: 'Unavailable because this information is invalid',
    metricZeroSqft: 'Unavailable because the square footage is zero',
    metricUnsafe: 'Unavailable because a safe value could not be produced',
    metricInputs: { price: 'price', sqft: 'square footage', rehab: 'rehab', capRate: 'cap rate' },
    propertyComparisonTitle: 'Property Comparison',
    comparisonProperty: 'Property',
    comparisonLocation: 'Location',
    comparisonType: 'Type',
    comparisonBedsBaths: 'Beds / baths',
    comparisonSqft: 'Sqft',
    comparisonPrice: 'Price',
    comparisonRehab: 'Rehab',
    comparisonObjective: 'Objective',
    comparisonUnavailable: 'Unavailable',
    comparisonLowestPrice: 'Lowest price',
    comparisonLowestPricePerSqft: 'Lowest price / sqft',
    comparisonLowestAcquisition: 'Lowest acquisition + rehab',
    comparisonHighestCapRate: 'Highest reported cap rate',
    comparisonLargestSqft: 'Largest sqft',
    scope: 'Maxxis can help with app usage, Tax Deeds, Wholesale and DealSifter workflows.',
  },
  pt: {
    title: 'Assistente Maxxis',
    status: 'Guia do DealSifter',
    placeholder: 'Pergunte sobre DealSifter, Tax Deeds ou Wholesale...',
    send: 'Enviar',
    reset: 'Nova conversa',
    close: 'Fechar',
    open: 'Abrir Assistente Maxxis',
    support: 'Suporte humano',
    typing: 'Maxxis esta pensando...',
    unavailable: 'Tive uma dificuldade temporaria. Tente novamente ou fale com o suporte humano.',
    providerConversationContextMissing: 'Abra primeiro um fluxo de mensagem com provider, entao eu consigo analisar essa conversa com seguranca.',
    exportAnalysisPdf: 'Exportar PDF da analise',
    exportingAnalysisPdf: 'Exportando...',
    profileSuggestionTitle: 'Possivel atualizacao do Investment Profile',
    reviewProfile: 'Revisar perfil',
    notNow: 'Agora nao',
    profileUpdated: 'foi adicionado ao seu Investment Profile.',
    profileActionFailed: 'Nao foi possivel aplicar esta atualizacao com seguranca. Solicite uma nova busca personalizada.',
    propertyDetailsTitle: 'Detalhes da propriedade',
    priceNotProvided: 'Preco nao informado',
    missingDetails: 'Dados ausentes',
    dealMetricsTitle: 'Metricas do deal',
    pricePerSqftMetric: 'Preco / sqft',
    acquisitionPlusRehabMetric: 'Aquisicao + rehab',
    capRateMetric: 'Cap rate informado',
    calculatedSource: 'Calculado',
    storedSource: 'Informado (armazenado)',
    metricMissing: 'Indisponivel porque esta informacao nao foi cadastrada',
    metricInvalid: 'Indisponivel porque esta informacao e invalida',
    metricZeroSqft: 'Indisponivel porque a metragem e zero',
    metricUnsafe: 'Indisponivel porque nao foi possivel produzir um valor seguro',
    metricInputs: { price: 'preco', sqft: 'metragem', rehab: 'rehab', capRate: 'cap rate' },
    propertyComparisonTitle: 'Comparacao de propriedades',
    comparisonProperty: 'Propriedade',
    comparisonLocation: 'Localizacao',
    comparisonType: 'Tipo',
    comparisonBedsBaths: 'Quartos / banheiros',
    comparisonSqft: 'Metragem',
    comparisonPrice: 'Preco',
    comparisonRehab: 'Rehab',
    comparisonObjective: 'Objetivo',
    comparisonUnavailable: 'Indisponivel',
    comparisonLowestPrice: 'Menor preco',
    comparisonLowestPricePerSqft: 'Menor preco / sqft',
    comparisonLowestAcquisition: 'Menor aquisicao + rehab',
    comparisonHighestCapRate: 'Maior cap rate informado',
    comparisonLargestSqft: 'Maior metragem',
    scope: 'Maxxis ajuda com uso do app, Tax Deeds, Wholesale e fluxos do DealSifter.',
  },
  es: {
    title: 'Asistente Maxxis',
    status: 'Guia de DealSifter',
    placeholder: 'Pregunta sobre DealSifter, Tax Deeds o Wholesale...',
    send: 'Enviar',
    reset: 'Nueva conversacion',
    close: 'Cerrar',
    open: 'Abrir Asistente Maxxis',
    support: 'Soporte humano',
    typing: 'Maxxis esta pensando...',
    unavailable: 'Tuve un problema temporal. Intentalo otra vez o contacta soporte humano.',
    providerConversationContextMissing: 'Abre primero un flujo de mensaje con provider, y entonces puedo analizar esa conversacion de forma segura.',
    exportAnalysisPdf: 'Exportar PDF del analisis',
    exportingAnalysisPdf: 'Exportando...',
    profileSuggestionTitle: 'Posible actualizacion del Investment Profile',
    reviewProfile: 'Revisar perfil',
    notNow: 'Ahora no',
    profileUpdated: 'fue agregado a tu Investment Profile.',
    profileActionFailed: 'No fue posible aplicar esta actualizacion de forma segura. Solicita una nueva busqueda personalizada.',
    propertyDetailsTitle: 'Detalles de la propiedad',
    priceNotProvided: 'Precio no informado',
    missingDetails: 'Datos faltantes',
    dealMetricsTitle: 'Metricas del deal',
    pricePerSqftMetric: 'Precio / sqft',
    acquisitionPlusRehabMetric: 'Adquisicion + rehab',
    capRateMetric: 'Cap rate informado',
    calculatedSource: 'Calculado',
    storedSource: 'Informado (almacenado)',
    metricMissing: 'No disponible porque esta informacion no fue registrada',
    metricInvalid: 'No disponible porque esta informacion no es valida',
    metricZeroSqft: 'No disponible porque el metraje es cero',
    metricUnsafe: 'No disponible porque no fue posible producir un valor seguro',
    metricInputs: { price: 'precio', sqft: 'metraje', rehab: 'rehab', capRate: 'cap rate' },
    propertyComparisonTitle: 'Comparacion de propiedades',
    comparisonProperty: 'Propiedad',
    comparisonLocation: 'Ubicacion',
    comparisonType: 'Tipo',
    comparisonBedsBaths: 'Habitaciones / banos',
    comparisonSqft: 'Metraje',
    comparisonPrice: 'Precio',
    comparisonRehab: 'Rehab',
    comparisonObjective: 'Objetivo',
    comparisonUnavailable: 'No disponible',
    comparisonLowestPrice: 'Menor precio',
    comparisonLowestPricePerSqft: 'Menor precio / sqft',
    comparisonLowestAcquisition: 'Menor adquisicion + rehab',
    comparisonHighestCapRate: 'Mayor cap rate informado',
    comparisonLargestSqft: 'Mayor metraje',
    scope: 'Maxxis ayuda con uso de la app, Tax Deeds, Wholesale y flujos de DealSifter.',
  },
};

const DEAL_ADVISOR_COPY = {
  en: {
    title: 'Deal Advisor',
    positiveTitle: 'Positive signals',
    attentionTitle: 'Attention points',
    missingTitle: 'Missing information',
    limitationsTitle: 'Limitations',
    empty: 'No factual items available.',
    positive: {
      property_published: 'The property is published and active.',
      basic_details_complete: 'The basic property fields are complete.',
      price_per_sqft_calculable: 'Price per sqft is calculable from the registered data.',
      acquisition_plus_rehab_calculable: 'Acquisition plus rehab is calculable from the registered data.',
      rehab_reported: 'A rehab amount is reported.',
      cap_rate_reported: 'A cap rate is reported.',
    },
    attention: {
      property_information_incomplete: 'Some registered property information is missing or invalid.',
      price_missing_or_invalid: 'Price is missing or invalid.',
      sqft_missing_or_invalid: 'Square footage is missing or invalid.',
      rehab_missing_or_invalid: 'Rehab is missing or invalid.',
      price_per_sqft_unavailable: 'Price per sqft is unavailable.',
      acquisition_plus_rehab_unavailable: 'Acquisition plus rehab is unavailable.',
      cap_rate_unavailable: 'Cap rate is unavailable.',
      cap_rate_reported_not_calculated: 'Cap rate is reported, not calculated by DealSifter.',
      description_missing: 'The property description is missing.',
    },
    missing: { type: 'Property type', city: 'City', state: 'State', zip: 'ZIP code', price: 'Price', sqft: 'Square footage', objective: 'Objective', rehab: 'Rehab', capRate: 'Cap rate', description: 'Description', images: 'Images' },
    limitations: {
      analysis_depends_on_submitted_data: 'The analysis depends on submitted property data.',
      property_data_not_independently_verified: 'Property data has not been independently verified.',
      arv_not_structured: 'ARV is not available as a structured field in this analysis.',
      roi_not_calculated: 'ROI is not calculated in this analysis.',
      cap_rate_not_independently_verified: 'The reported cap rate has not been independently verified.',
    },
  },
  pt: {
    title: 'Deal Advisor',
    positiveTitle: 'Sinais positivos',
    attentionTitle: 'Pontos de atencao',
    missingTitle: 'Informacoes ausentes',
    limitationsTitle: 'Limitacoes',
    empty: 'Nenhum item factual disponivel.',
    positive: {
      property_published: 'A propriedade esta publicada e ativa.',
      basic_details_complete: 'Os campos basicos da propriedade estao completos.',
      price_per_sqft_calculable: 'O preco por sqft pode ser calculado com os dados cadastrados.',
      acquisition_plus_rehab_calculable: 'Aquisicao mais rehab pode ser calculada com os dados cadastrados.',
      rehab_reported: 'Um valor de rehab foi informado.',
      cap_rate_reported: 'Um cap rate foi informado.',
    },
    attention: {
      property_information_incomplete: 'Algumas informacoes cadastradas da propriedade estao ausentes ou invalidas.',
      price_missing_or_invalid: 'O preco esta ausente ou invalido.',
      sqft_missing_or_invalid: 'A metragem esta ausente ou invalida.',
      rehab_missing_or_invalid: 'O rehab esta ausente ou invalido.',
      price_per_sqft_unavailable: 'O preco por sqft esta indisponivel.',
      acquisition_plus_rehab_unavailable: 'Aquisicao mais rehab esta indisponivel.',
      cap_rate_unavailable: 'O cap rate esta indisponivel.',
      cap_rate_reported_not_calculated: 'O cap rate foi informado, nao calculado pelo DealSifter.',
      description_missing: 'A descricao da propriedade esta ausente.',
    },
    missing: { type: 'Tipo da propriedade', city: 'Cidade', state: 'Estado', zip: 'CEP', price: 'Preco', sqft: 'Metragem', objective: 'Objetivo', rehab: 'Rehab', capRate: 'Cap rate', description: 'Descricao', images: 'Imagens' },
    limitations: {
      analysis_depends_on_submitted_data: 'A analise depende dos dados cadastrados da propriedade.',
      property_data_not_independently_verified: 'Os dados da propriedade nao foram verificados de forma independente.',
      arv_not_structured: 'ARV nao esta disponivel como campo estruturado nesta analise.',
      roi_not_calculated: 'ROI nao e calculado nesta analise.',
      cap_rate_not_independently_verified: 'O cap rate informado nao foi verificado de forma independente.',
    },
  },
  es: {
    title: 'Deal Advisor',
    positiveTitle: 'Senales positivas',
    attentionTitle: 'Puntos de atencion',
    missingTitle: 'Informacion faltante',
    limitationsTitle: 'Limitaciones',
    empty: 'No hay elementos factuales disponibles.',
    positive: {
      property_published: 'La propiedad esta publicada y activa.',
      basic_details_complete: 'Los campos basicos de la propiedad estan completos.',
      price_per_sqft_calculable: 'El precio por sqft se puede calcular con los datos registrados.',
      acquisition_plus_rehab_calculable: 'Adquisicion mas rehab se puede calcular con los datos registrados.',
      rehab_reported: 'Se informo un valor de rehab.',
      cap_rate_reported: 'Se informo un cap rate.',
    },
    attention: {
      property_information_incomplete: 'Algunos datos registrados de la propiedad faltan o no son validos.',
      price_missing_or_invalid: 'El precio falta o no es valido.',
      sqft_missing_or_invalid: 'El metraje falta o no es valido.',
      rehab_missing_or_invalid: 'El rehab falta o no es valido.',
      price_per_sqft_unavailable: 'El precio por sqft no esta disponible.',
      acquisition_plus_rehab_unavailable: 'Adquisicion mas rehab no esta disponible.',
      cap_rate_unavailable: 'El cap rate no esta disponible.',
      cap_rate_reported_not_calculated: 'El cap rate fue informado, no calculado por DealSifter.',
      description_missing: 'Falta la descripcion de la propiedad.',
    },
    missing: { type: 'Tipo de propiedad', city: 'Ciudad', state: 'Estado', zip: 'Codigo postal', price: 'Precio', sqft: 'Metraje', objective: 'Objetivo', rehab: 'Rehab', capRate: 'Cap rate', description: 'Descripcion', images: 'Imagenes' },
    limitations: {
      analysis_depends_on_submitted_data: 'El analisis depende de los datos registrados de la propiedad.',
      property_data_not_independently_verified: 'Los datos de la propiedad no fueron verificados de forma independiente.',
      arv_not_structured: 'ARV no esta disponible como campo estructurado en este analisis.',
      roi_not_calculated: 'ROI no se calcula en este analisis.',
      cap_rate_not_independently_verified: 'El cap rate informado no fue verificado de forma independiente.',
    },
  },
};

export const PROPERTY_SERVICE_NEEDS_COPY = {
  en: {
    title: 'Suggested services',
    reason: 'Reason',
    confidence: 'Confidence',
    availableProviders: 'Available providers',
    noProviders: 'No providers currently available.',
    fit: 'Fit',
    fitUnavailable: 'Fit unavailable',
    unlockContact: 'Unlock Contact',
    viewContact: 'View Contact',
    contactLocked: 'Contact locked',
    contactUnlocked: 'Contact unlocked',
    insufficientBalance: 'Insufficient Nuggets',
    contactUnavailable: 'Contact unavailable',
    unlockProviderContact: 'Unlock Provider Contact',
    cost: 'Cost',
    cancel: 'Cancel',
    unlocking: 'Unlocking...',
    preparing: 'Preparing...',
    cancelling: 'Cancelling...',
    draftMessage: 'Draft Message',
    drafting: 'Drafting...',
    messageDraftTitle: 'Message Draft',
    copyDraft: 'Copy',
    draftCopied: 'Copied',
    editDraftHint: 'Editable draft. Nothing has been sent.',
    draftUnavailable: 'Unlock this provider contact and open a property context before drafting a message.',
    sendMessage: 'Send Message',
    sendReply: 'Send Reply',
    sendingMessage: 'Sending...',
    confirmSendQuestion: 'Send this message?',
    confirmSendPrefix: 'Send this message to',
    confirmReplyQuestion: 'Send this reply?',
    confirmReplyPrefix: 'Send this reply to',
    confirmSend: 'Send',
    messageSent: 'Message sent.',
    replySent: 'Reply sent.',
    messageSendFailed: 'Message could not be sent.',
    analyzeConversation: 'Analyze Conversation',
    analyzingConversation: 'Analyzing...',
    conversationSummaryTitle: 'Conversation Summary',
    factsTitle: 'Facts',
    openItemsTitle: 'Open items',
    providerAskedTitle: 'Provider asked',
    amountsTitle: 'Quoted amounts',
    availabilityTitle: 'Availability',
    suggestedReplyTitle: 'Suggested Reply',
    noItems: 'No items found.',
    analysisUnavailable: 'I could not analyze this conversation safely.',
    email: 'Email',
    phone: 'Phone',
    whatsapp: 'WhatsApp',
    confidenceValues: { high: 'High', medium: 'Medium' },
    serviceTypes: {
      'General Contractor': 'General Contractor',
      'Rehab Staff': 'Rehab Staff',
      Photography: 'Photography',
      Inspections: 'Inspections',
      Survey: 'Survey',
    },
    reasons: {
      rehab_reported: 'A rehab amount is reported, so this service type may be relevant.',
      new_construction_objective: 'The registered objective is new construction, so this service type may be relevant.',
      listing_images_missing: 'The property listing has no registered images.',
      sale_listing_images_missing: 'The registered objective is sale and the listing has no images.',
      physical_details_incomplete: 'Registered physical property information is incomplete.',
      land_development_context: 'The registered property type and objective indicate a land development context.',
    },
  },
  pt: {
    title: 'Servicos sugeridos',
    reason: 'Motivo',
    confidence: 'Confianca',
    availableProviders: 'Prestadores disponiveis',
    noProviders: 'Nenhum prestador disponivel no momento.',
    fit: 'Fit',
    fitUnavailable: 'Fit indisponivel',
    unlockContact: 'Unlock Contact',
    viewContact: 'Ver contato',
    contactLocked: 'Contato bloqueado',
    contactUnlocked: 'Contato desbloqueado',
    insufficientBalance: 'Nuggets insuficientes',
    contactUnavailable: 'Contato indisponivel',
    unlockProviderContact: 'Unlock Provider Contact',
    cost: 'Custo',
    cancel: 'Cancelar',
    unlocking: 'Desbloqueando...',
    preparing: 'Preparando...',
    cancelling: 'Cancelando...',
    draftMessage: 'Draft Message',
    drafting: 'Gerando...',
    messageDraftTitle: 'Rascunho da mensagem',
    copyDraft: 'Copiar',
    draftCopied: 'Copiado',
    editDraftHint: 'Rascunho editavel. Nada foi enviado.',
    draftUnavailable: 'Desbloqueie este contato e abra um contexto de propriedade antes de gerar a mensagem.',
    sendMessage: 'Send Message',
    sendReply: 'Send Reply',
    sendingMessage: 'Enviando...',
    confirmSendQuestion: 'Enviar esta mensagem?',
    confirmSendPrefix: 'Enviar esta mensagem para',
    confirmReplyQuestion: 'Enviar esta resposta?',
    confirmReplyPrefix: 'Enviar esta resposta para',
    confirmSend: 'Enviar',
    messageSent: 'Mensagem enviada.',
    replySent: 'Resposta enviada.',
    messageSendFailed: 'Nao foi possivel enviar a mensagem.',
    analyzeConversation: 'Analisar conversa',
    analyzingConversation: 'Analisando...',
    conversationSummaryTitle: 'Resumo da conversa',
    factsTitle: 'Fatos',
    openItemsTitle: 'Pendencias',
    providerAskedTitle: 'Provider pediu',
    amountsTitle: 'Valores citados',
    availabilityTitle: 'Disponibilidade',
    suggestedReplyTitle: 'Resposta sugerida',
    noItems: 'Nenhum item encontrado.',
    analysisUnavailable: 'Nao consegui analisar esta conversa com seguranca.',
    email: 'Email',
    phone: 'Telefone',
    whatsapp: 'WhatsApp',
    confidenceValues: { high: 'Alta', medium: 'Media' },
    serviceTypes: {
      'General Contractor': 'Empreiteiro geral',
      'Rehab Staff': 'Equipe de reforma',
      Photography: 'Fotografia',
      Inspections: 'Inspecoes',
      Survey: 'Levantamento do terreno',
    },
    reasons: {
      rehab_reported: 'Ha um valor de rehab informado, portanto este tipo de servico pode ser relevante.',
      new_construction_objective: 'O objetivo cadastrado e nova construcao, portanto este tipo de servico pode ser relevante.',
      listing_images_missing: 'O cadastro da propriedade nao possui imagens.',
      sale_listing_images_missing: 'O objetivo cadastrado e venda e o anuncio nao possui imagens.',
      physical_details_incomplete: 'Informacoes fisicas cadastradas da propriedade estao incompletas.',
      land_development_context: 'O tipo e o objetivo cadastrados indicam um contexto de desenvolvimento de terreno.',
    },
  },
  es: {
    title: 'Servicios sugeridos',
    reason: 'Motivo',
    confidence: 'Confianza',
    availableProviders: 'Proveedores disponibles',
    noProviders: 'No hay proveedores disponibles actualmente.',
    fit: 'Fit',
    fitUnavailable: 'Fit no disponible',
    unlockContact: 'Unlock Contact',
    viewContact: 'Ver contacto',
    contactLocked: 'Contacto bloqueado',
    contactUnlocked: 'Contacto desbloqueado',
    insufficientBalance: 'Nuggets insuficientes',
    contactUnavailable: 'Contacto no disponible',
    unlockProviderContact: 'Unlock Provider Contact',
    cost: 'Costo',
    cancel: 'Cancelar',
    unlocking: 'Desbloqueando...',
    preparing: 'Preparando...',
    cancelling: 'Cancelando...',
    draftMessage: 'Draft Message',
    drafting: 'Generando...',
    messageDraftTitle: 'Borrador del mensaje',
    copyDraft: 'Copiar',
    draftCopied: 'Copiado',
    editDraftHint: 'Borrador editable. Nada fue enviado.',
    draftUnavailable: 'Desbloquea este contacto y abre un contexto de propiedad antes de generar el mensaje.',
    sendMessage: 'Send Message',
    sendReply: 'Send Reply',
    sendingMessage: 'Enviando...',
    confirmSendQuestion: 'Enviar este mensaje?',
    confirmSendPrefix: 'Enviar este mensaje a',
    confirmReplyQuestion: 'Enviar esta respuesta?',
    confirmReplyPrefix: 'Enviar esta respuesta a',
    confirmSend: 'Enviar',
    messageSent: 'Mensaje enviado.',
    replySent: 'Respuesta enviada.',
    messageSendFailed: 'No fue posible enviar el mensaje.',
    analyzeConversation: 'Analizar conversacion',
    analyzingConversation: 'Analizando...',
    conversationSummaryTitle: 'Resumen de conversacion',
    factsTitle: 'Hechos',
    openItemsTitle: 'Pendientes',
    providerAskedTitle: 'El provider pidio',
    amountsTitle: 'Valores citados',
    availabilityTitle: 'Disponibilidad',
    suggestedReplyTitle: 'Respuesta sugerida',
    noItems: 'No se encontraron elementos.',
    analysisUnavailable: 'No pude analizar esta conversacion de forma segura.',
    email: 'Email',
    phone: 'Telefono',
    whatsapp: 'WhatsApp',
    confidenceValues: { high: 'Alta', medium: 'Media' },
    serviceTypes: {
      'General Contractor': 'Contratista general',
      'Rehab Staff': 'Equipo de rehabilitacion',
      Photography: 'Fotografia',
      Inspections: 'Inspecciones',
      Survey: 'Levantamiento del terreno',
    },
    reasons: {
      rehab_reported: 'Hay un valor de rehabilitacion informado, por lo que este tipo de servicio puede ser relevante.',
      new_construction_objective: 'El objetivo registrado es nueva construccion, por lo que este tipo de servicio puede ser relevante.',
      listing_images_missing: 'El registro de la propiedad no tiene imagenes.',
      sale_listing_images_missing: 'El objetivo registrado es venta y el anuncio no tiene imagenes.',
      physical_details_incomplete: 'La informacion fisica registrada de la propiedad esta incompleta.',
      land_development_context: 'El tipo y el objetivo registrados indican un contexto de desarrollo de terreno.',
    },
  },
};

const NEXT_BEST_ACTION_COPY = {
  en: {
    title: 'Next Best Action',
    reason: 'Reason',
    priority: 'Priority',
    review: 'Review',
    priorities: { high: 'High', medium: 'Medium', low: 'Low' },
    actions: {
      review_missing_property_data: 'Review missing property data',
      search_service_provider: 'Search for a service provider',
      review_service_matches: 'Review service matches',
      unlock_provider_contact: 'Review provider contact unlock',
      draft_provider_message: 'Review a provider message draft',
      review_provider_reply: 'Review the provider reply',
      send_reviewed_reply: 'Review the suggested reply before sending',
      review_deal_progress: 'Review Deal Progress',
      review_property_details: 'Review property details',
      action_pending: 'Review the pending action',
    },
  },
  pt: {
    title: 'Proxima melhor acao',
    reason: 'Motivo',
    priority: 'Prioridade',
    review: 'Revisar',
    priorities: { high: 'Alta', medium: 'Media', low: 'Baixa' },
    actions: {
      review_missing_property_data: 'Revisar dados ausentes do imovel',
      search_service_provider: 'Buscar um prestador de servico',
      review_service_matches: 'Revisar matches de servicos',
      unlock_provider_contact: 'Revisar desbloqueio do contato',
      draft_provider_message: 'Revisar rascunho para o prestador',
      review_provider_reply: 'Revisar resposta do prestador',
      send_reviewed_reply: 'Revisar a resposta sugerida antes do envio',
      review_deal_progress: 'Revisar progresso do deal',
      review_property_details: 'Revisar detalhes do imovel',
      action_pending: 'Revisar a acao pendente',
    },
  },
  es: {
    title: 'Siguiente mejor accion',
    reason: 'Motivo',
    priority: 'Prioridad',
    review: 'Revisar',
    priorities: { high: 'Alta', medium: 'Media', low: 'Baja' },
    actions: {
      review_missing_property_data: 'Revisar datos faltantes de la propiedad',
      search_service_provider: 'Buscar un proveedor de servicios',
      review_service_matches: 'Revisar matches de servicios',
      unlock_provider_contact: 'Revisar desbloqueo del contacto',
      draft_provider_message: 'Revisar borrador para el proveedor',
      review_provider_reply: 'Revisar respuesta del proveedor',
      send_reviewed_reply: 'Revisar la respuesta sugerida antes de enviarla',
      review_deal_progress: 'Revisar progreso del deal',
      review_property_details: 'Revisar detalles de la propiedad',
      action_pending: 'Revisar la accion pendiente',
    },
  },
};

const DEAL_WORKFLOW_COPY = {
  en: {
    title: 'Deal Progress',
    progress: (completed, total) => `${completed} of ${total} completed`,
    operationalOnly: 'Operational progress only — not deal quality or probability of success.',
    updating: 'Updating...',
    updateFailed: 'Deal Progress could not be updated.',
    items: {
      property_reviewed: 'Property reviewed',
      provider_found: 'Provider found',
      provider_unlocked: 'Provider unlocked',
      provider_contacted: 'Provider contacted',
      provider_replied: 'Provider replied',
      inspection_completed: 'Inspection completed',
      survey_completed: 'Survey completed',
      rehab_quote_received: 'Rehab quote received',
    },
  },
  pt: {
    title: 'Progresso do deal',
    progress: (completed, total) => `${completed} de ${total} concluidos`,
    operationalOnly: 'Progresso apenas operacional — nao representa qualidade do deal nem probabilidade de sucesso.',
    updating: 'Atualizando...',
    updateFailed: 'Nao foi possivel atualizar o progresso do deal.',
    items: {
      property_reviewed: 'Propriedade revisada',
      provider_found: 'Prestador encontrado',
      provider_unlocked: 'Prestador desbloqueado',
      provider_contacted: 'Prestador contatado',
      provider_replied: 'Prestador respondeu',
      inspection_completed: 'Inspecao concluida',
      survey_completed: 'Levantamento concluido',
      rehab_quote_received: 'Cotacao de rehab recebida',
    },
  },
  es: {
    title: 'Progreso del deal',
    progress: (completed, total) => `${completed} de ${total} completados`,
    operationalOnly: 'Progreso solamente operativo — no representa calidad ni probabilidad de exito.',
    updating: 'Actualizando...',
    updateFailed: 'No fue posible actualizar el progreso del deal.',
    items: {
      property_reviewed: 'Propiedad revisada',
      provider_found: 'Proveedor encontrado',
      provider_unlocked: 'Proveedor desbloqueado',
      provider_contacted: 'Proveedor contactado',
      provider_replied: 'Proveedor respondio',
      inspection_completed: 'Inspeccion completada',
      survey_completed: 'Levantamiento completado',
      rehab_quote_received: 'Cotizacion de rehab recibida',
    },
  },
};

const DEAL_COPILOT_COPY = {
  en: {
    title: 'Deal Copilot', viewDetails: 'View details', hideDetails: 'Hide details', attention: 'Attention', keyMetrics: 'Key Metrics', services: 'Services / Providers', conversation: 'Conversation', noAttention: 'No factual attention points available.', providers: 'Providers', needs: 'Suggested service types', unavailable: 'Some optional context is currently unavailable.',
  },
  pt: {
    title: 'Deal Copilot', viewDetails: 'Ver detalhes', hideDetails: 'Ocultar detalhes', attention: 'Atencao', keyMetrics: 'Metricas principais', services: 'Servicos / Prestadores', conversation: 'Conversa', noAttention: 'Nenhum ponto factual de atencao disponivel.', providers: 'Prestadores', needs: 'Tipos de servico sugeridos', unavailable: 'Parte do contexto opcional esta indisponivel no momento.',
  },
  es: {
    title: 'Deal Copilot', viewDetails: 'Ver detalles', hideDetails: 'Ocultar detalles', attention: 'Atencion', keyMetrics: 'Metricas principales', services: 'Servicios / Proveedores', conversation: 'Conversacion', noAttention: 'No hay puntos factuales de atencion disponibles.', providers: 'Proveedores', needs: 'Tipos de servicio sugeridos', unavailable: 'Parte del contexto opcional no esta disponible actualmente.',
  },
};

const ACTION_DEFINITIONS = {
  feed: {
    en: 'Open Feed',
    pt: 'Abrir Feed',
    es: 'Abrir Feed',
  },
  mapview: {
    en: 'Open MapView',
    pt: 'Abrir MapView',
    es: 'Abrir MapView',
  },
  matches: {
    en: 'Open Matches',
    pt: 'Abrir Matches',
    es: 'Abrir Matches',
  },
  pricing: {
    en: 'Open Pricing',
    pt: 'Abrir Pricing',
    es: 'Abrir Pricing',
  },
  onboarding: {
    en: 'Create or edit cards',
    pt: 'Criar ou editar cards',
    es: 'Crear o editar cards',
  },
  settings: {
    en: 'Open Settings',
    pt: 'Abrir Configuracoes',
    es: 'Abrir Configuracion',
  },
  profile: {
    en: 'Open Profile',
    pt: 'Abrir Perfil',
    es: 'Abrir Perfil',
  },
  notifications: {
    en: 'Open Notifications',
    pt: 'Abrir Notificacoes',
    es: 'Abrir Notificaciones',
  },
  support: {
    en: 'Open Support Chat',
    pt: 'Abrir Suporte',
    es: 'Abrir Soporte',
  },
  admin: {
    en: 'Open Admin System',
    pt: 'Abrir Adm.System',
    es: 'Abrir Adm.System',
  },
};

const ACTION_TOKEN_RE = /\[\[action:([a-z0-9_-]+)\|([^\]]{1,90})\]\]/gi;
const PROVIDER_CONVERSATION_INTENT_RE = /\b(resuma|resumir|resumo|respondeu|resposta dele|ficou pendente|pendente|prepare uma resposta|prepara uma resposta|ele aceitou|ela aceitou|aceitou|confirmou|contratou|what did|summarize|summary|provider replied|contractor replied|what is pending|open items|prepare a reply|draft a reply|did he accept|did she accept|did they accept|did the provider accept|did the contractor accept|confirmed|accepted|respuesta|respondio|respondió|pendiente|prepara una respuesta|acepto|aceptó|confirmo|confirmó)\b/i;

export function getUiLang() {
  const lang = String(getLang?.() || 'en').slice(0, 2).toLowerCase();
  return ['en', 'pt', 'es'].includes(lang) ? lang : 'en';
}

export function normalizeActionId(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (normalized === 'map' || normalized === 'map-view') return 'mapview';
  if (normalized === 'new-card' || normalized === 'cards' || normalized === 'onboard') return 'onboarding';
  if (normalized === 'preferences' || normalized === 'privacy' || normalized === 'payments') return 'settings';
  return ACTION_DEFINITIONS[normalized] ? normalized : null;
}

function getActionLabel(actionId, label, language) {
  const cleanLabel = String(label || '').replace(/\s+/g, ' ').trim();
  if (cleanLabel) return cleanLabel.slice(0, 90);
  return ACTION_DEFINITIONS[actionId]?.[language] || ACTION_DEFINITIONS[actionId]?.en || 'Open';
}

function parseActionContent(content, language) {
  const actions = [];
  const text = String(content || '').replace(ACTION_TOKEN_RE, (_match, rawAction, rawLabel) => {
    const actionId = normalizeActionId(rawAction);
    if (actionId) {
      actions.push({
        id: actionId,
        label: getActionLabel(actionId, rawLabel, language),
      });
    }
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();

  const dedupedActions = [];
  const seen = new Set();
  actions.forEach((action) => {
    if (!action?.id || seen.has(action.id)) return;
    seen.add(action.id);
    dedupedActions.push(action);
  });

  return { text, actions: dedupedActions.slice(0, 3) };
}

export function stripActionTokens(content) {
  return String(content || '').replace(ACTION_TOKEN_RE, '').replace(/\s+/g, ' ').trim();
}

export function isProviderConversationIntent(value) {
  return PROVIDER_CONVERSATION_INTENT_RE.test(String(value || ''));
}

export function findLatestProviderConversationContext(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] || {};
    const data = message.data || {};
    const serviceId = String(data.serviceId || '').trim();
    const propertyId = String(data.propertyId || '').trim();
    if (!UUID_PATTERN.test(serviceId)) continue;
    if (message.type !== 'provider_message_sent' && message.type !== 'provider_message_draft' && message.type !== 'provider_conversation_analysis') continue;
    return {
      serviceId,
      propertyId: UUID_PATTERN.test(propertyId) ? propertyId : '',
    };
  }
  return null;
}

function formatTime(date) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return '';
  }
}

function formatDealMetricValue(metric, kind) {
  if (!metric?.calculable || typeof metric.value !== 'number' || !Number.isFinite(metric.value)) return '';
  if (kind === 'percent') {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(metric.value)}%`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: kind === 'unitCurrency' ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(metric.value);
}

function getDealMetricUnavailableText(metric, language) {
  const copy = COPY[language] || COPY.en;
  if (metric?.reason === 'division_by_zero') return copy.metricZeroSqft;
  if (metric?.reason === 'unsafe_result') return copy.metricUnsafe;
  const inputNames = Array.isArray(metric?.missingInputs)
    ? metric.missingInputs.map((input) => copy.metricInputs[input]).filter(Boolean)
    : [];
  const reason = metric?.reason === 'invalid_input' ? copy.metricInvalid : copy.metricMissing;
  return inputNames.length ? `${reason}: ${inputNames.join(', ')}.` : `${reason}.`;
}

function DealMetricRow({ label, metric, kind, language }) {
  const copy = COPY[language] || COPY.en;
  const value = formatDealMetricValue(metric, kind);
  const source = metric?.source === 'calculated'
    ? copy.calculatedSource
    : metric?.source === 'stored'
      ? copy.storedSource
      : '';
  return (
    <div style={{ display: 'grid', gap: 2, paddingTop: 4 }}>
      <strong>{label}</strong>
      {value ? (
        <span style={{ whiteSpace: 'normal' }}>{`${value} · ${source}`}</span>
      ) : (
        <span style={{ whiteSpace: 'normal' }}>{getDealMetricUnavailableText(metric, language)}</span>
      )}
    </div>
  );
}

function comparisonLetter(index) {
  return String.fromCharCode(65 + index);
}

function formatStoredMoney(value, unavailable) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return unavailable;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function PropertyComparison({ data, language }) {
  const copy = COPY[language] || COPY.en;
  const properties = Array.isArray(data?.properties) ? data.properties.slice(0, 3) : [];
  if (properties.length < 2 || !data?.comparison) return null;
  const labelById = new Map(properties.map((item, index) => [String(item.id).toLowerCase(), comparisonLetter(index)]));
  const metricValue = (item, metricName, kind) => {
    const metric = item?.metrics?.metrics?.[metricName];
    return formatDealMetricValue(metric, kind) || copy.comparisonUnavailable;
  };
  const rows = [
    { label: copy.comparisonLocation, value: (item) => [item.property.city, item.property.state, item.property.zip].filter(Boolean).join(', ') || copy.comparisonUnavailable },
    { label: copy.comparisonType, value: (item) => item.property.type || copy.comparisonUnavailable },
    { label: copy.comparisonBedsBaths, value: (item) => [item.property.beds, item.property.baths].map((value) => value ?? '—').join(' / ') },
    { label: copy.comparisonSqft, value: (item) => item.property.sqft || copy.comparisonUnavailable },
    { label: copy.comparisonPrice, value: (item) => formatStoredMoney(item.property.price, copy.comparisonUnavailable) },
    { label: copy.comparisonRehab, value: (item) => formatStoredMoney(item.property.rehab, copy.comparisonUnavailable) },
    { label: copy.pricePerSqftMetric, value: (item) => metricValue(item, 'pricePerSqft', 'unitCurrency') },
    { label: copy.acquisitionPlusRehabMetric, value: (item) => metricValue(item, 'acquisitionPlusRehab', 'currency') },
    { label: copy.capRateMetric, value: (item) => metricValue(item, 'capRate', 'percent') },
    { label: copy.comparisonObjective, value: (item) => item.property.objective || copy.comparisonUnavailable },
  ];
  const facts = [
    { label: copy.comparisonLowestPrice, criterion: data.comparison.price, ids: data.comparison.price?.lowestPropertyIds },
    { label: copy.comparisonLowestPricePerSqft, criterion: data.comparison.pricePerSqft, ids: data.comparison.pricePerSqft?.lowestPropertyIds },
    { label: copy.comparisonLowestAcquisition, criterion: data.comparison.acquisitionPlusRehab, ids: data.comparison.acquisitionPlusRehab?.lowestPropertyIds },
    { label: copy.comparisonHighestCapRate, criterion: data.comparison.capRate, ids: data.comparison.capRate?.highestPropertyIds },
    { label: copy.comparisonLargestSqft, criterion: data.comparison.sqft, ids: data.comparison.sqft?.highestPropertyIds },
  ].filter((fact) => fact.criterion?.comparable && Array.isArray(fact.ids) && fact.ids.length);

  return (
    <div className="maxxis-action-links" aria-label={copy.propertyComparisonTitle}>
      <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 8, width: '100%', alignItems: 'stretch', justifyContent: 'stretch', borderRadius: 12, overflow: 'hidden' }}>
        <strong>{copy.propertyComparisonTitle}</strong>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: properties.length === 3 ? 390 : 310, borderCollapse: 'collapse', fontSize: 10, color: 'inherit' }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 5px', textAlign: 'left' }} />
                {properties.map((item, index) => (
                  <th key={item.id} style={{ padding: '4px 5px', textAlign: 'left' }}>{`${copy.comparisonProperty} ${comparisonLetter(index)}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} style={{ borderTop: '1px solid var(--border)' }}>
                  <th style={{ padding: '5px', textAlign: 'left', whiteSpace: 'normal' }}>{row.label}</th>
                  {properties.map((item) => (
                    <td key={item.id} style={{ padding: '5px', textAlign: 'left', whiteSpace: 'normal' }}>{row.value(item)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {facts.length ? (
          <div style={{ display: 'grid', gap: 3 }}>
            {facts.map((fact) => (
              <span key={fact.label} style={{ whiteSpace: 'normal' }}>
                {`${fact.label}: ${fact.ids.map((id) => labelById.get(String(id).toLowerCase())).filter(Boolean).join(', ')}`}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function dealAdvisorItems(analysis, language) {
  const copy = DEAL_ADVISOR_COPY[language] || DEAL_ADVISOR_COPY.en;
  return [
    { key: 'positive', marker: '✓', title: copy.positiveTitle, items: (analysis?.positiveSignals || []).map((code) => copy.positive[code]).filter(Boolean) },
    { key: 'attention', marker: '⚠', title: copy.attentionTitle, items: (analysis?.attentionPoints || []).map((code) => copy.attention[code]).filter(Boolean) },
    { key: 'missing', marker: '•', title: copy.missingTitle, items: (analysis?.missingInformation || []).map((field) => copy.missing[field]).filter(Boolean) },
    { key: 'limitations', marker: '•', title: copy.limitationsTitle, items: (analysis?.limitations || []).map((code) => copy.limitations[code]).filter(Boolean) },
  ];
}

function formatDealAdvisorExport(analysis, language) {
  const copy = DEAL_ADVISOR_COPY[language] || DEAL_ADVISOR_COPY.en;
  return dealAdvisorItems(analysis, language)
    .map((section) => `${section.title}\n${(section.items.length ? section.items : [copy.empty]).map((item) => `${section.marker} ${item}`).join('\n')}`)
    .join('\n\n');
}

function DealAdvisor({ analysis, language }) {
  if (!analysis) return null;
  const copy = DEAL_ADVISOR_COPY[language] || DEAL_ADVISOR_COPY.en;
  return (
    <div className="maxxis-action-links" aria-label={copy.title}>
      <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 8, width: '100%', alignItems: 'stretch', justifyContent: 'stretch', borderRadius: 12 }}>
        <strong>{copy.title}</strong>
        {dealAdvisorItems(analysis, language).map((section) => (
          <div key={section.key} style={{ display: 'grid', gap: 3 }}>
            <strong>{section.title}</strong>
            {(section.items.length ? section.items : [copy.empty]).map((item) => (
              <span key={item} style={{ whiteSpace: 'normal' }}>{`${section.marker} ${item}`}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function contactStatusLabel(contactAccess, copy) {
  const status = String(contactAccess?.status || 'unavailable');
  if (status === 'already_unlocked') return copy.contactUnlocked;
  if (status === 'locked') return contactAccess?.cost === null || contactAccess?.cost === undefined
    ? copy.contactLocked
    : `${copy.contactLocked}: ${contactAccess.cost} ${contactAccess.currency || 'nuggets'}`;
  if (status === 'insufficient_balance') return copy.insufficientBalance;
  return copy.contactUnavailable;
}

function UnlockedProviderContact({ contact, copy }) {
  if (!contact) return null;
  const rows = [
    contact.email ? `${copy.email}: ${contact.email}` : '',
    contact.phonePrimary ? `${copy.phone}: ${contact.phonePrimary}` : '',
    contact.whatsapp ? `${copy.whatsapp}: ${contact.whatsapp}` : '',
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div style={{ display: 'grid', gap: 2, paddingTop: 2 }}>
      {rows.map((row) => <span key={row} style={{ whiteSpace: 'normal' }}>{row}</span>)}
    </div>
  );
}

function DealProgressCard({ workflow, language, updatingCode, updateError, onToggleManualItem, readOnly = false }) {
  if (!Array.isArray(workflow?.items) || !workflow.items.length) return null;
  const copy = DEAL_WORKFLOW_COPY[language] || DEAL_WORKFLOW_COPY.en;
  return (
    <div className="maxxis-action-links" aria-label={copy.title}>
      <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 7, width: '100%', alignItems: 'stretch', justifyContent: 'stretch', borderRadius: 12 }}>
        <strong>{copy.title}</strong>
        {workflow.items.map((entry) => {
          const completed = entry.status === 'completed';
          const manual = entry.source === 'user';
          const editable = manual && !readOnly;
          const updating = updatingCode === entry.code;
          return (
            <label key={entry.code} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: editable ? 'pointer' : 'default' }}>
              {editable ? (
                <input
                  type="checkbox"
                  checked={completed}
                  disabled={Boolean(updatingCode)}
                  onChange={() => onToggleManualItem?.(entry, completed ? 'pending' : 'completed')}
                />
              ) : (
                <span aria-hidden="true">{completed ? '✓' : '○'}</span>
              )}
              <span>{copy.items[entry.code] || String(entry.code).replace(/_/g, ' ')}</span>
              {updating ? <small>{copy.updating}</small> : null}
            </label>
          );
        })}
        <strong>{copy.progress(Number(workflow.completed || 0), Number(workflow.total || workflow.items.length || 0))}</strong>
        <small>{copy.operationalOnly}</small>
        {updateError ? <small className="maxxis-message-error">{copy.updateFailed}</small> : null}
      </div>
    </div>
  );
}

function NextBestActionCard({ result, language, onAction }) {
  const action = result?.nextBestAction || null;
  if (!action?.code) return null;
  const copy = NEXT_BEST_ACTION_COPY[language] || NEXT_BEST_ACTION_COPY.en;
  const actionLabel = copy.actions[action.code] || String(action.code).replace(/_/g, ' ');
  const priorityLabel = copy.priorities[action.priority] || String(action.priority || '');

  return (
    <div className="maxxis-action-links" aria-label={copy.title}>
      <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 5, width: '100%', alignItems: 'stretch', justifyContent: 'stretch', borderRadius: 12 }}>
        <strong>{copy.title}</strong>
        <span>{actionLabel}</span>
        {priorityLabel ? <span>{`${copy.priority}: ${priorityLabel}`}</span> : null}
        {action.reason ? <span>{`${copy.reason}: ${action.reason}`}</span> : null}
        {action.actionable ? (
          <button
            type="button"
            className="maxxis-action-link"
            onClick={() => {
              void trackProductEvent('next_best_action_clicked', {
                dedupeKey: `next-action-clicked:${action.code}`,
                properties: { source: 'maxxis', workflow_code: action.code },
              });
              onAction?.('matches');
            }}
          >
            <span>{copy.review}</span>
            <Icon name="arrowRight" size={13} color="currentColor" strokeWidth={2.1} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DealCopilotOverviewCard({
  data,
  language,
  onAction,
}) {
  const [expanded, setExpanded] = useState(false);
  const copy = DEAL_COPILOT_COPY[language] || DEAL_COPILOT_COPY.en;
  const commonCopy = COPY[language] || COPY.en;
  const advisorCopy = DEAL_ADVISOR_COPY[language] || DEAL_ADVISOR_COPY.en;
  const property = data?.propertySummary;
  if (!property) return null;
  const metrics = data?.metricsSummary?.metrics || null;
  const attentionPoints = Array.isArray(data?.advisorSummary?.attentionPoints)
    ? data.advisorSummary.attentionPoints.map((code) => advisorCopy.attention[code]).filter(Boolean)
    : [];
  const needs = Array.isArray(data?.serviceSummary?.needs) ? data.serviceSummary.needs : [];
  const providers = Array.isArray(data?.serviceSummary?.providers) ? data.serviceSummary.providers : [];
  const conversation = data?.conversationSummary || null;
  const unavailable = Array.isArray(data?.capabilitiesUnavailable) ? data.capabilitiesUnavailable : [];
  const location = [property.city, property.state, property.zip].filter(Boolean).join(', ');

  return (
    <div className="maxxis-action-links" aria-label={copy.title}>
      <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 9, width: '100%', alignItems: 'stretch', justifyContent: 'stretch', borderRadius: 12 }}>
        <strong>{copy.title}</strong>
        <span>{location || property.type || commonCopy.propertyDetailsTitle}</span>
        <NextBestActionCard result={data.nextBestAction} language={language} onAction={onAction} />
        <DealProgressCard
          workflow={data.workflow}
          language={language}
          readOnly
        />
        <div style={{ display: 'grid', gap: 3 }}>
          <strong>{copy.attention}</strong>
          {(attentionPoints.length ? attentionPoints.slice(0, 3) : [copy.noAttention]).map((item) => (
            <span key={item} style={{ whiteSpace: 'normal' }}>{`⚠ ${item}`}</span>
          ))}
        </div>
        <button
          type="button"
          className="maxxis-action-link"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span>{expanded ? copy.hideDetails : copy.viewDetails}</span>
        </button>
        {expanded ? (
          <div style={{ display: 'grid', gap: 9 }}>
            {metrics ? (
              <div style={{ display: 'grid', gap: 3 }}>
                <strong>{copy.keyMetrics}</strong>
                <DealMetricRow label={commonCopy.pricePerSqftMetric} metric={metrics.pricePerSqft} kind="unitCurrency" language={language} />
                <DealMetricRow label={commonCopy.acquisitionPlusRehabMetric} metric={metrics.acquisitionPlusRehab} kind="currency" language={language} />
                <DealMetricRow label={commonCopy.capRateMetric} metric={metrics.capRate} kind="percent" language={language} />
              </div>
            ) : null}
            {(needs.length || providers.length) ? (
              <div style={{ display: 'grid', gap: 3 }}>
                <strong>{copy.services}</strong>
                {needs.length ? <span style={{ whiteSpace: 'normal' }}>{`${copy.needs}: ${needs.map((need) => need.serviceType || need.type).filter(Boolean).join(', ')}`}</span> : null}
                {providers.length ? <span style={{ whiteSpace: 'normal' }}>{`${copy.providers}: ${providers.map((provider) => provider.title).filter(Boolean).join(', ')}`}</span> : null}
              </div>
            ) : null}
            {conversation ? (
              <div style={{ display: 'grid', gap: 3 }}>
                <strong>{copy.conversation}</strong>
                {conversation.summary ? <span style={{ whiteSpace: 'normal' }}>{conversation.summary}</span> : null}
                {Array.isArray(conversation.openItems) ? conversation.openItems.map((item) => (
                  <span key={item} style={{ whiteSpace: 'normal' }}>{`• ${item}`}</span>
                )) : null}
              </div>
            ) : null}
            {unavailable.length ? <small>{copy.unavailable}</small> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProviderUnlockControls({
  service,
  messageId,
  propertyId = '',
  language,
  activeProviderUnlockId,
  activeProviderDraftId,
  pendingProviderUnlock,
  onPrepareProviderUnlock,
  onConfirmProviderUnlock,
  onCancelProviderUnlock,
  onPrepareProviderMessageDraft,
}) {
  const copy = PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en;
  const access = service.contactAccess || { status: 'unavailable', cost: null, currency: 'nuggets' };
  const active = activeProviderUnlockId === service.id;
  const draftActive = activeProviderDraftId === service.id;
  const canDraft = access.status === 'already_unlocked' && UUID_PATTERN.test(String(propertyId || ''));
  const pending = pendingProviderUnlock?.serviceId === service.id && pendingProviderUnlock?.messageId === messageId
    ? pendingProviderUnlock
    : null;
  return (
    <div data-testid="maxxis-provider-unlock-controls" style={{ display: 'grid', gap: 5, paddingTop: 3 }}>
      <span data-testid="maxxis-provider-contact-status" style={{ whiteSpace: 'normal' }}>{contactStatusLabel(access, copy)}</span>
      {access.contact ? <UnlockedProviderContact contact={access.contact} copy={copy} /> : null}
      {pending ? (
        <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 6, width: '100%' }}>
          <strong>{copy.unlockProviderContact}</strong>
          <span>{pending.serviceType || service.serviceType}</span>
          {pending.markets?.length ? <span>{pending.markets.join(', ')}</span> : null}
          <span>{`${copy.cost}: ${pending.cost} ${pending.currency || 'nuggets'}`}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              data-testid="maxxis-provider-unlock-confirm"
              type="button"
              className="maxxis-action-link"
              disabled={active}
              onClick={() => onConfirmProviderUnlock?.(pending)}
              style={{ width: 'auto' }}
            >
              <span>{active ? copy.unlocking : copy.unlockContact}</span>
            </button>
            <button
              data-testid="maxxis-provider-unlock-cancel"
              type="button"
              className="maxxis-action-link"
              disabled={active}
              onClick={() => onCancelProviderUnlock?.(pending)}
              style={{ width: 'auto' }}
            >
              <span>{active ? copy.cancelling : copy.cancel}</span>
            </button>
          </div>
        </div>
      ) : null}
      {!pending && access.status === 'locked' ? (
        <button
          data-testid="maxxis-provider-unlock-prepare"
          type="button"
          className="maxxis-action-link"
          disabled={active}
          onClick={() => onPrepareProviderUnlock?.(messageId, service)}
          style={{ width: 'fit-content' }}
        >
          <span>{active ? copy.preparing : copy.unlockContact}</span>
        </button>
      ) : null}
      {!pending && access.status === 'already_unlocked' && !access.contact ? (
        <button
          type="button"
          className="maxxis-action-link"
          disabled={active}
          onClick={() => onPrepareProviderUnlock?.(messageId, service)}
          style={{ width: 'fit-content' }}
        >
          <span>{active ? copy.preparing : copy.viewContact}</span>
        </button>
      ) : null}
      {!pending && canDraft ? (
        <button
          type="button"
          className="maxxis-action-link"
          disabled={draftActive}
          onClick={() => onPrepareProviderMessageDraft?.(messageId, service, propertyId)}
          style={{ width: 'fit-content' }}
        >
          <span>{draftActive ? copy.drafting : copy.draftMessage}</span>
        </button>
      ) : null}
    </div>
  );
}

function SuggestedPropertyServices({
  messageId,
  serviceNeeds,
  serviceMatches,
  language,
  activeProviderUnlockId,
  activeProviderDraftId,
  pendingProviderUnlock,
  propertyId,
  onPrepareProviderUnlock,
  onConfirmProviderUnlock,
  onCancelProviderUnlock,
  onPrepareProviderMessageDraft,
}) {
  if (!Array.isArray(serviceNeeds) || !serviceNeeds.length) return null;
  const copy = PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en;
  const matchesByType = new Map(
    (Array.isArray(serviceMatches) ? serviceMatches : []).map((match) => [match.serviceType, match]),
  );
  return (
    <div className="maxxis-action-links" aria-label={copy.title}>
      <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 8, width: '100%', alignItems: 'stretch', justifyContent: 'stretch', borderRadius: 12 }}>
        <strong>{copy.title}</strong>
        {serviceNeeds.map((need) => {
          const match = matchesByType.get(need.serviceType);
          const services = Array.isArray(match?.services) ? match.services : [];
          return (
            <div key={need.serviceType} style={{ display: 'grid', gap: 3 }}>
              <strong>{`• ${copy.serviceTypes[need.serviceType] || need.serviceType}`}</strong>
              <span style={{ whiteSpace: 'normal' }}>{`${copy.reason}: ${copy.reasons[need.reasonCode] || need.reasonCode}`}</span>
              <span style={{ whiteSpace: 'normal' }}>{`${copy.confidence}: ${copy.confidenceValues[need.confidence] || need.confidence}`}</span>
              {match ? (
                <div style={{ display: 'grid', gap: 2, paddingTop: 2 }}>
                  <strong>{copy.availableProviders}</strong>
                  {services.length
                    ? services.map((service) => (
                      <div key={service.id} style={{ display: 'grid', gap: 2, paddingBottom: 4 }}>
                        <span>
                          {`- ${service.title} — ${service.fit?.calculable && Number.isFinite(service.fit?.score)
                            ? `${copy.fit}: ${service.fit.score}%`
                            : copy.fitUnavailable}`}
                        </span>
                        <ProviderUnlockControls
                          service={service}
                          messageId={messageId}
                          propertyId={propertyId}
                          language={language}
                          activeProviderUnlockId={activeProviderUnlockId}
                          activeProviderDraftId={activeProviderDraftId}
                          pendingProviderUnlock={pendingProviderUnlock}
                          onPrepareProviderUnlock={onPrepareProviderUnlock}
                          onConfirmProviderUnlock={onConfirmProviderUnlock}
                          onCancelProviderUnlock={onCancelProviderUnlock}
                          onPrepareProviderMessageDraft={onPrepareProviderMessageDraft}
                        />
                      </div>
                    ))
                    : <span>{copy.noProviders}</span>}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProviderMessageDraftCard({
  message,
  language,
  pendingProviderMessageSend,
  activeProviderMessageSendId,
  activeProviderConversationAnalysisId,
  onUpdateProviderMessageDraft,
  onPrepareProviderMessageSend,
  onConfirmProviderMessageSend,
  onCancelProviderMessageSend,
  onAnalyzeProviderConversation,
}) {
  const copy = PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en;
  const [copied, setCopied] = useState(false);
  const draft = String(message.data?.draft || '');
  const pending = pendingProviderMessageSend?.messageId === message.id ? pendingProviderMessageSend : null;
  const active = activeProviderMessageSendId === message.id || (pending?.actionId && activeProviderMessageSendId === pending.actionId);
  const analysisActive = activeProviderConversationAnalysisId === message.id;
  const serviceTitle = String(pending?.serviceTitle || message.data?.serviceTitle || '').trim();
  const sent = message.data?.sentStatus === 'sent';
  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="maxxis-action-links" aria-label={copy.messageDraftTitle}>
      <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 8, width: '100%', alignItems: 'stretch', justifyContent: 'stretch', borderRadius: 12 }}>
        <strong>{copy.messageDraftTitle}</strong>
        <span style={{ whiteSpace: 'normal' }}>{copy.editDraftHint}</span>
        <textarea
          value={draft}
          disabled={sent}
          onChange={(event) => onUpdateProviderMessageDraft?.(message.id, event.target.value)}
          rows={7}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 10,
            background: C.bg,
            color: C.t1,
            resize: 'vertical',
            font: 'inherit',
            lineHeight: 1.45,
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="maxxis-action-link"
            onClick={handleCopy}
            style={{ width: 'fit-content' }}
          >
            <span>{copied ? copy.draftCopied : copy.copyDraft}</span>
          </button>
          {!sent && !pending ? (
            <button
              type="button"
              className="maxxis-action-link"
              disabled={active || !draft.trim() || draft.length > 1800}
              onClick={() => onPrepareProviderMessageSend?.(message)}
              style={{ width: 'fit-content' }}
            >
              <span>{active ? copy.sendingMessage : copy.sendMessage}</span>
            </button>
          ) : null}
        </div>
        {!sent && pending ? (
          <div style={{ display: 'grid', gap: 7, padding: 8, border: `1px solid ${C.gold}`, borderRadius: 10, background: C.alpha(C.gold, 0.1) }}>
            <strong>{serviceTitle ? `${copy.confirmSendPrefix} ${serviceTitle}?` : copy.confirmSendQuestion}</strong>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="maxxis-action-link"
                disabled={active}
                onClick={() => onConfirmProviderMessageSend?.(pending)}
                style={{ width: 'fit-content' }}
              >
                <span>{active ? copy.sendingMessage : copy.confirmSend}</span>
              </button>
              <button
                type="button"
                className="maxxis-action-link"
                disabled={active}
                onClick={() => onCancelProviderMessageSend?.(pending)}
                style={{ width: 'fit-content' }}
              >
                <span>{copy.cancel}</span>
              </button>
            </div>
          </div>
        ) : null}
        {sent ? <strong>{copy.messageSent}</strong> : null}
        {sent ? (
          <button
            type="button"
            className="maxxis-action-link"
            disabled={analysisActive}
            onClick={() => onAnalyzeProviderConversation?.(message)}
            style={{ width: 'fit-content' }}
          >
            <span>{analysisActive ? copy.analyzingConversation : copy.analyzeConversation}</span>
          </button>
        ) : null}
        {message.data?.sendError ? <span style={{ color: C.danger, whiteSpace: 'normal' }}>{copy.messageSendFailed}</span> : null}
      </div>
    </div>
  );
}

function ProviderConversationAnalysisCard({
  message,
  language,
  pendingProviderMessageSend,
  activeProviderMessageSendId,
  onUpdateProviderConversationSuggestedReply,
  onPrepareProviderMessageSend,
  onConfirmProviderMessageSend,
  onCancelProviderMessageSend,
}) {
  const copy = PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en;
  const [copied, setCopied] = useState(false);
  const data = message.data || {};
  const suggestedReply = String(data.suggestedReply || '');
  const pending = pendingProviderMessageSend?.messageId === message.id ? pendingProviderMessageSend : null;
  const active = activeProviderMessageSendId === message.id || (pending?.actionId && activeProviderMessageSendId === pending.actionId);
  const sent = data.sentStatus === 'sent';
  const canSendReply = UUID_PATTERN.test(String(data.serviceId || '')) && UUID_PATTERN.test(String(data.propertyId || ''));
  const serviceTitle = String(pending?.serviceTitle || data.serviceTitle || '').trim();
  const facts = Array.isArray(data.facts) ? data.facts : [];
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const requests = Array.isArray(data.requests) ? data.requests : [];
  const quotedAmounts = Array.isArray(data.quotedAmounts) ? data.quotedAmounts : [];
  const availability = Array.isArray(data.availability) ? data.availability : [];
  const openItems = Array.isArray(data.openItems) ? data.openItems : [];
  const renderList = (title, items) => (
    <div style={{ display: 'grid', gap: 3 }}>
      <strong>{title}</strong>
      {Array.isArray(items) && items.length
        ? items.map((item) => <span key={item} style={{ whiteSpace: 'normal' }}>{`• ${item}`}</span>)
        : <span style={{ whiteSpace: 'normal' }}>{copy.noItems}</span>}
    </div>
  );
  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(suggestedReply);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="maxxis-action-links" aria-label={copy.conversationSummaryTitle}>
      <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 8, width: '100%', alignItems: 'stretch', justifyContent: 'stretch', borderRadius: 12 }}>
        <strong>{copy.conversationSummaryTitle}</strong>
        <span style={{ whiteSpace: 'normal' }}>{data.summary || copy.noItems}</span>
        {renderList(copy.factsTitle, facts)}
        {renderList(copy.providerAskedTitle, [...questions, ...requests])}
        {renderList(copy.amountsTitle, quotedAmounts)}
        {renderList(copy.availabilityTitle, availability)}
        {renderList(copy.openItemsTitle, openItems)}
        <strong>{copy.suggestedReplyTitle}</strong>
        <textarea
          value={suggestedReply}
          disabled={sent}
          onChange={(event) => onUpdateProviderConversationSuggestedReply?.(message.id, event.target.value)}
          rows={6}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 10,
            background: C.bg,
            color: C.t1,
            resize: 'vertical',
            font: 'inherit',
            lineHeight: 1.45,
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="maxxis-action-link"
            disabled={!suggestedReply.trim()}
            onClick={handleCopy}
            style={{ width: 'fit-content' }}
          >
            <span>{copied ? copy.draftCopied : copy.copyDraft}</span>
          </button>
          {!sent && !pending ? (
            <button
              type="button"
              className="maxxis-action-link"
              disabled={active || !canSendReply || !suggestedReply.trim() || suggestedReply.length > 1800}
              onClick={() => onPrepareProviderMessageSend?.(message)}
              style={{ width: 'fit-content' }}
            >
              <span>{active ? copy.sendingMessage : copy.sendReply}</span>
            </button>
          ) : null}
        </div>
        {!sent && pending ? (
          <div style={{ display: 'grid', gap: 7, padding: 8, border: `1px solid ${C.gold}`, borderRadius: 10, background: C.alpha(C.gold, 0.1) }}>
            <strong>{serviceTitle ? `${copy.confirmReplyPrefix} ${serviceTitle}?` : copy.confirmReplyQuestion}</strong>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="maxxis-action-link"
                disabled={active}
                onClick={() => onConfirmProviderMessageSend?.(pending)}
                style={{ width: 'fit-content' }}
              >
                <span>{active ? copy.sendingMessage : copy.confirmSend}</span>
              </button>
              <button
                type="button"
                className="maxxis-action-link"
                disabled={active}
                onClick={() => onCancelProviderMessageSend?.(pending)}
                style={{ width: 'fit-content' }}
              >
                <span>{copy.cancel}</span>
              </button>
            </div>
          </div>
        ) : null}
        {sent ? <strong>{copy.replySent}</strong> : null}
        {data.sendError ? <span style={{ color: C.danger, whiteSpace: 'normal' }}>{copy.messageSendFailed}</span> : null}
      </div>
    </div>
  );
}

function profileSuggestionText(suggestion, language) {
  const value = String(suggestion?.suggestedValue || '').trim();
  if (!value) return '';
  const dimension = String(suggestion?.dimension || '');
  if (language === 'pt') {
    if (dimension === 'market') return `Sua atividade recente indica interesse recorrente em propriedades em ${value}. Considere revisar seu perfil.`;
    if (dimension === 'property_type') return `Sua atividade recente indica interesse recorrente em propriedades do tipo ${value}. Considere revisar seu perfil.`;
    return `Sua atividade recente indica interesse recorrente na estrategia ${value}. Considere revisar seu perfil.`;
  }
  if (language === 'es') {
    if (dimension === 'market') return `Tu actividad reciente indica interes recurrente en propiedades en ${value}. Considera revisar tu perfil.`;
    if (dimension === 'property_type') return `Tu actividad reciente indica interes recurrente en propiedades de tipo ${value}. Considera revisar tu perfil.`;
    return `Tu actividad reciente indica interes recurrente en la estrategia ${value}. Considera revisar tu perfil.`;
  }
  if (dimension === 'market') return `Your recent activity indicates recurring interest in ${value} properties. Consider reviewing your profile.`;
  if (dimension === 'property_type') return `Your recent activity indicates recurring interest in ${value} properties. Consider reviewing your profile.`;
  return `Your recent activity indicates recurring interest in the ${value} strategy. Consider reviewing your profile.`;
}

function addSuggestionLabel(suggestion, language) {
  const value = String(suggestion?.suggestedValue || '').trim();
  if (language === 'pt') return `Adicionar ${value} ao perfil`;
  if (language === 'es') return `Agregar ${value} al perfil`;
  return `Add ${value} to profile`;
}

function getViewportBounds() {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return {
    width: window.innerWidth || document.documentElement?.clientWidth || 0,
    height: window.innerHeight || document.documentElement?.clientHeight || 0,
  };
}

export function clampWidgetPosition(position) {
  const { width, height } = getViewportBounds();
  if (!width || !height || !position) return null;
  const size = width <= 767 ? 58 : 62;
  const margin = 8;
  return {
    x: Math.min(Math.max(Number(position.x) || margin, margin), Math.max(margin, width - size - margin)),
    y: Math.min(Math.max(Number(position.y) || margin, margin), Math.max(margin, height - size - margin)),
  };
}

export function readStoredWidgetPosition() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MAXXIS_WIDGET_POSITION_KEY);
    if (!raw) return null;
    return clampWidgetPosition(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function MessageBubble({
  message,
  language,
  onAction,
  onConfirmProfileSuggestion,
  onCancelProfileSuggestion,
  activeProfileActionId,
  activeProviderUnlockId,
  activeProviderDraftId,
  activeProviderMessageSendId,
  activeProviderConversationAnalysisId,
  activeWorkflowItemCode,
  pendingProviderUnlock,
  pendingProviderMessageSend,
  onPrepareProviderUnlock,
  onConfirmProviderUnlock,
  onCancelProviderUnlock,
  onPrepareProviderMessageDraft,
  onPrepareProviderMessageSend,
  onConfirmProviderMessageSend,
  onCancelProviderMessageSend,
  onAnalyzeProviderConversation,
  onUpdateProviderMessageDraft,
  onUpdateProviderConversationSuggestedReply,
  onToggleWorkflowManualItem,
  onDealFollowUp,
  smartActions,
  onSmartAction,
  onExportAnalysisPdf,
  exportAnalysisLabel,
  exportingAnalysisLabel,
  isExportingAnalysis,
}) {
  const isUser = message.role === 'user';
  const { text, actions } = isUser
    ? { text: String(message.content || ''), actions: [] }
    : parseActionContent(message.content, language);
  return (
    <div className={`maxxis-message ${isUser ? 'maxxis-message-user' : 'maxxis-message-assistant'} ${message.error ? 'maxxis-message-error' : ''}`}>
      {text ? (
        <div className="maxxis-message-body">
          {String(text || '').split('\n').map((line, index, arr) => (
            <React.Fragment key={`${message.id}-line-${index}`}>
              {line}
              {index < arr.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {actions.length ? (
        <div className="maxxis-action-links" aria-label="Maxxis navigation actions">
          {actions.map((action) => (
            <button
              type="button"
              key={`${message.id}-${action.id}`}
              className="maxxis-action-link"
              onClick={() => onAction?.(action.id)}
            >
              <span>{action.label}</span>
              <Icon name="arrowRight" size={13} color="currentColor" strokeWidth={2.1} />
            </button>
          ))}
        </div>
      ) : null}
      {message.type === 'properties' && Array.isArray(message.data?.properties) ? (
        <div className="maxxis-action-links" aria-label="Property search results">
          {message.data.properties.map((property, index) => (
            <div key={property.id} className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 2 }}>
              <strong>{`${(COPY[language] || COPY.en).comparisonProperty} ${comparisonLetter(index)} · ${property.title || property.propertyType || 'Property'}`}</strong>
              <span>{[property.city, property.state, property.zip].filter(Boolean).join(', ')}</span>
              <span>{property.price ? `$${Number(property.price).toLocaleString('en-US')}` : 'Price not provided'}{property.bedrooms ? ` · ${property.bedrooms} bd` : ''}{property.bathrooms ? ` · ${property.bathrooms} ba` : ''}</span>
              {property.match?.calculable && Number.isFinite(property.match?.score) ? <span>{`Match: ${property.match.score}% — ${String(property.match.classification || '').replace(/^./, (letter) => letter.toUpperCase())}`}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {message.type === 'properties' && Array.isArray(message.data?.profileSuggestions) && message.data.profileSuggestions.length ? (
        <div className="maxxis-action-links" aria-label="Investment Profile suggestions">
          <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 5 }}>
            <strong>{(COPY[language] || COPY.en).profileSuggestionTitle}</strong>
            {message.data.profileSuggestions.slice(0, 3).map((suggestion) => {
              const pendingActionId = String(suggestion.pendingActionId || '');
              const actionLoading = Boolean(activeProfileActionId);
              return (
                <div key={`${suggestion.dimension}-${suggestion.suggestedValue}`} style={{ display: 'grid', gap: 5 }}>
                  <span>{profileSuggestionText(suggestion, language)}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {pendingActionId ? (
                      <>
                        <button
                          type="button"
                          className="maxxis-action-link"
                          disabled={actionLoading}
                          onClick={() => onConfirmProfileSuggestion?.(message.id, suggestion)}
                        >
                          <span>{addSuggestionLabel(suggestion, language)}</span>
                          <Icon name="check" size={13} color="currentColor" strokeWidth={2.1} />
                        </button>
                        <button
                          type="button"
                          className="maxxis-action-link"
                          disabled={actionLoading}
                          onClick={() => onCancelProfileSuggestion?.(message.id, suggestion)}
                        >
                          <span>{(COPY[language] || COPY.en).notNow}</span>
                        </button>
                      </>
                    ) : (
                      <button type="button" className="maxxis-action-link" onClick={() => onAction?.('onboarding')}>
                        <span>{(COPY[language] || COPY.en).reviewProfile}</span>
                        <Icon name="arrowRight" size={13} color="currentColor" strokeWidth={2.1} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {message.data?.profileActionFeedback ? (
        <div className={`maxxis-message-body ${message.data.profileActionFeedback.status === 'error' ? 'maxxis-message-error' : ''}`}>
          {message.data.profileActionFeedback.status === 'success'
            ? `${message.data.profileActionFeedback.value} ${(COPY[language] || COPY.en).profileUpdated}`
            : (COPY[language] || COPY.en).profileActionFailed}
        </div>
      ) : null}
      {message.type === 'services' && Array.isArray(message.data?.services) ? (
        <div className="maxxis-action-links" aria-label="Service search results">
          {message.data.services.map((service) => (
            <div key={service.id} className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 2 }}>
              <strong>{service.title || service.serviceType || 'Service'}</strong>
              {service.serviceType ? <span>{service.serviceType}</span> : null}
              {service.markets?.length ? <span>{service.markets.join(', ')}</span> : null}
              <span>{service.price === null || service.price === undefined ? 'Price not provided' : `$${Number(service.price).toLocaleString('en-US')}`}</span>
              <ProviderUnlockControls
                service={service}
                messageId={message.id}
                language={language}
                activeProviderUnlockId={activeProviderUnlockId}
                activeProviderDraftId={activeProviderDraftId}
                pendingProviderUnlock={pendingProviderUnlock}
                onPrepareProviderUnlock={onPrepareProviderUnlock}
                onConfirmProviderUnlock={onConfirmProviderUnlock}
                onCancelProviderUnlock={onCancelProviderUnlock}
                onPrepareProviderMessageDraft={onPrepareProviderMessageDraft}
              />
            </div>
          ))}
        </div>
      ) : null}
      {message.type === 'provider_message_draft' && message.data?.draft ? (
        <ProviderMessageDraftCard
          message={message}
          language={language}
          pendingProviderMessageSend={pendingProviderMessageSend}
          activeProviderMessageSendId={activeProviderMessageSendId}
          activeProviderConversationAnalysisId={activeProviderConversationAnalysisId}
          onUpdateProviderMessageDraft={onUpdateProviderMessageDraft}
          onPrepareProviderMessageSend={onPrepareProviderMessageSend}
          onConfirmProviderMessageSend={onConfirmProviderMessageSend}
          onCancelProviderMessageSend={onCancelProviderMessageSend}
          onAnalyzeProviderConversation={onAnalyzeProviderConversation}
        />
      ) : null}
      {message.type === 'provider_message_sent' && message.data?.serviceId ? (
        <div className="maxxis-action-links" aria-label="Provider message sent">
          <button
            type="button"
            className="maxxis-action-link"
            disabled={activeProviderConversationAnalysisId === message.id}
            onClick={() => onAnalyzeProviderConversation?.(message)}
          >
            <span>{activeProviderConversationAnalysisId === message.id
              ? (PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en).analyzingConversation
              : (PROPERTY_SERVICE_NEEDS_COPY[language] || PROPERTY_SERVICE_NEEDS_COPY.en).analyzeConversation}</span>
          </button>
        </div>
      ) : null}
      {message.type === 'provider_conversation_analysis' ? (
        <ProviderConversationAnalysisCard
          message={message}
          language={language}
          pendingProviderMessageSend={pendingProviderMessageSend}
          activeProviderMessageSendId={activeProviderMessageSendId}
          onUpdateProviderConversationSuggestedReply={onUpdateProviderConversationSuggestedReply}
          onPrepareProviderMessageSend={onPrepareProviderMessageSend}
          onConfirmProviderMessageSend={onConfirmProviderMessageSend}
          onCancelProviderMessageSend={onCancelProviderMessageSend}
        />
      ) : null}
      {message.type === 'investment_profile' && message.data?.profile ? (
        <div className="maxxis-action-links" aria-label="Investment Profile">
          <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 4 }}>
            <strong>Investment Profile</strong>
            {message.data.profile.profileStrength !== undefined ? <span>{`Profile strength: ${message.data.profile.profileStrength}%`}</span> : null}
            {message.data.profile.currentFocus ? <span>{`Focus: ${message.data.profile.currentFocus}`}</span> : null}
            {message.data.profile.investorRoles?.length ? <span>{`Roles: ${message.data.profile.investorRoles.join(', ')}`}</span> : null}
            {message.data.profile.targetMarkets?.length ? <span>{`Markets: ${message.data.profile.targetMarkets.join(', ')}`}</span> : null}
            {message.data.profile.lookingFor?.length ? <span>{`Looking for: ${message.data.profile.lookingFor.join(', ')}`}</span> : null}
            {message.data.profile.propertyTypes?.length ? <span>{`Property types: ${message.data.profile.propertyTypes.join(', ')}`}</span> : null}
            {message.data.profile.strategies?.length ? <span>{`Strategies: ${message.data.profile.strategies.join(', ')}`}</span> : null}
            {message.data.profile.priceRange ? <span>{`Price range: ${message.data.profile.priceRange}`}</span> : null}
            {message.data.profile.acceptableConditions?.length ? <span>{`Acceptable conditions: ${message.data.profile.acceptableConditions.join(', ')}`}</span> : null}
            {message.data.profile.dealSources?.length ? <span>{`Deal sources: ${message.data.profile.dealSources.join(', ')}`}</span> : null}
            {message.data.profile.capitalReady ? <span>{`Capital ready: ${message.data.profile.capitalReady}`}</span> : null}
          </div>
        </div>
      ) : null}
      {message.type === 'property_details' && message.data?.property ? (
        <div className="maxxis-action-links" aria-label={(COPY[language] || COPY.en).propertyDetailsTitle}>
          <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 3 }}>
            <strong>{(COPY[language] || COPY.en).propertyDetailsTitle}</strong>
            <span>{[message.data.property.city, message.data.property.state, message.data.property.zip].filter(Boolean).join(', ')}</span>
            <span>{message.data.property.price === null
              ? (COPY[language] || COPY.en).priceNotProvided
              : `$${Number(message.data.property.price).toLocaleString('en-US')}`}</span>
            {(message.data.property.beds !== null || message.data.property.baths !== null) ? (
              <span>{[
                message.data.property.beds !== null ? `${message.data.property.beds} beds` : '',
                message.data.property.baths !== null ? `${message.data.property.baths} baths` : '',
              ].filter(Boolean).join(' • ')}</span>
            ) : null}
            {message.data.property.sqft ? <span>{`${message.data.property.sqft} sqft`}</span> : null}
            {message.data.property.objective ? <span>{`Objective: ${message.data.property.objective}`}</span> : null}
            {message.data?.missingFields?.length ? (
              <span>{`${(COPY[language] || COPY.en).missingDetails}: ${message.data.missingFields.join(', ')}`}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      {message.type === 'property_details' && message.data?.metrics?.metrics ? (
        <div className="maxxis-action-links" aria-label={(COPY[language] || COPY.en).dealMetricsTitle}>
          <div className="maxxis-action-link" style={{ cursor: 'default', display: 'grid', gap: 5, width: '100%', alignItems: 'stretch', justifyContent: 'stretch', borderRadius: 12 }}>
            <strong>{(COPY[language] || COPY.en).dealMetricsTitle}</strong>
            <DealMetricRow
              label={(COPY[language] || COPY.en).pricePerSqftMetric}
              metric={message.data.metrics.metrics.pricePerSqft}
              kind="unitCurrency"
              language={language}
            />
            <DealMetricRow
              label={(COPY[language] || COPY.en).acquisitionPlusRehabMetric}
              metric={message.data.metrics.metrics.acquisitionPlusRehab}
              kind="currency"
              language={language}
            />
            <DealMetricRow
              label={(COPY[language] || COPY.en).capRateMetric}
              metric={message.data.metrics.metrics.capRate}
              kind="percent"
              language={language}
            />
          </div>
        </div>
      ) : null}
      {message.type === 'property_details' && message.data?.analysis ? (
        <DealAdvisor analysis={message.data.analysis} language={language} />
      ) : null}
      {message.type === 'property_details' && message.data?.workflow ? (
        <DealProgressCard
          workflow={message.data.workflow}
          language={language}
          updatingCode={activeWorkflowItemCode}
          updateError={message.data.workflowError}
          onToggleManualItem={(entry, status) => onToggleWorkflowManualItem?.(message, entry, status)}
        />
      ) : null}
      {message.type === 'property_details' && message.data?.nextBestAction ? (
        <NextBestActionCard
          result={message.data.nextBestAction}
          language={language}
          onAction={onAction}
        />
      ) : null}
      {message.type === 'property_details' && message.data?.serviceNeeds?.length ? (
        <SuggestedPropertyServices
          messageId={message.id}
          serviceNeeds={message.data.serviceNeeds}
          serviceMatches={message.data.serviceMatches}
          propertyId={message.data.property.id}
          language={language}
          activeProviderUnlockId={activeProviderUnlockId}
          activeProviderDraftId={activeProviderDraftId}
          pendingProviderUnlock={pendingProviderUnlock}
          onPrepareProviderUnlock={onPrepareProviderUnlock}
          onConfirmProviderUnlock={onConfirmProviderUnlock}
          onCancelProviderUnlock={onCancelProviderUnlock}
          onPrepareProviderMessageDraft={onPrepareProviderMessageDraft}
        />
      ) : null}
      {message.type === 'smart_provider_actions' && message.data?.serviceNeeds?.length ? (
        <SuggestedPropertyServices
          messageId={message.id}
          serviceNeeds={message.data.serviceNeeds}
          serviceMatches={message.data.serviceMatches}
          propertyId={message.data.property?.id}
          language={language}
          activeProviderUnlockId={activeProviderUnlockId}
          activeProviderDraftId={activeProviderDraftId}
          pendingProviderUnlock={pendingProviderUnlock}
          onPrepareProviderUnlock={onPrepareProviderUnlock}
          onConfirmProviderUnlock={onConfirmProviderUnlock}
          onCancelProviderUnlock={onCancelProviderUnlock}
          onPrepareProviderMessageDraft={onPrepareProviderMessageDraft}
        />
      ) : null}
      {message.type === 'deal_copilot_overview' && message.data?.propertySummary ? (
        <DealCopilotOverviewCard
          data={message.data}
          language={language}
          onAction={onAction}
        />
      ) : null}
      {message.type === 'property_comparison' ? (
        <PropertyComparison data={message.data} language={language} />
      ) : null}
      {!isUser && Array.isArray(message.followUps) && message.followUps.length ? (
        <div className="maxxis-followups" aria-label="Maxxis follow-up options">
          {message.followUps.map((followUp) => (
            <button
              type="button"
              key={`${message.id}-followup-${followUp.code}`}
              className="maxxis-followup-chip"
              data-testid={`maxxis-followup-${followUp.code}`}
              onClick={() => onDealFollowUp?.(followUp, message)}
            >
              {followUp.label}
            </button>
          ))}
        </div>
      ) : null}
      {!isUser && Array.isArray(smartActions) && smartActions.length ? (
        <div className="maxxis-smart-actions" aria-label="Maxxis smart actions">
          {smartActions.slice(0, 3).map((action) => (
            <button
              type="button"
              key={`${message.id}-smart-${action.code}`}
              className="maxxis-smart-action-chip"
              data-testid={`maxxis-smart-action-${action.code}`}
              onClick={() => onSmartAction?.(action, message)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {message.analysisExport ? (
        <div className="maxxis-action-links" aria-label="Maxxis analysis export">
          <button
            type="button"
            className="maxxis-action-link maxxis-analysis-export"
            disabled={isExportingAnalysis}
            onClick={() => onExportAnalysisPdf?.(
              message.analysisExport,
              message.data?.analysis ? formatDealAdvisorExport(message.data.analysis, language) : message.content,
              message.id,
            )}
          >
            <span>{isExportingAnalysis ? exportingAnalysisLabel : exportAnalysisLabel}</span>
            <Icon name="doc" size={13} color="currentColor" strokeWidth={2.1} />
          </button>
        </div>
      ) : null}
      <div className="maxxis-message-meta">{formatTime(message.createdAt)}</div>
    </div>
  );
}
