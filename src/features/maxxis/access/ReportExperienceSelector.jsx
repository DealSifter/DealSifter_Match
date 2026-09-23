import React, { useMemo, useState } from 'react';
import brandLogoAsset from '../../../assets/logo.png';
import maxxisAnalysisAsset from '../../../assets/maxxis/avatar/avatar-idle.png';
import maxxisIntelligenceAsset from '../../../assets/maxxis/avatar/avatar-success.png';
import propertyReleasePage1 from '../../../assets/maxxis/report-previews/Basic Release.png';
import maxxisAnalysisPage1 from '../../../assets/maxxis/report-previews/Maxxis Analisys (1).png';
import maxxisAnalysisPage2 from '../../../assets/maxxis/report-previews/Maxxis Analisys (2).png';
import maxxisAnalysisPage3 from '../../../assets/maxxis/report-previews/Maxxis Analisys (3).png';
import dealIntelligencePage1 from '../../../assets/maxxis/report-previews/Deal Inteligence(1).png';
import dealIntelligencePage2 from '../../../assets/maxxis/report-previews/Deal Inteligence(2).png';
import dealIntelligencePage3 from '../../../assets/maxxis/report-previews/Deal Inteligence(3).png';
import dealIntelligencePage4 from '../../../assets/maxxis/report-previews/Deal Inteligence(4).png';
import dealIntelligencePage5 from '../../../assets/maxxis/report-previews/Deal Inteligence(5).png';
import dealIntelligencePage6 from '../../../assets/maxxis/report-previews/Deal Inteligence(6).png';
import { resolveIntelligenceReportAccess } from '../../../domain/intelligenceAccess';
import './ReportExperienceSelector.css';

const COPY={en:{title:'Export property report',intro:'Choose the report type and see what is included in each option.',download:'PROPERTY RELEASE',downloadSub:'Download to device (PDF)',email:'PROPERTY RELEASE',emailSub:'Send by email (PDF)',maxxis:'MAXXIS ANALYSIS REPORT',maxxisSub:'AI-powered property analysis',hint:"See what's included in each report type. Tap the information icon to preview an example.",choose:'Maxxis intelligence selection',back:'Back',included:'Included',unlock:'Nuggets',analysis:'MAXXIS ANALYSIS REPORT',analysisSub:'Profile alignment, risks, limitations and next steps.',deal:'MAXXIS DEAL INTELLIGENCE REPORT',dealSub:'Evidence, existing comps, valuation, scenarios and confidence.',page:'Page'},pt:{title:'Exportar relatório do imóvel',intro:'Escolha o tipo de relatório e veja o que está incluído em cada opção.',download:'PROPERTY RELEASE',downloadSub:'Baixar no dispositivo (PDF)',email:'PROPERTY RELEASE',emailSub:'Enviar por email (PDF)',maxxis:'MAXXIS ANALYSIS REPORT',maxxisSub:'Análise do imóvel com inteligência artificial',hint:'Veja o que está incluído em cada relatório. Toque no ícone de informação para visualizar um exemplo.',choose:'Seleção de inteligência Maxxis',back:'Voltar',included:'Incluído',unlock:'Nuggets',analysis:'MAXXIS ANALYSIS REPORT',analysisSub:'Aderência ao perfil, riscos, limitações e próximos passos.',deal:'MAXXIS DEAL INTELLIGENCE REPORT',dealSub:'Evidências, comps existentes, valuation, cenários e confiança.',page:'Página'},es:{title:'Exportar informe de propiedad',intro:'Elige el tipo de informe y consulta qué incluye cada opción.',download:'PROPERTY RELEASE',downloadSub:'Descargar al dispositivo (PDF)',email:'PROPERTY RELEASE',emailSub:'Enviar por email (PDF)',maxxis:'MAXXIS ANALYSIS REPORT',maxxisSub:'Análisis de propiedad con inteligencia artificial',hint:'Consulta qué incluye cada informe. Toca el icono de información para ver un ejemplo.',choose:'Selección de inteligencia Maxxis',back:'Volver',included:'Incluido',unlock:'Nuggets',analysis:'MAXXIS ANALYSIS REPORT',analysisSub:'Afinidad, riesgos, limitaciones y próximos pasos.',deal:'MAXXIS DEAL INTELLIGENCE REPORT',dealSub:'Evidencia, comparables existentes, valoración, escenarios y confianza.',page:'Página'}};
const PREVIEW_PAGES=Object.freeze({
  PROPERTY_RELEASE:Object.freeze([propertyReleasePage1]),
  MAXXIS_ANALYSIS:Object.freeze([maxxisAnalysisPage1,maxxisAnalysisPage2,maxxisAnalysisPage3]),
  DEAL_INTELLIGENCE:Object.freeze([dealIntelligencePage1,dealIntelligencePage2,dealIntelligencePage3,dealIntelligencePage4,dealIntelligencePage5,dealIntelligencePage6]),
});

