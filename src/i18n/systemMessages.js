import { translations } from './translations';

// System-owned notices only. Known templates retain names/counts verbatim.
// Rendering, rather than creation, selects the language so existing alerts
// adapt when the user changes language. Unknown/user-authored text is retained.
export const systemMessages = [
  ['Property information', 'Informações do imóvel', 'Información del inmueble'],
  ['Photos available in portfolio', 'Fotos disponíveis no portfólio', 'Fotos disponibles en el portafolio'],
  ['Location map', 'Mapa de localização', 'Mapa de ubicación'],
  ['Basic property details', 'Dados básicos do imóvel', 'Datos básicos del inmueble'],
  ['Everything in Property Release', 'Tudo do Property Release', 'Todo lo incluido en Property Release'],
  ['Executive Summary', 'Resumo executivo', 'Resumen ejecutivo'],
  ['Investor Profile Alignment', 'Compatibilidade com o perfil do investidor', 'Compatibilidad con el perfil del inversor'],
  ['Risk Analysis', 'Análise de riscos', 'Análisis de riesgos'],
  ['Limitations', 'Limitações', 'Limitaciones'],
  ['Recommended Next Steps', 'Próximos passos recomendados', 'Próximos pasos recomendados'],
  ['Everything in Maxxis Analysis', 'Tudo do Maxxis Analysis', 'Todo lo incluido en Maxxis Analysis'],
  ['Comparable Sales Analysis', 'Análise de vendas comparáveis', 'Análisis de ventas comparables'],
  ['Valuation Intelligence', 'Inteligência de avaliação', 'Inteligencia de valoración'],
  ['ARV Range', 'Faixa de ARV', 'Rango de ARV'],
  ['Investment Scenario KPIs', 'Indicadores dos cenários de investimento', 'Indicadores de los escenarios de inversión'],
  ['Evidence Review', 'Revisão de evidências', 'Revisión de evidencias'],
  ['Confidence Analysis', 'Análise de confiança', 'Análisis de confianza'],
  ['Comparable Analysis', 'Análise de comparáveis', 'Análisis de comparables'],
  ['ARV Intelligence', 'Inteligência de ARV', 'Inteligencia de ARV'],
  ['Investment Scenarios', 'Cenários de investimento', 'Escenarios de inversión'],
  ['Unlock Maxxis Analysis', 'Desbloquear Maxxis Analysis', 'Desbloquear Maxxis Analysis'],
  ['Unlock Deal Intelligence', 'Desbloquear Deal Intelligence', 'Desbloquear Deal Intelligence'],
  ['Unlock Advanced Intelligence', 'Desbloquear inteligência avançada', 'Desbloquear inteligencia avanzada'],
  ['Invalid login credentials', 'Email ou senha incorretos', 'Correo o contraseña incorrectos'],
  ['Email not confirmed', 'Email ainda não confirmado', 'Correo aún sin confirmar'],
  ['Failed to fetch', 'Não foi possível conectar. Tente novamente.', 'No se pudo conectar. Inténtalo de nuevo.'],
  ['Support reply', 'Resposta do suporte', 'Respuesta de soporte'],
  ['DealSifter Admin/Support replied to your ticket.', 'A equipe de suporte DealSifter respondeu à sua solicitação.', 'El equipo de soporte de DealSifter respondió a tu solicitud.'],
  ['Exclusive unlock', 'Desbloqueio com exclusividade', 'Desbloqueo con exclusividad'],
  ['New unlock', 'Novo desbloqueio', 'Nuevo desbloqueo'],
  ['Someone unlocked one of your property opportunities.', 'Alguém desbloqueou uma das suas oportunidades de imóvel.', 'Alguien desbloqueó una de tus oportunidades inmobiliarias.'],
  ['Someone unlocked one of your contact cards.', 'Alguém desbloqueou um dos seus cards de contato.', 'Alguien desbloqueó una de tus tarjetas de contacto.'],
  ['Chat message could not be sent.', 'Não foi possível enviar a mensagem do chat.', 'No se pudo enviar el mensaje del chat.'],
  ['Email confirmed', 'Email confirmado', 'Correo confirmado'],
  ['Your email {0} was confirmed. Sign in to continue.', 'Seu email {0} foi confirmado. Entre para continuar.', 'Tu correo {0} fue confirmado. Inicia sesión para continuar.'],
  ['Your email was confirmed. Sign in to continue.', 'Seu email foi confirmado. Entre para continuar.', 'Tu correo fue confirmado. Inicia sesión para continuar.'],
  ['Add to Home Screen', 'Adicionar à Tela', 'Añadir a la pantalla de inicio'],
  ['In Safari: Share > Add to Home Screen.', 'No Safari: Compartilhar > Adicionar à Tela de Início.', 'En Safari: Compartir > Añadir a la pantalla de inicio.'],
  ['Consent not saved', 'Consentimento não salvo', 'Consentimiento sin guardar'],
  ['Could not save your acceptance in the audit database. Please try again.', 'Não foi possível salvar seu aceite no registro de auditoria. Tente novamente.', 'No se pudo guardar tu aceptación en el registro de auditoría. Inténtalo de nuevo.'],
  ['Consent revoked', 'Consentimento revogado', 'Consentimiento revocado'],
  ['Your consent has been revoked. You will be redirected.', 'Seu consentimento foi revogado. Você será redirecionado.', 'Tu consentimiento fue revocado. Serás redirigido.'],
  ['Failed to revoke consent.', 'Falha ao revogar consentimento.', 'No se pudo revocar el consentimiento.'],
  ['Complete your first publication', 'Conclua sua primeira publicação', 'Completa tu primera publicación'],
  ['Create at least one profile and one linked property or service to unlock Feed, Map and Matches.', 'Crie pelo menos um perfil e um imóvel ou serviço vinculado para liberar Feed, Mapa e Matches.', 'Crea al menos un perfil y un inmueble o servicio vinculado para habilitar Feed, Mapa y Matches.'],
  ['Plan updated', 'Plano atualizado', 'Plan actualizado'],
  ['Your {0} privileges are active now.', 'Seus benefícios {0} já estão ativos.', 'Tus beneficios {0} ya están activos.'],
  ['Spotlight unavailable', 'Destaque indisponível', 'Destacado no disponible'],
  ['Could not load your active cards for spotlight.', 'Não foi possível carregar seus cards ativos para destaque.', 'No se pudieron cargar tus tarjetas activas para destacar.'],
  ['Email not verified', 'Email não verificado', 'Correo sin verificar'],
  ['Confirm your email for full platform access. Check your inbox.', 'Confirme seu email para garantir acesso completo à plataforma. Verifique sua caixa de entrada.', 'Confirma tu correo para acceder a toda la plataforma. Revisa tu bandeja de entrada.'],
  ['Profile updated elsewhere', 'Perfil atualizado em outra ação', 'Perfil actualizado en otra acción'],
  ['We reloaded the latest data to preserve changes. Review the form before saving again.', 'Recarregamos os dados mais recentes para evitar perder alterações. Revise o formulário antes de salvar novamente.', 'Cargamos los datos más recientes para conservar los cambios. Revisa el formulario antes de volver a guardar.'],
  ['This provider is no longer available.', 'Este prestador não está mais disponível.', 'Este proveedor ya no está disponible.'],
  ['Select a property', 'Selecione um imóvel', 'Selecciona un inmueble'],
  ['Open a property before generating the report.', 'Abra um imóvel antes de gerar o relatório.', 'Abre un inmueble antes de generar el informe.'],
  ['Open the property you want to analyze before unlocking the report.', 'Abra o imóvel que deseja analisar antes de desbloquear o relatório.', 'Abre el inmueble que deseas analizar antes de desbloquear el informe.'],
  ['Report already acquired', 'Relatório já adquirido', 'Informe ya adquirido'],
  ['Intelligence unlocked', 'Inteligência desbloqueada', 'Inteligencia desbloqueada'],
  ['This report was reopened without spending more Nuggets.', 'Este relatório foi reaberto sem novo consumo de Nuggets.', 'Este informe se abrió de nuevo sin gastar más Nuggets.'],
  ['Included in your plan. No Nuggets were charged.', 'Incluído no seu plano. Nenhum Nugget foi debitado.', 'Incluido en tu plan. No se descontaron Nuggets.'],
  ['{0} Nuggets charged once for this property.', '{0} Nuggets debitados uma única vez para este imóvel.', '{0} Nuggets descontados una sola vez para este inmueble.'],
  ['Not enough nuggets', 'Nuggets insuficientes', 'Nuggets insuficientes'],
  ['Unlock failed', 'Falha no desbloqueio', 'Error al desbloquear'],
  ['Maxxis Deal AI analysis PDF generated.', 'PDF da análise Maxxis Deal AI gerado.', 'PDF del análisis Maxxis Deal AI generado.'],
  ['Could not generate the Maxxis Deal AI analysis PDF.', 'Não foi possível gerar o PDF da análise Maxxis Deal AI.', 'No se pudo generar el PDF del análisis Maxxis Deal AI.'],
  ['Supabase not configured.', 'Supabase não configurado.', 'Supabase no está configurado.'],
  ['Failed to retrieve the session.', 'Falha ao obter sessão.', 'No se pudo obtener la sesión.'],
  ['Admin access is not authorized for this account.', 'Acesso admin não autorizado para esta conta.', 'El acceso de administrador no está autorizado para esta cuenta.'],
  ['Admin error', 'Erro admin', 'Error de administrador'],
  ['Admin authentication failed.', 'Falha na autenticação admin.', 'Error de autenticación de administrador.'],
  ['Sign in to delete your account.', 'Faça login para excluir sua conta.', 'Inicia sesión para eliminar tu cuenta.'],
  ['Account deleted', 'Conta excluída', 'Cuenta eliminada'],
  ['All your data has been removed.', 'Todos os seus dados foram removidos.', 'Todos tus datos fueron eliminados.'],
  ['Deletion error', 'Erro ao excluir', 'Error al eliminar'],
  ['Failed to delete account.', 'Falha ao excluir conta.', 'No se pudo eliminar la cuenta.'],
  ['Email sent', 'Email enviado', 'Correo enviado'],
  ['We sent a new confirmation email to your account. Return to registration and refresh your profile status afterward.', 'Enviamos um novo email de confirmação para sua conta. Depois, volte ao onboarding e atualize o status do perfil.', 'Enviamos un nuevo correo de confirmación a tu cuenta. Después, vuelve al registro y actualiza el estado del perfil.'],
  ['Own card, not selectionable', 'Você não pode selecionar seu próprio card', 'No puedes seleccionar tu propia tarjeta'],
  ['Exclusive contact locked', 'Contato com exclusividade ativa', 'Contacto con exclusividad activa'],
  ['This contact is under temporary exclusivity. You can favorite and check again when the timer ends.', 'Este contato está sob exclusividade temporária. Você pode favoritar e consultar novamente quando o prazo terminar.', 'Este contacto tiene exclusividad temporal. Puedes guardarlo como favorito y volver a consultar al terminar el plazo.'],
  ['Unlock unavailable', 'Desbloqueio indisponível', 'Desbloqueo no disponible'],
  ['Could not calculate a secure unlock price right now. Please try again.', 'Não foi possível calcular o custo seguro do desbloqueio agora. Tente novamente.', 'No se pudo calcular el coste seguro del desbloqueo. Inténtalo de nuevo.'],
  ['This property cannot be unlocked because it is not linked to a saved database record yet.', 'Este imóvel ainda não pode ser desbloqueado porque não está vinculado a um registro salvo.', 'Este inmueble aún no se puede desbloquear porque no está vinculado a un registro guardado.'],
  ['Sign in and wait for the app to sync before unlocking this property.', 'Entre e aguarde a sincronização do app antes de desbloquear este imóvel.', 'Inicia sesión y espera la sincronización antes de desbloquear este inmueble.'],
  ['Unlock price updated', 'Custo do desbloqueio atualizado', 'Coste del desbloqueo actualizado'],
  ['The current secure price is {0} nuggets. Please confirm again.', 'O custo seguro atual é de {0} nuggets. Confirme novamente.', 'El coste seguro actual es de {0} nuggets. Confirma de nuevo.'],
  ['This contact portfolio changed after the modal opened. Please open it again to confirm the updated cost.', 'O portfólio deste contato mudou após a abertura do modal. Abra novamente para confirmar o custo atualizado.', 'El portafolio de este contacto cambió después de abrir el modal. Ábrelo de nuevo para confirmar el coste actualizado.'],
  ['This property could not be unlocked right now. Please try again.', 'Não foi possível desbloquear este imóvel agora. Tente novamente.', 'No se pudo desbloquear este inmueble. Inténtalo de nuevo.'],
  ['Mock sandbox', 'Ambiente simulado', 'Entorno simulado'],
  ['Test unlock simulated locally for this mock card. No real nuggets, KPI, or Supabase history were changed.', 'Desbloqueio de teste simulado neste card fictício. Nenhum nugget real, indicador ou histórico do Supabase foi alterado.', 'Desbloqueo de prueba simulado para esta tarjeta ficticia. No se modificaron Nuggets reales, indicadores ni historial de Supabase.'],
  ['This contact could not be unlocked right now. Please try again.', 'Não foi possível desbloquear este contato agora. Tente novamente.', 'No se pudo desbloquear este contacto. Inténtalo de nuevo.'],
  ['Could not complete unlock. Your balance has been restored.', 'Não foi possível concluir o desbloqueio. Seu saldo foi restaurado.', 'No se pudo completar el desbloqueo. Tu saldo fue restaurado.'],
  ['You need {0} nugget(s) to unlock this contact. Go to Pricing to choose a plan upgrade or an extra Nugget pack.', 'Você precisa de {0} nugget(s) para desbloquear este contato. Vá para Pricing para escolher um upgrade de plano ou pacote extra de nuggets.', 'Necesitas {0} nugget(s) para desbloquear este contacto. Ve a Precios para elegir una mejora de plan o un paquete adicional de Nuggets.'],
  ['Supabase is required to activate paid spotlights.', 'O Supabase é necessário para ativar destaques pagos.', 'Supabase es necesario para activar destacados de pago.'],
  ['Spotlight activated', 'Destaque ativado', 'Destacado activado'],
  ['{0} card(s) will be featured for 30 days.', '{0} card(s) ficarão em destaque por 30 dias.', '{0} tarjeta(s) estarán destacadas durante 30 días.'],
  ['You need {0} nuggets to activate these spotlights.', 'Você precisa de {0} nuggets para ativar estes destaques.', 'Necesitas {0} nuggets para activar estos destacados.'],
  ['Spotlight failed', 'Falha ao ativar destaque', 'Error al activar destacado'],
  ['Could not activate spotlight right now.', 'Não foi possível ativar o destaque agora.', 'No se pudo activar el destacado.'],
  ['Complete onboarding', 'Conclua o cadastro', 'Completa el registro'],
  ['Complete and save at least one valid profile plus one linked property or service to unlock the remaining modules.', 'Preencha e salve pelo menos um perfil válido e um imóvel ou serviço vinculado para liberar os demais módulos.', 'Completa y guarda al menos un perfil válido y un inmueble o servicio vinculado para habilitar los demás módulos.'],
  ['Too many attempts. Try again in a few minutes.', 'Muitas tentativas. Tente novamente em alguns minutos.', 'Demasiados intentos. Inténtalo de nuevo en unos minutos.'],
  ['Account created', 'Conta criada', 'Cuenta creada'],
  ['Check your email to confirm access.', 'Confira seu email para confirmar o acesso.', 'Revisa tu correo para confirmar el acceso.'],
  ['Authentication error', 'Erro de autenticação', 'Error de autenticación'],
  ['Supabase authentication failed.', 'Falha na autenticação com Supabase.', 'Error de autenticación con Supabase.'],
  ['Supabase not configured', 'Supabase não configurado', 'Supabase no está configurado'],
  ['In Vercel, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and redeploy.', 'Na Vercel, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY e faça Redeploy.', 'En Vercel, añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY y vuelve a desplegar.'],
  ['Enter a valid email.', 'Informe um email válido.', 'Introduce un correo válido.'],
  ['Too many reset attempts. Please wait before trying again.', 'Muitas tentativas de redefinição. Aguarde antes de tentar novamente.', 'Demasiados intentos de restablecimiento. Espera antes de volver a intentarlo.'],
  ['Check your inbox to reset your password.', 'Confira sua caixa de entrada para redefinir a senha.', 'Revisa tu bandeja de entrada para restablecer la contraseña.'],
  ['Failed to send password reset email.', 'Falha ao enviar email de redefinição.', 'No se pudo enviar el correo de restablecimiento.'],
  ['Payment confirmed!', 'Pagamento confirmado!', '¡Pago confirmado!'],
  ['Your Nuggets will be credited shortly through the webhook.', 'Seus nuggets serão creditados em instantes via webhook.', 'Tus Nuggets se acreditarán en breve mediante el webhook.'],
  ['Purchase canceled', 'Compra cancelada', 'Compra cancelada'],
  ['The payment was canceled. Your Nuggets were not changed.', 'O pagamento foi cancelado. Seus nuggets não foram alterados.', 'El pago fue cancelado. Tus Nuggets no cambiaron.'],
  ['Checkout failed', 'Falha no checkout', 'Error en el pago'],
  ['Invalid selection', 'Seleção inválida', 'Selección inválida'],
  ['Choose a valid plan or pack to continue.', 'Escolha um plano ou pacote válido para continuar.', 'Elige un plan o paquete válido para continuar.'],
  ['Terms not saved', 'Termos não salvos', 'Términos sin guardar'],
  ['Your payment was confirmed by Stripe. Your balance or plan will be updated shortly.', 'Seu pagamento foi confirmado pelo Stripe. Atualizaremos seu saldo/plano em instantes.', 'Stripe confirmó tu pago. Actualizaremos tu saldo o plan en breve.'],
  ['Sync failed', 'Falha na sincronização', 'Error de sincronización'],
  ['Your local data is saved, but syncing with the server failed. We will retry.', 'Seus dados locais estão salvos, mas houve um erro ao sincronizar com o servidor. Tentaremos novamente.', 'Tus datos locales están guardados, pero falló la sincronización con el servidor. Lo intentaremos de nuevo.'],
];

