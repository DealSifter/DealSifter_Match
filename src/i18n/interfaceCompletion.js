import { activityLabel } from '../lib/activityLabels';
export const interfaceCompletion = {
  en: {
    cards: { ownerLabel: 'Owner', profileLabel: 'Profile', dealOne: 'deal', dealOther: 'deals', nuggetOne: 'nugget', previewContactLocked: 'Contact locked', previewUnlockWith: 'Unlock with', undo: 'Undo', profileDescription: 'Profile description', exclusivityActiveBadge: 'Exclusivity', exclusivityActiveStrip: 'Exclusive access active until the timer ends', exclusivityPartialStrip: 'Partial exclusivity available', exclusivityNewStrip: 'Unlock first with full exclusivity', onlyUnlockOne: 'Only {count} unlock', onlyUnlockOther: 'Only {count} unlocks', newBadge: 'New', readFullDescription: 'Read full description', propertyDescription: 'Property description', assetLocked: 'Asset locked', previewNuggets: 'nuggets', next: 'Next card', partialExclusive: 'Partial exclusivity', exclusiveAccessTitle: 'Exclusive access active' },
    modals: { billingAnnual: 'Annual · save {discount}%', nuggetsWord: 'nuggets' },
    pricing: { billingAnnual: 'Annual · save {discount}%', nuggetsWord: 'nuggets', perMonthShort: '/mo', perYearShort: '/yr', checkoutSubscription: 'Subscription plan', checkoutNuggets: 'Nugget pack' },
    nav: { dialogLabel: 'Dialog', closeDialog: 'Close dialog', menu: 'Menu', close: 'Close', back: 'Back', deleteAll: 'Delete all', delete: 'Delete', markAllRead: 'Mark all as read', logout: 'Sign out', navigation: 'Navigation' },
    spotlight: { close: 'Close' }, admin: { adminNote: 'Admin authentication', adminNoteDesc: 'Use your admin account credentials to sign in.' }, auth: { forgotPassword: 'Forgot your password?' },
  },
  pt: {
    cards: { ownerLabel: 'Proprietário', profileLabel: 'Perfil', dealOne: 'negócio', dealOther: 'negócios', nuggetOne: 'nugget', previewContactLocked: 'Contato bloqueado', previewUnlockWith: 'Desbloquear com', undo: 'Desfazer', profileDescription: 'Descrição do perfil', exclusivityActiveBadge: 'Exclusividade', exclusivityActiveStrip: 'Acesso exclusivo até o prazo terminar', exclusivityPartialStrip: 'Exclusividade parcial disponível', exclusivityNewStrip: 'Desbloqueie primeiro com exclusividade', onlyUnlockOne: 'Só {count} desbloqueio', onlyUnlockOther: 'Só {count} desbloqueios', newBadge: 'Novo', readFullDescription: 'Ler descrição completa', propertyDescription: 'Descrição do imóvel', assetLocked: 'Imóvel bloqueado', previewNuggets: 'nuggets', next: 'Próximo card', partialExclusive: 'Exclusividade parcial', exclusiveAccessTitle: 'Acesso exclusivo ativo' },
    modals: { billingAnnual: 'Anual · economize {discount}%', nuggetsWord: 'nuggets' },
    pricing: { billingAnnual: 'Anual · economize {discount}%', nuggetsWord: 'nuggets', perMonthShort: '/mês', perYearShort: '/ano', checkoutSubscription: 'Plano de assinatura', checkoutNuggets: 'Pacote de nuggets' },
    nav: { dialogLabel: 'Janela de diálogo', closeDialog: 'Fechar janela', menu: 'Menu', close: 'Fechar', back: 'Voltar', deleteAll: 'Excluir todas', delete: 'Excluir', markAllRead: 'Marcar todas como lidas', logout: 'Sair', navigation: 'Navegação' },
    spotlight: { close: 'Fechar' }, admin: { adminNote: 'Autenticação de administrador', adminNoteDesc: 'Use as credenciais da sua conta de administrador para entrar.' }, auth: { forgotPassword: 'Esqueceu sua senha?' },
  },
  es: {
    cards: { ownerLabel: 'Propietario', profileLabel: 'Perfil', dealOne: 'negocio', dealOther: 'negocios', nuggetOne: 'nugget', previewContactLocked: 'Contacto bloqueado', previewUnlockWith: 'Desbloquear con', undo: 'Deshacer', profileDescription: 'Descripción del perfil', exclusivityActiveBadge: 'Exclusividad', exclusivityActiveStrip: 'Acceso exclusivo hasta que termine el plazo', exclusivityPartialStrip: 'Exclusividad parcial disponible', exclusivityNewStrip: 'Desbloquea primero con exclusividad', onlyUnlockOne: 'Solo {count} desbloqueo', onlyUnlockOther: 'Solo {count} desbloqueos', newBadge: 'Nuevo', readFullDescription: 'Leer descripción completa', propertyDescription: 'Descripción del inmueble', assetLocked: 'Inmueble bloqueado', previewNuggets: 'nuggets', next: 'Siguiente tarjeta', partialExclusive: 'Exclusividad parcial', exclusiveAccessTitle: 'Acceso exclusivo activo' },
    modals: { billingAnnual: 'Anual · ahorra {discount}%', nuggetsWord: 'nuggets' },
    pricing: { billingAnnual: 'Anual · ahorra {discount}%', nuggetsWord: 'nuggets', perMonthShort: '/mes', perYearShort: '/año', checkoutSubscription: 'Plan de suscripción', checkoutNuggets: 'Paquete de nuggets' },
    nav: { dialogLabel: 'Ventana de diálogo', closeDialog: 'Cerrar ventana', menu: 'Menú', close: 'Cerrar', back: 'Volver', deleteAll: 'Eliminar todas', delete: 'Eliminar', markAllRead: 'Marcar todas como leídas', logout: 'Cerrar sesión', navigation: 'Navegación' },
    spotlight: { close: 'Cerrar' }, admin: { adminNote: 'Autenticación de administrador', adminNoteDesc: 'Utiliza las credenciales de tu cuenta de administrador para iniciar sesión.' }, auth: { forgotPassword: '¿Olvidaste tu contraseña?' },
  },
};