function SelectorActions({showBack=false,onBack,onCancel,onContinue,continueDisabled=false,isPreparing=false,backLabel='Back',cancelLabel='Cancel',continueLabel='Continue',preparingLabel='Preparing...'}){
  if(!showBack&&!onCancel&&!onContinue)return null;
  return <div className="report-selector-actions">
    {showBack?<button type="button" className="report-selector-button is-secondary" onClick={onBack}>← {backLabel}</button>:null}
    <div>
      {onCancel?<button type="button" className="report-selector-button is-secondary" onClick={onCancel}>{cancelLabel}</button>:null}
      {onContinue?<button type="button" className="report-selector-button is-primary" onClick={onContinue} disabled={continueDisabled||isPreparing}>{isPreparing?preparingLabel:continueLabel}</button>:null}
    </div>
  </div>;
}

function Preview({type,t,onClose,actions}){
  const[page,setPage]=useState(0);
  const[touchStart,setTouchStart]=useState(null);
  const pages=PREVIEW_PAGES[type]||PREVIEW_PAGES.PROPERTY_RELEASE;
  const count=pages.length;
  const move=d=>setPage(v=>(v+d+count)%count);
  const onKeyDown=event=>{
    if(event.key==='ArrowLeft')move(-1);
    if(event.key==='ArrowRight')move(1);
    if(event.key==='Escape')onClose();
  };
  const onTouchEnd=event=>{
    if(touchStart===null)return;
    const distance=event.changedTouches[0].clientX-touchStart;
    setTouchStart(null);
    if(Math.abs(distance)>=45)move(distance>0?-1:1);
  };
  return <div className="report-preview-overlay" role="dialog" aria-modal="true" aria-label={`${t.page} ${page+1}`} tabIndex={-1} onKeyDown={onKeyDown}>
    <SelectorActions showBack onBack={onClose} backLabel={t.back} {...actions}/>
    <div className={`report-preview-sheet is-${type.toLowerCase()}`} data-preview-page={page+1} onTouchStart={event=>setTouchStart(event.touches[0].clientX)} onTouchEnd={onTouchEnd}>
      <img key={pages[page]} src={pages[page]} alt={`${type.replaceAll('_',' ')} — ${t.page} ${page+1} / ${count}`} draggable="false" decoding="async"/>
      {count>1?<><button type="button" className="report-preview-arrow is-previous" aria-label="Previous page" onClick={()=>move(-1)}>‹</button><button type="button" className="report-preview-arrow is-next" aria-label="Next page" onClick={()=>move(1)}>›</button></>:null}
      <b className="report-preview-page-indicator">{t.page} {page+1} / {count}</b>
    </div>
  </div>;
}
function Row({icon,asset,title,subtitle,onAction,onInfo}){return <div className={`report-action-row${onInfo?' has-info':''}`}><button type="button" className="report-action-main" onClick={onAction}>{asset?<img src={asset} alt="" aria-hidden="true"/>:<span className="report-action-icon" aria-hidden="true">{icon}</span>}<span><strong>{title}</strong><small>{subtitle}</small></span><b aria-hidden="true">›</b></button>{onInfo?<button type="button" className="report-info-button" aria-label={`Preview ${title}`} onClick={onInfo}>i</button>:null}</div>}
export function ReportExperienceSelector({plan='free',entitlements=[],language='en',onSelect=null,onBasicDownload=null,onBasicEmail=null,onCancel=null,onContinue=null,continueDisabled=false,isPreparing=false,cancelLabel='Cancel',continueLabel='Continue',preparingLabel='Preparing...'}){const t=COPY[String(language).slice(0,2)]||COPY.en;const[stage,setStage]=useState('delivery');const[preview,setPreview]=useState('');const intelligence=useMemo(()=>['MAXXIS_ANALYSIS','DEAL_INTELLIGENCE'].map(reportType=>resolveIntelligenceReportAccess({plan,entitlements,reportType})),[plan,entitlements]);const actions={onCancel,onContinue,continueDisabled,isPreparing,cancelLabel,continueLabel,preparingLabel};if(preview)return <section className="report-experience-selector"><Preview type={preview} t={t} onClose={()=>setPreview('')} actions={actions}/></section>;return <section className="report-experience-selector" data-testid="report-experience-selector" data-stage={stage}><header><div className="report-selector-heading"><strong>{stage==='delivery'?t.title:t.choose}</strong><SelectorActions showBack={stage!=='delivery'} onBack={()=>setStage('delivery')} backLabel={t.back} {...actions}/></div><span>{stage==='delivery'?t.intro:null}</span></header>{stage==='delivery'?<><div className="report-action-stack"><Row icon="▤" title={t.download} subtitle={t.downloadSub} onAction={onBasicDownload} onInfo={()=>setPreview('PROPERTY_RELEASE')}/><Row icon="✉" title={t.email} subtitle={t.emailSub} onAction={onBasicEmail} onInfo={()=>setPreview('PROPERTY_RELEASE')}/><Row asset={brandLogoAsset} title={t.maxxis} subtitle={t.maxxisSub} onAction={()=>setStage('intelligence')}/></div><p className="report-selector-hint">{t.hint}</p></>:<div className="report-action-stack is-intelligence">{intelligence.map((access,index)=><Row key={access.reportType} asset={index?maxxisIntelligenceAsset:maxxisAnalysisAsset} title={index?t.deal:t.analysis} subtitle={`${index?t.dealSub:t.analysisSub} · ${access.allowed?t.included:`${access.nuggetCost} ${t.unlock}`}`} onAction={()=>onSelect?.(access)} onInfo={()=>setPreview(access.reportType)}/>)}</div>}</section>}