const normalizeLiteral = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/…/g, '...').toLowerCase();
const normalize = text => normalizeLiteral(String(text).trim());
const noticeKeys = [
  ['cards','trendingOwnerNotificationTitle'], ['cards','trendingOwnerNotificationMessage'],
  ['cards','trendingFavoriteNotificationTitle'], ['cards','trendingFavoriteNotificationMessage'],
];
for (const [namespace, key] of noticeKeys) systemMessages.push(['en','pt','es'].map(language => translations[language][namespace][key]));
// Existing Settings feedback also remains translatable after creation.
for (const key of Object.keys(translations.en.settings).filter(key => /(?:Error|Success|Saved|Sent|Unavailable|NeedLogin|OtpInvalid)$/.test(key))) {
  const row = ['en','pt','es'].map(language => translations[language].settings[key]);
  if (row.every(value => typeof value === 'string')) systemMessages.push(row);
}
const exact = new Map();
const templates = [];
for (const row of systemMessages) for (const variant of row) {
  if (!/\{\w+\}/.test(variant)) {
    if (!exact.has(normalize(variant))) exact.set(normalize(variant), row);
  }
  else {
    const pattern = normalize(variant).split(/(\{\w+\})/).map(part => /^\{\w+\}$/.test(part) ? '(.+?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    templates.push({ pattern: new RegExp(`^${pattern}$`, 'i'), row, parts: variant.split(/\{\w+\}/), names: [...variant.matchAll(/\{(\w+)\}/g)].map(match => match[1]) });
  }
}
function normalizedOffsets(text) {
  const original = text.trim(), offsets = [];
  let normalized = '', cursor = 0;
  for (const character of original) {
    const folded = normalizeLiteral(character);
    for (let index = 0; index < folded.length; index++) offsets.push(cursor);
    normalized += folded; cursor += character.length;
  }
  offsets.push(original.length);
  return { original, normalized, offsets };
}
export function localizeSystemText(text, language = 'en') {
  if (typeof text !== 'string' || !text) return text;
  const index = { en: 0, pt: 1, es: 2 }[String(language).toLowerCase().split('-')[0]] ?? 0;
  const row = exact.get(normalize(text));
  if (row) return row[index];
  const { original, normalized, offsets } = normalizedOffsets(text);
  for (const { pattern, row: template, parts, names } of templates) {
    const match = pattern.exec(normalized);
    if (!match) continue;
    // Retrieve captures from the original text, preserving case/diacritics.
    let cursor = normalizeLiteral(parts[0]).length;
    const captures = {};
    for (let n = 0; n < names.length; n++) {
      const end = cursor + match[n + 1].length;
      captures[names[n]] = original.slice(offsets[cursor], offsets[end]);
      cursor = end + normalizeLiteral(parts[n + 1]).length;
    }
    return template[index].replace(/\{(\w+)\}/g, (placeholder, name) => captures[name] ?? placeholder);
  }
  return text;
}
