import React,{useState} from 'react';
import {usePropertyFactReview} from './PropertyFactReviewContext';
import {publisherZoning} from './publisherZoning';
export function PublisherZoningConfirmation({propertyId,value,language='en'}){
 const review=usePropertyFactReview(),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 if(!value||!review?.ownedProperties.has(String(propertyId)))return null;
 const t=(pt,en,es)=>language.startsWith('pt')?pt:language.startsWith('es')?es:en;
 const saved=publisherZoning(review.facts[propertyId])===value;
 return <div className="publisher-zoning-confirmation">
  <small>{t('Compartilhado somente após sua confirmação como publicador; não é verificação oficial.','Shared only after your confirmation as publisher; not official verification.','Compartido solo tras tu confirmación como publicador; no es verificación oficial.')}</small>
  <button type="button" className="maxxis-smart-action-chip" disabled={busy||saved} onClick={async()=>{
   if(busy)return;setBusy(true);setError(false);try{await review.declareZoning(propertyId,value);}catch{setError(true);}finally{setBusy(false);}
  }}>{saved?t(`Zoneamento ${value} compartilhado`,`Zoning ${value} shared`,`Zonificación ${value} compartida`):t(`Compartilhar zoneamento ${value} no imóvel`,`Share zoning ${value} on the property`,`Compartir zonificación ${value} en el inmueble`)}</button>
  {error?<small role="alert">{t('Não foi possível compartilhar. Revise os dados atuais e tente novamente.','Could not share. Review current facts and retry.','No se pudo compartir. Revisa los datos actuales e intenta de nuevo.')}</small>:null}
 </div>;
}
