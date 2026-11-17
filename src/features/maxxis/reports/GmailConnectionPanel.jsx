import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authorizeReportMailbox, disconnectReportMailbox, readReportMailbox } from '../../../services/reportMailboxService';

export function GmailConnectionPanel({ userId, language = 'en', onConnectionChange }) {
  const text = useCallback((en, pt, es = en) => language === 'pt' ? pt : language === 'es' ? es : en, [language]);
  const [connection, setConnection] = useState(null), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(false), lock = useRef(false), popup = useRef(null);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const value = await readReportMailbox(userId);
      if (alive.current) { setConnection(value); onConnectionChange?.(value); }
    } catch {
      if (alive.current) {
        setConnection(null); onConnectionChange?.(null);
        setError(text('Gmail connection is unavailable. Try checking again.', 'A conexão Gmail está indisponível. Tente conferir novamente.', 'La conexión Gmail no está disponible. Vuelva a comprobar.'));
      }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }, [userId, text, onConnectionChange]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => { alive.current = false; popup.current?.close(); };
  }, [refresh]);
  const act = async action => {
    if (lock.current || (action === 'connect' && !consent)) return;
    // Open synchronously from the explicit click; do not bypass popup restrictions.
    if (action === 'connect') {
      popup.current = window.open('about:blank', '_blank');
      if (!popup.current) {
        setError(text('Allow the authorization window, then try again.', 'Permita a janela de autorização e tente novamente.', 'Permita la ventana de autorización e inténtelo otra vez.'));
        return;
      }
      popup.current.opener = null;
    }
    lock.current = true; setBusy(true); setError('');
    try {
      if (action === 'connect') {
        const result = await authorizeReportMailbox(userId, true);
        if (!alive.current) { popup.current?.close(); return; }
        popup.current.location.href = result.authorizationUrl;
        // No optimistic CONNECTED state. The owner returns and checks server metadata.
      } else {
        const result = await disconnectReportMailbox(userId);
        if (alive.current) { setConnection(result); onConnectionChange?.(result); setConsent(false); }
      }
    } catch {
      if (action === 'connect') popup.current?.close();
      if (alive.current) setError(text('The mailbox action could not be completed. Check again before retrying.', 'Não foi possível concluir a ação da caixa. Confira novamente antes de repetir.', 'No se pudo completar la acción. Compruebe de nuevo antes de repetir.'));
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const connected = connection?.status === 'CONNECTED';
  return <div data-testid="gmail-connection" style={{ display: 'grid', gap: 8, fontSize: 12 }}>
    <strong>{text('Connect your Gmail', 'Conectar seu Gmail', 'Conectar su Gmail')}</strong>
    <span>{text('Connecting is separate from login and sends no message. Email requires a separate review and confirmation.', 'Conectar é separado do login e não envia mensagens. O email exige revisão e confirmação próprias.', 'Conectar es independiente del acceso y no envía mensajes. El email requiere revisión y confirmación propias.')}</span>
    {connected ? <span role="status">{text('Connected mailbox', 'Caixa conectada', 'Buzón conectado')}: {connection.mailbox_email}</span>
      : <span role="status">{busy ? text('Checking…', 'Conferindo…', 'Comprobando…') : connection ? text('Mailbox not connected or authorization expired.', 'Caixa não conectada ou autorização expirada.', 'Buzón no conectado o autorización vencida.') : text('Connection not confirmed.', 'Conexão não confirmada.', 'Conexión no confirmada.')}</span>}
    {!connected ? <label><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /> {text('I authorize connecting the Gmail matching my confirmed account email, with permission to send email.', 'Autorizo conectar o Gmail igual ao email confirmado da minha conta, com permissão para enviar email.', 'Autorizo conectar el Gmail de mi cuenta confirmada, con permiso para enviar email.')}</label> : null}
    <span>{text('After authorizing in Google, return here and check the connection. Reconnect when authorization expires.', 'Após autorizar no Google, volte aqui e confira a conexão. Reconecte quando a autorização expirar.', 'Después de autorizar en Google, vuelva y compruebe la conexión. Reconecte cuando venza.')}</span>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {!connected ? <button type="button" disabled={busy || !consent || !connection} onClick={() => act('connect')}>{text('Authorize Gmail', 'Autorizar Gmail', 'Autorizar Gmail')}</button> : null}
      <button type="button" disabled={busy} onClick={() => void refresh()}>{text('Check connection', 'Conferir conexão', 'Comprobar conexión')}</button>
      {connection && connection.status !== 'DISCONNECTED' ? <button type="button" disabled={busy} onClick={() => act('disconnect')}>{text('Disconnect', 'Desconectar', 'Desconectar')}</button> : null}
    </div>
    {connected ? <span>{text('Disconnect removes DealSifter access. You can also remove the grant in your Google Account permissions.', 'Desconectar remove o acesso pelo DealSifter. Você também pode revogar a autorização nas permissões da sua Conta Google.', 'Desconectar elimina el acceso de DealSifter. También puede revocar el permiso en su Cuenta Google.')}</span> : null}
    {error ? <span role="alert">{error}</span> : null}
  </div>;
}
