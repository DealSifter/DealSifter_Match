import React from 'react';
import { Modal } from '../ui/Modal';
import { useLang } from '../../i18n/translations';
import './TrustStatementModal.css';

const statements = {
  en: {
    quote: 'He that is faithful in that which is least is faithful also in much:',
    reference: '— Luke 16:10 · King James Version',
    principles: 'May every opportunity, transaction and relationship conducted through DealSifter be guided by integrity, stewardship and respect for others.',
  },
  pt: {
    quote: 'Quem é fiel no mínimo também é fiel no muito;',
    reference: '— Lucas 16:10 · Almeida Revista e Corrigida',
    principles: 'Que cada oportunidade, transação e relacionamento conduzido por meio do DealSifter seja guiado pela integridade, pela responsabilidade na administração dos recursos e pelo respeito ao próximo.',
  },
  es: {
    quote: 'El que es fiel en lo muy poco, también en lo más es fiel:',
    reference: '— Lucas 16:10 · Reina-Valera 1909',
    principles: 'Que cada oportunidad, transacción y relación realizada a través de DealSifter esté guiada por la integridad, la administración responsable de los recursos y el respeto a los demás.',
  },
};

export function TrustStatementModal({ onClose }) {
  const selectedLanguage = String(useLang('global') || 'en').slice(0, 2);
  const language = Object.hasOwn(statements, selectedLanguage) ? selectedLanguage : 'en';
  const statement = statements[language];
  const [closing, setClosing] = React.useState(false);
  React.useEffect(() => {
    if (!closing) return undefined;
    const timer = window.setTimeout(onClose, 200);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  const requestClose = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) onClose();
    else setClosing(true);
  };

  return (
    <Modal onClose={requestClose} maxWidth={560} ariaLabel="IN GOD WE TRUST"
      contentClassName={`ds-trust-statement${closing ? ' ds-trust-statement-closing' : ''}`}
      contentStyle={{ animationDuration: '200ms' }}>
      <article lang={language}>
        <h2>IN GOD WE TRUST</h2>
        <blockquote>
          <p>“{statement.quote}”</p>
          <cite>{statement.reference}</cite>
        </blockquote>
        <p className="ds-trust-statement-principles"><em>{statement.principles}</em></p>
      </article>
    </Modal>
  );
}