// Canonical product labels only. Names, addresses, descriptions and messages
// written by users are preserved and never sent to a translation provider.
const labels = {
  pt: { SFR: 'Casa unifamiliar', SFH: 'Casa unifamiliar', FSBO: 'Venda pelo proprietário', Hot: 'Em alta', Trending: 'Em destaque', New: 'Novo', Exclusive: 'Exclusivo', Verified: 'Verificado', Spotlight: 'Destaque', Business: 'Empresarial', Professional: 'Profissional', Owner: 'Proprietário', 'Cash Buyer': 'Comprador à vista', Wholesaler: 'Intermediador', 'RE Investor': 'Investidor imobiliário', Lender: 'Financiador', Sell: 'Venda', Buy: 'Compra', Rent: 'Aluguel', Residential: 'Residencial', Commercial: 'Comercial', Land: 'Terreno', Multifamily: 'Multifamiliar', Condo: 'Condomínio', Townhouse: 'Casa geminada', 'Single Family': 'Casa unifamiliar', 'Single Family Home': 'Casa unifamiliar', 'General Contractor': 'Empreiteiro geral', 'Rehab Staff': 'Equipe de reforma' },
  es: { SFR: 'Casa unifamiliar', SFH: 'Casa unifamiliar', FSBO: 'Venta por el propietario', Hot: 'En auge', Trending: 'En tendencia', New: 'Nuevo', Exclusive: 'Exclusivo', Verified: 'Verificado', Spotlight: 'Destacado', Business: 'Empresarial', Professional: 'Profesional', Owner: 'Propietario', 'Cash Buyer': 'Comprador al contado', Wholesaler: 'Intermediario', 'RE Investor': 'Inversor inmobiliario', Lender: 'Prestamista', Sell: 'Venta', Buy: 'Compra', Rent: 'Alquiler', Residential: 'Residencial', Commercial: 'Comercial', Land: 'Terreno', Multifamily: 'Multifamiliar', Condo: 'Condominio', Townhouse: 'Casa adosada', 'Single Family': 'Casa unifamiliar', 'Single Family Home': 'Casa unifamiliar', 'General Contractor': 'Contratista general', 'Rehab Staff': 'Equipo de reformas' },
};
export function cardDisplayLabel(value, language = 'en') {
  const base = String(language).toLowerCase().split('-')[0];
  const activity = activityLabel(value, language);
  return activity !== String(value ?? "").trim() ? activity : labels[base]?.[String(value)] || value;
}
