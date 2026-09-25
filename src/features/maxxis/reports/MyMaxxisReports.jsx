import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import maxxisAnalysisAsset from '../../../assets/maxxis/avatar/avatar-idle.png';
import maxxisDealAsset from '../../../assets/maxxis/avatar/avatar-success.png';
import './MyMaxxisReports.css';

const COPY={en:{title:'MY MAXXIS REPORTS',all:'All',analysis:'Maxxis Analysis',deal:'Deal Intelligence',search:'Search by address',empty:'No saved reports.',view:'View',pdf:'PDF',email:'Email',remove:'Delete from history',confirm:'Remove this saved report from history? Your acquired access will remain available.',back:'Back',property:'Property',included:'Included in subscription',unlock:'Nuggets'},pt:{title:'MEUS RELATÓRIOS MAXXIS',all:'Todos',analysis:'Análise Maxxis',deal:'Inteligência do Negócio',search:'Buscar por endereço',empty:'Nenhum relatório salvo.',view:'Ver',pdf:'PDF',email:'Email',remove:'Excluir do histórico',confirm:'Remover este relatório salvo do histórico? Seu acesso adquirido continuará disponível.',back:'Voltar',property:'Imóvel',included:'Incluído na assinatura',unlock:'Nuggets'},es:{title:'MIS INFORMES MAXXIS',all:'Todos',analysis:'Análisis Maxxis',deal:'Inteligencia del Negocio',search:'Buscar por dirección',empty:'No hay informes guardados.',view:'Ver',pdf:'PDF',email:'Email',remove:'Eliminar del historial',confirm:'¿Eliminar este informe guardado del historial? El acceso adquirido seguirá disponible.',back:'Volver',property:'Propiedad',included:'Incluido en la suscripción',unlock:'Nuggets'}};
const addressOf=r=>{
  const property=r?.reportPayload?.data?.maxxisReport?.sections?.propertySummary?.data;
  if(property?.address||property?.title)return property.address||property.title;
  if(property?.city&&property?.state&&property?.zip)return `${property.city}, ${property.state} ${property.zip}`;
  return r?.reportPayload?.data?.property?.address||r?.reportPayload?.address||'';
};

export function MyMaxxisReports({reports=[],language='en',onView,onPdf,onEmail,onDelete,onClose}){
  const t=COPY[String(language).slice(0,2)]||COPY.en;
  const[filter,setFilter]=useState('ALL');const[query,setQuery]=useState('');const[busyAction,setBusyAction]=useState('');
  const list=useMemo(()=>reports.filter(r=>(filter==='ALL'||r.capability===filter)&&addressOf(r).toLowerCase().includes(query.toLowerCase())),[reports,filter,query]);
  const run=async(action,report,handler)=>{const key=`${action}:${report.id}`;if(busyAction)return;setBusyAction(key);try{await handler?.(report);}finally{setBusyAction('');}};
  const locale=language==='pt'?'pt-BR':language==='es'?'es-ES':'en-US';
  return <section className="my-maxxis-reports" role="dialog" aria-label={t.title}><header><strong>{t.title}</strong><button type="button" onClick={onClose}>← {t.back}</button></header><div className="my-maxxis-report-filters">{[['ALL',t.all],['MAXXIS_ANALYSIS',t.analysis],['DEAL_INTELLIGENCE',t.deal]].map(([id,label])=><button type="button" className={filter===id?'is-active':''} onClick={()=>setFilter(id)} key={id}>{label}</button>)}</div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/><div className="my-maxxis-report-list">{list.length?list.map(r=><article key={r.id}><img src={r.capability==='DEAL_INTELLIGENCE'?maxxisDealAsset:maxxisAnalysisAsset} alt=""/><div><strong>{r.capability==='DEAL_INTELLIGENCE'?t.deal:t.analysis}</strong><span>{addressOf(r)||t.property}</span><small>{new Date(r.createdAt).toLocaleDateString(locale)} · {r.accessSource==='ONE_TIME_UNLOCK'?`${r.capability==='MAXXIS_ANALYSIS'?3:5} ${t.unlock}`:t.included}</small></div><div><button type="button" disabled={Boolean(busyAction)} onClick={()=>onView?.(r)}>{t.view}</button><button type="button" disabled={Boolean(busyAction)} onClick={()=>run('pdf',r,onPdf)} aria-busy={busyAction===`pdf:${r.id}`}>{t.pdf}</button><button type="button" disabled={Boolean(busyAction)} onClick={()=>run('email',r,onEmail)} aria-busy={busyAction===`email:${r.id}`}>{t.email}</button><button type="button" className="is-delete" disabled={Boolean(busyAction)} onClick={()=>{if(window.confirm(t.confirm))onDelete?.(r)}} aria-label={t.remove} title={t.remove}><Trash2 aria-hidden="true" size={14}/></button></div></article>):<p>{t.empty}</p>}</div></section>;
}
