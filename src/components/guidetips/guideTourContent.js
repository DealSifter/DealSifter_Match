const COPY = {
  en: {
    common: {
      title: 'DealSifter Guide',
      next: 'Next',
      back: 'Back',
      finish: 'Finish tour',
      waiting: 'Complete this step to continue',
      skip: 'Close guide',
      videoSoon: 'The overview video is being prepared. This space is ready to receive it without changing the first-access flow.',
    },
    initial: [
      { id: 'overview', kind: 'video', title: 'Welcome to DealSifter Match', body: 'Start with this short overview of the full journey: create your presence, publish opportunities, discover cards and build connections.' },
      { id: 'language', target: '[data-guide="language-control"], [data-guide="app-menu"]', title: 'Choose your communication language', body: 'Set English, Portuguese or Spanish now. The guide, Maxxis and system messages will follow this preference.' },
      { id: 'maxxis', target: '[data-guide="maxxis-widget"]', title: 'Meet Maxxis AI', body: 'Maxxis answers questions, explains workflows and can take you directly to the module where an action must be completed.' },
      { id: 'onboarding-launcher', target: '[data-guide="onboarding-launcher"]', title: 'Create your first card', body: 'On mobile use New Card. On desktop use the Register card. We will assist you through every required field.', nextTour: 'onboarding', nextPage: 'onboarding' },
    ],
    onboarding: [
      { id: 'account', target: '[data-guide="onboarding-account"]', title: 'Choose the account context', body: 'Select Professional or For Sale by Owner. You may maintain more than one independent profile.' },
      { id: 'profile', target: '[data-guide="onboarding-profile"]', title: 'Complete at least one profile', body: 'Add the identity, location and category for the profile that will own your cards. Primary, Secondary and Tertiary define dashboard priority.' },
      { id: 'contacts', target: '[data-guide="onboarding-contacts"]', title: 'Define contact channels', body: 'Enter valid contact details and select the channels you want buyers to use after unlock.' },
      { id: 'save-profile', target: '[data-guide="onboarding-save-profile"]', title: 'Save the profile', body: 'Save before adding portfolio records so properties and services can be linked to the correct profile.' },
      { id: 'portfolio', target: '[data-guide="onboarding-portfolio"]', title: 'Add a property or service', body: 'Create at least one portfolio record. Fill its real data, images, location and publication settings.' },
      { id: 'link-profile', target: '[data-guide="onboarding-link-profile"]', title: 'Link the record to its owner profile', body: 'Choose Personal, Business or FSBO explicitly. This relationship controls identity in Feed, Map and Matches.' },
      { id: 'records', target: '[data-guide="onboarding-records"]', title: 'Review active records', body: 'Confirm that the card is published and linked to the intended profile.' },
      { id: 'publish', target: '[data-guide="onboarding-publish"]', title: 'Preview and publish', body: 'Validate the personal card on the left and only its linked portfolio on the right. Publish to unlock the app journey.', requiresOnboarding: true, nextTour: 'feed', nextPage: 'dashboard' },
    ],
    feed: [
      { id: 'free-limits', kind: 'free-plan', title: 'Your Free plan starts here', body: 'The Free plan has limited daily swipes, active matches and Gold Nuggets. Unlock cost follows the published portfolio size. Pricing shows plans and extra packs.' },
      { id: 'categories', target: '[data-guide="feed-categories"]', title: 'Choose your Feed lane', body: 'Filter people, services and investment categories without losing your place in the card deck.' },
      { id: 'views', target: '[data-guide="feed-view-switch"]', title: 'Connections, Spotlight and Showcase', body: 'Connections shows profiles and services. Showcase shows properties. Spotlight highlights paid cards.' },
      { id: 'stack', target: '[data-guide="feed-stack"]', title: 'Use the card stack', body: 'Swipe or use the controls to pass, favorite or unlock. Your own cards are visible but cannot be selected.' },
      { id: 'spotlight', target: '[data-guide="feed-spotlight"]', title: 'Promote a card', body: 'Spotlight uses Gold Nuggets and publishes the selected card in paid placements and the Map sidebar.' },
      { id: 'minicards', target: '[data-guide="feed-minicards"]', title: 'Paid opportunity banner', body: 'This banner provides extra visibility to active Spotlight cards.', nextTour: 'mapview', nextPage: 'mapview' },
    ],
    mapview: [
      { id: 'map', target: '[data-guide="map-canvas"]', title: 'Explore the live inventory', body: 'Every published card with valid coordinates appears here. Zoom to split clusters into individual pins.' },
      { id: 'filters', target: '[data-guide="map-filters"]', title: 'Filter without reloading', body: 'People, Deals, Unlocked and My PINs work over the same inventory and can be combined with location filters.' },
      { id: 'spotlight', target: '[data-guide="map-spotlight"]', title: 'Find Spotlight cards quickly', body: 'The Spotlight tab lists only paid highlights while their pins remain on the main map.' },
      { id: 'pin', target: '[data-guide="map-canvas"]', title: 'Open the correct card', body: 'Tap a pin to inspect its identity and portfolio. View in Feed moves that exact card to the top of its deck.', nextTour: 'matches', nextPage: 'matches' },
    ],
    matches: [
      { id: 'people', target: '[data-guide="matches-people"]', title: 'People and unlocked contacts', body: 'This column contains real matches and unlock entitlements. Select a profile to open its conversation and portfolio.' },
      { id: 'interests', target: '[data-guide="matches-interests"]', title: 'Property interests', body: 'Filter unlocked or saved properties by status and state. Entitlements remain consistent across devices.' },
      { id: 'conversation', target: '[data-guide="matches-conversation"]', title: 'Continue the conversation', body: 'Chat is available when plan and contact preferences allow it. System alerts explain any restriction.' },
      { id: 'portfolio', target: '[data-guide="matches-portfolio"]', title: 'Review the portfolio', body: 'See unlocked contact channels, services and properties linked to the selected owner.', completesCycle: true },
    ],
  },
  pt: {
    common: {
      title: 'Guia DealSifter',
      next: 'Próximo',
      back: 'Voltar',
      finish: 'Concluir tour',
      waiting: 'Conclua esta etapa para continuar',
      skip: 'Fechar guia',
      videoSoon: 'O vídeo overview está em elaboração. Este espaço já está preparado para recebê-lo sem alterar o fluxo de primeiro acesso.',
    },
    initial: [
      { id: 'overview', kind: 'video', title: 'Bem-vindo ao DealSifter Match', body: 'Comece com uma visão geral da jornada: crie sua presença, publique oportunidades, encontre cards e construa conexões.' },
      { id: 'language', target: '[data-guide="language-control"], [data-guide="app-menu"]', title: 'Escolha o idioma de comunicação', body: 'Defina inglês, português ou espanhol agora. O guia, o Maxxis e as mensagens do sistema seguirão essa preferência.' },
      { id: 'maxxis', target: '[data-guide="maxxis-widget"]', title: 'Conheça o Maxxis AI', body: 'O Maxxis tira dúvidas, explica fluxos e pode levar você diretamente ao módulo onde uma ação precisa ser feita.' },
      { id: 'onboarding-launcher', target: '[data-guide="onboarding-launcher"]', title: 'Crie seu primeiro card', body: 'No celular use New Card. No desktop use o card Registre-se. Vamos acompanhar todos os campos obrigatórios.', nextTour: 'onboarding', nextPage: 'onboarding' },
    ],
    onboarding: [
      { id: 'account', target: '[data-guide="onboarding-account"]', title: 'Escolha o contexto da conta', body: 'Selecione Professional ou For Sale by Owner. Você pode manter mais de um perfil independente.' },
      { id: 'profile', target: '[data-guide="onboarding-profile"]', title: 'Preencha pelo menos um perfil', body: 'Informe identidade, localização e categoria do perfil responsável pelos cards. Primário, secundário e terciário definem a prioridade no dashboard.' },
      { id: 'contacts', target: '[data-guide="onboarding-contacts"]', title: 'Defina os canais de contato', body: 'Insira contatos válidos e selecione os canais que compradores poderão usar depois do desbloqueio.' },
      { id: 'save-profile', target: '[data-guide="onboarding-save-profile"]', title: 'Salve o perfil', body: 'Salve antes de adicionar registros para que propriedades e serviços sejam vinculados ao perfil correto.' },
      { id: 'portfolio', target: '[data-guide="onboarding-portfolio"]', title: 'Adicione uma propriedade ou serviço', body: 'Crie pelo menos um registro de portfólio com dados reais, imagens, localização e publicação.' },
      { id: 'link-profile', target: '[data-guide="onboarding-link-profile"]', title: 'Vincule o registro ao perfil responsável', body: 'Escolha Personal, Business ou FSBO. Essa relação controla a identidade exibida no Feed, Map e Matches.' },
      { id: 'records', target: '[data-guide="onboarding-records"]', title: 'Revise os registros ativos', body: 'Confirme que o card está publicado e ligado ao perfil desejado.' },
      { id: 'publish', target: '[data-guide="onboarding-publish"]', title: 'Visualize e publique', body: 'Valide o perfil à esquerda e somente o portfólio vinculado à direita. Publique para liberar a jornada do app.', requiresOnboarding: true, nextTour: 'feed', nextPage: 'dashboard' },
    ],
    feed: [
      { id: 'free-limits', kind: 'free-plan', title: 'Seu plano Free começa aqui', body: 'O plano Free possui limites de swipes diários, matches ativos e Gold Nuggets. O custo do unlock segue o tamanho do portfólio publicado. Consulte planos e packs em Pricing.' },
      { id: 'categories', target: '[data-guide="feed-categories"]', title: 'Escolha a faixa do Feed', body: 'Filtre pessoas, serviços e categorias sem perder a posição da pilha de cards.' },
      { id: 'views', target: '[data-guide="feed-view-switch"]', title: 'Connections, Spotlight e Showcase', body: 'Connections mostra perfis e serviços. Showcase mostra propriedades. Spotlight destaca cards pagos.' },
      { id: 'stack', target: '[data-guide="feed-stack"]', title: 'Use a pilha de cards', body: 'Faça swipe ou use os controles para descartar, favoritar ou desbloquear. Seus próprios cards não podem ser selecionados.' },
      { id: 'spotlight', target: '[data-guide="feed-spotlight"]', title: 'Promova um card', body: 'Spotlight usa Gold Nuggets e divulga o card na barra paga e na lista do Map.' },
      { id: 'minicards', target: '[data-guide="feed-minicards"]', title: 'Barra paga de oportunidades', body: 'Esta barra dá visibilidade adicional aos cards com Spotlight ativo.', nextTour: 'mapview', nextPage: 'mapview' },
    ],
    mapview: [
      { id: 'map', target: '[data-guide="map-canvas"]', title: 'Explore o inventário ao vivo', body: 'Todo card publicado com coordenadas válidas aparece aqui. Amplie o mapa para separar clusters em pins individuais.' },
      { id: 'filters', target: '[data-guide="map-filters"]', title: 'Filtre sem recarregar', body: 'People, Deals, Unlocked e My PINs usam o mesmo inventário e podem ser combinados com filtros de localização.' },
      { id: 'spotlight', target: '[data-guide="map-spotlight"]', title: 'Encontre destaques rapidamente', body: 'A aba Spotlight lista apenas anúncios pagos, enquanto os pins continuam no mapa principal.' },
      { id: 'pin', target: '[data-guide="map-canvas"]', title: 'Abra o card correto', body: 'Toque no pin para conferir identidade e portfólio. View in Feed leva exatamente esse card ao topo da pilha.', nextTour: 'matches', nextPage: 'matches' },
    ],
    matches: [
      { id: 'people', target: '[data-guide="matches-people"]', title: 'Pessoas e contatos desbloqueados', body: 'Esta coluna contém matches e desbloqueios reais. Selecione um perfil para abrir conversa e portfólio.' },
      { id: 'interests', target: '[data-guide="matches-interests"]', title: 'Interesses em propriedades', body: 'Filtre propriedades salvas ou desbloqueadas por status e estado. Os direitos são iguais em todos os devices.' },
      { id: 'conversation', target: '[data-guide="matches-conversation"]', title: 'Continue a conversa', body: 'O chat funciona quando plano e preferência de contato permitem. Alertas do sistema explicam qualquer restrição.' },
      { id: 'portfolio', target: '[data-guide="matches-portfolio"]', title: 'Confira o portfólio', body: 'Veja canais desbloqueados, serviços e propriedades vinculados ao responsável selecionado.', completesCycle: true },
    ],
  },
  es: {
    common: {
      title: 'Guía DealSifter',
      next: 'Siguiente',
      back: 'Volver',
      finish: 'Finalizar tour',
      waiting: 'Completa este paso para continuar',
      skip: 'Cerrar guía',
      videoSoon: 'El video general está en preparación. Este espacio ya está listo para recibirlo sin cambiar el flujo inicial.',
    },
    initial: [
      { id: 'overview', kind: 'video', title: 'Bienvenido a DealSifter Match', body: 'Comienza con una visión general: crea tu presencia, publica oportunidades, descubre cards y construye conexiones.' },
      { id: 'language', target: '[data-guide="language-control"], [data-guide="app-menu"]', title: 'Elige el idioma de comunicación', body: 'Configura inglés, portugués o español. La guía, Maxxis y los mensajes del sistema seguirán esta preferencia.' },
      { id: 'maxxis', target: '[data-guide="maxxis-widget"]', title: 'Conoce a Maxxis AI', body: 'Maxxis responde dudas, explica flujos y puede llevarte al módulo donde debes completar una acción.' },
      { id: 'onboarding-launcher', target: '[data-guide="onboarding-launcher"]', title: 'Crea tu primer card', body: 'En móvil usa New Card. En desktop usa el card de registro. Te guiaremos por todos los campos obligatorios.', nextTour: 'onboarding', nextPage: 'onboarding' },
    ],
    onboarding: [
      { id: 'account', target: '[data-guide="onboarding-account"]', title: 'Elige el contexto de la cuenta', body: 'Selecciona Professional o For Sale by Owner. Puedes mantener perfiles independientes.' },
      { id: 'profile', target: '[data-guide="onboarding-profile"]', title: 'Completa al menos un perfil', body: 'Agrega identidad, ubicación y categoría del perfil responsable. Primary, Secondary y Tertiary definen prioridad.' },
      { id: 'contacts', target: '[data-guide="onboarding-contacts"]', title: 'Define canales de contacto', body: 'Ingresa contactos válidos y selecciona los canales disponibles después del desbloqueo.' },
      { id: 'save-profile', target: '[data-guide="onboarding-save-profile"]', title: 'Guarda el perfil', body: 'Guarda antes de agregar registros para vincular propiedades y servicios correctamente.' },
      { id: 'portfolio', target: '[data-guide="onboarding-portfolio"]', title: 'Agrega una propiedad o servicio', body: 'Crea al menos un registro con datos reales, imágenes, ubicación y publicación.' },
      { id: 'link-profile', target: '[data-guide="onboarding-link-profile"]', title: 'Vincula el registro al perfil', body: 'Elige Personal, Business o FSBO. Esta relación controla la identidad en Feed, Map y Matches.' },
      { id: 'records', target: '[data-guide="onboarding-records"]', title: 'Revisa los registros activos', body: 'Confirma que el card esté publicado y vinculado al perfil correcto.' },
      { id: 'publish', target: '[data-guide="onboarding-publish"]', title: 'Previsualiza y publica', body: 'Valida el perfil a la izquierda y su portafolio a la derecha. Publica para liberar el recorrido.', requiresOnboarding: true, nextTour: 'feed', nextPage: 'dashboard' },
    ],
    feed: [
      { id: 'free-limits', kind: 'free-plan', title: 'Tu plan Free comienza aquí', body: 'El plan Free limita swipes diarios, matches activos y Gold Nuggets. El costo del unlock sigue el tamaño del portafolio. Revisa planes y packs en Pricing.' },
      { id: 'categories', target: '[data-guide="feed-categories"]', title: 'Elige la vía del Feed', body: 'Filtra personas, servicios y categorías sin perder la posición del deck.' },
      { id: 'views', target: '[data-guide="feed-view-switch"]', title: 'Connections, Spotlight y Showcase', body: 'Connections muestra perfiles y servicios. Showcase muestra propiedades. Spotlight destaca cards pagos.' },
      { id: 'stack', target: '[data-guide="feed-stack"]', title: 'Usa el deck de cards', body: 'Desliza o usa los controles para descartar, guardar o desbloquear. Tus propios cards no son seleccionables.' },
      { id: 'spotlight', target: '[data-guide="feed-spotlight"]', title: 'Promociona un card', body: 'Spotlight usa Gold Nuggets y publica el card en espacios pagos y en la lista del Map.' },
      { id: 'minicards', target: '[data-guide="feed-minicards"]', title: 'Banner pago de oportunidades', body: 'Este banner ofrece visibilidad adicional a cards con Spotlight activo.', nextTour: 'mapview', nextPage: 'mapview' },
    ],
    mapview: [
      { id: 'map', target: '[data-guide="map-canvas"]', title: 'Explora el inventario en vivo', body: 'Cada card publicado con coordenadas válidas aparece aquí. Amplía para separar clusters.' },
      { id: 'filters', target: '[data-guide="map-filters"]', title: 'Filtra sin recargar', body: 'People, Deals, Unlocked y My PINs usan el mismo inventario junto con filtros de ubicación.' },
      { id: 'spotlight', target: '[data-guide="map-spotlight"]', title: 'Encuentra destacados rápidamente', body: 'La pestaña Spotlight lista anuncios pagos y sus pins permanecen en el mapa.' },
      { id: 'pin', target: '[data-guide="map-canvas"]', title: 'Abre el card correcto', body: 'Toca un pin para ver identidad y portafolio. View in Feed lleva ese card al inicio.', nextTour: 'matches', nextPage: 'matches' },
    ],
    matches: [
      { id: 'people', target: '[data-guide="matches-people"]', title: 'Personas y contactos desbloqueados', body: 'Esta columna contiene matches y unlocks reales. Selecciona un perfil para abrir conversación y portafolio.' },
      { id: 'interests', target: '[data-guide="matches-interests"]', title: 'Intereses en propiedades', body: 'Filtra propiedades guardadas o desbloqueadas por estado y situación.' },
      { id: 'conversation', target: '[data-guide="matches-conversation"]', title: 'Continúa la conversación', body: 'El chat depende del plan y preferencias de contacto. Las alertas explican cualquier restricción.' },
      { id: 'portfolio', target: '[data-guide="matches-portfolio"]', title: 'Revisa el portafolio', body: 'Consulta canales desbloqueados, servicios y propiedades del responsable.', completesCycle: true },
    ],
  },
};

export function getGuideTourCopy(language) {
  const lang = String(language || 'en').slice(0, 2).toLowerCase();
  return COPY[lang] || COPY.en;
}

