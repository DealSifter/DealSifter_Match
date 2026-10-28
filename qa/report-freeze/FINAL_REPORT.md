# P0 — report generation freeze

ATUALIZAÇÃO — captura automatizada local: veja [local-capture/LEIA-ME.md](local-capture/LEIA-ME.md). A ferramenta substitui a necessidade de executar manualmente F12/snippet descrita ao final deste diagnóstico. Inclui extensão opt-in e monitor externo de processos, sem deploy. Instalação da extensão autorizada pelo usuário, mas ainda depende dos cliques de instalação no Edge; não foi realizada automaticamente. A ocorrência autenticada e sua causa continuam pendentes de captura.

ROOT CAUSE: INCONCLUSIVA na sessão real. Não foi aplicado outro timeout, yield ou Worker por hipótese.

ESTADO PRESERVADO: HEAD `a9b6730a4fff53abf984296f8eb2d306660896e0`; produção informada `6cefdb1ac4b54b6b4734bbd401667043e226acf1`. A worktree isolada desse hotfix foi usada como referência. As alterações analíticas locais, inclusive as ainda não publicadas, não foram modificadas nesta rodada.

MAIN THREAD BOTTLENECK: no controle isolado, desenho da primeira página em `drawStrictReportPdf` / composição de referência, com 780,1 ms no L1 e 719,3 ms no L3. As amostras CPU concentram-se em funções minificadas de `pdf-vendor`; não foi atribuída uma função interna específica sem mapa de origem. A causa da ocorrência real continua sem atribuição. Caminho de “Preparando...” em `MatchesPortfolio.jsx`: `handleConfirmEmailExport` → `generateReleasePdf` → preparação autorizada → `prepareReportNarrativePresentation` (mídia/mapas/traduções em paralelo) → `renderMaxxisReportPdf` → download. O Maxxis usa o mesmo renderer, com cache.

VERIFICAÇÃO DO CÓDIGO: esse caminho não chama html2canvas/pdf-lib. As prévias fechadas já são lazy. Há `finally` para liberar loading nos handlers inspecionados, mas ele não executa enquanto a thread está bloqueada. Há caches/single-flight, porém novas identidades de schema podem não reutilizar o PDF. Imagens/mapas usam canvas e codificação síncrona; o timeout externo não interrompe isso. Object URLs do download são revogados após 15 s. O renderer não oferece AbortSignal/cancelamento efetivo; fechar um modal não deve ser apresentado como cancelamento da computação.

BEFORE / AFTER: abaixo está a referência medida, sem patch de geração. AFTER: não se aplica; não há melhoria declarada. Chromium headless 151.0.7922.34, profiling CPU ativo, mesma sessão de controle, fixtures sem fotos/mapas remotos. Não é o Edge autenticado nem uma medição da preparação completa do app. Importação dos módulos ocorreu antes da medição.

| Medida, ms | L1 | L3 |
| --- | ---: | ---: |
| Total do renderer, evento existente | 1.146,7 | 1.489,9 |
| Preparação/modelo | 75,2 | 26,1 |
| Importação jsPDF, já aquecida | 1,4 | 0,4 |
| Desenho das páginas | 791,8 | 1.192,0 |
| Montagem binária | 162,1 | 152,9 |
| Maior tarefa longa | 781 | 718 |
| Maior intervalo do heartbeat de 50 ms | 1.176,7 | 1.464,9 |

PDFs produzidos pelo controle: L1, uma página/110.362 bytes; L3, seis páginas/137.692 bytes. Um início de geração e um download por controle. Heap agregado amostrado: 11 → 11 MB em ambos, sem concluir ausência de vazamento. Asset publicado usado: `maxxisReportPdf-DAWToYgq.js`. O bootstrap React foi desativado somente na resposta HTTP do harness isolado, para não iniciar o app; o renderer não foi modificado.

LONG TASKS: L1: 4 tarefas ≥50 ms (74/116/781/165 ms); L3: 8 (118/718/101/99/87/89/94/153 ms). Nenhuma ≥1 s nesses controles. Houve separação em tarefas, mas ela não garantiu heartbeat de 50 ms. Esses dados não reproduzem nem explicam, por si sós, o diálogo do Edge.

UI RESPONSIVENESS: FAIL quanto à comprovação de eliminação da falha real; o relato do usuário continua válido. O controle isolado ainda apresentou intervalos >1 s no heartbeat. Não foi medido tempo de resposta a um clique na interface autenticada, nem foram montados cards/prévias do app nesse controle.

PDF VISUAL REGRESSION: 0 alterações de código/design do gerador nesta rodada. Não houve nova comparação visual autenticada.

CANCEL / ERROR RECOVERY: FAIL para cancelamento efetivo, inexistente no contrato atual. O controle de acesso negado retornou `DENIED` e liberou loading do harness via `finally`; isso NÃO valida o estado React do app. Os handlers reais têm `finally`, mas sua recuperação durante a ocorrência permanece não comprovada.

CHANGED FILES: somente `qa/report-freeze/FINAL_REPORT.md` como entrega; nenhum arquivo de aplicação alterado. Helpers temporários de verificação, se usados, ficam em `.cache`, fora da entrega.

TARGETED TESTS: uma geração L1 e uma L3 com download, acesso negado, tradução lenta e coletor. A preparação com tradução retida devolveu controle em 1.512,8 ms (limite já existente de 1.500 ms), sem long tasks observadas, maior heartbeat de 63,5 ms. Duas requisições de tradução para textos sintéticos distintos foram interceptadas; nenhuma foi enviada ao backend. Cancelamento real: não disponível/não testado como sucesso. O coletor excluiu um sentinel de conteúdo/ID e não registrou eventos após `stop()`; limpeza verificada. Nenhum login ou backend de autenticação foi simulado. Zero chamadas live a RentCast/GIS; recursos fora da allowlist foram bloqueados. Sem mudança de runtime, não se repete build/typecheck/suítes da rodada anterior. Não há arquivo de aplicação afetado para recompilar. O snippet foi executado no navegador durante os controles.

REAL AUTH SESSION: BLOCKED — não tenho acesso à sessão autenticada real nem ao processo Edge que apresentou a falha.

PRODUCTION DEPLOY: NO.

## Uma reprodução real controlada no Edge

1. Na sessão habitual, abra F12 → **Performance**. Desative **Screenshots** e **Memory**; mantenha CPU/rede sem throttling. Não faça logout nem forneça credenciais.
2. Antes de gerar, execute o snippet abaixo em **Sources → Snippets**. É opt-in, local, sem storage ou transmissão. Ele reaproveita os eventos técnicos existentes e observa long tasks, atraso de timer, memória agregada e contagens de recursos sem guardar URLs, conteúdo, IDs do imóvel, tokens ou payloads.
3. Inicie **uma** gravação Performance. Clique **uma vez** para gerar o relatório que costuma travar. Não dispare outro relatório. Se surgir o diálogo, selecione **Aguardar** e pare a gravação no DevTools, se possível, antes de recarregar/encerrar a aba.
4. Ao terminar/travar, pare a gravação. No Console, use `copy(JSON.stringify(window.__dsFreeze.stop(), null, 2))`. Isso copia somente o resumo sanitizado; não envia nada. Se a thread não voltar, o resumo pode não estar acessível — a gravação Performance é a evidência prioritária.
5. Guarde a gravação bruta **localmente**. Ela pode conter URLs/metadados do navegador; não a envie sem revisão. Envie o resumo sanitizado e uma captura recortada de **Bottom-up/Call tree**, apenas com funções/tempos da tarefa longa. Não envie HAR, heap snapshot, tela do imóvel ou credenciais. Informe somente L1/L2/L3, etapa visível e se o download ocorreu.

O coletor desliga automaticamente após 60 s quando a thread permite. Isso **não cancela** nem corrige a geração. `stop()` remove listeners, observers e timers; recarregar também o remove. Não habilita telemetria permanente. Eventos de imagem/mapa/tradução não instrumentados no app serão distinguíveis apenas por recursos agregados e pela Call tree, não por uma etapa inventada.

```javascript
(() => {
  window.__dsFreeze?.stop?.();
  const begin = performance.now(), marks = [], tasks = [], resources = {};
  const allowed = new Set(['T0_user_click', 'pdf_generation_start',
    'pdf_assets_ready', 'pdf_assembly_complete', 'pdf_generation_complete',
    'pdf_blob_created', 'pdf_artifact_ready', 'pdf_download_dispatched',
    'final_ui_unlock', 'click', 'cancel_requested', 'generation_done', 'loading_released']);
  const errors = [], observers = [], numeric = ['durationMs', 'totalMs',
    'preparationMs', 'moduleMs', 'pageRenderMs', 'assemblyMs', 'pageCount', 'bytes'];
  let previous = begin, largestGapMs = 0, inputs = 0, result;
  const ms = n => Math.round(n * 10) / 10;
  const heap = () => Number.isFinite(performance.memory?.usedJSHeapSize)
    ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  const heapBeforeMB = heap();
  function mark(stage, detail = {}) {
    if (result || !allowed.has(stage) || marks.length >= 300) return;
    const item = { stage, atMs: ms(performance.now() - begin) };
    for (const key of numeric) if (Number.isFinite(detail[key])) item[key] = ms(detail[key]);
    marks.push(item); performance.mark(`ds-freeze:${stage}`);
  }
  function entries(list) {
    for (const e of list) {
      if (e.startTime < begin) continue;
      if (e.entryType === 'longtask' && tasks.length < 500)
        tasks.push({ atMs: ms(e.startTime - begin), durationMs: ms(e.duration) });
      if (e.entryType === 'resource') {
        let kind = 'other';
        try {
          const u = new URL(e.name);
          kind = u.pathname.includes('presentation-translate') ? 'translation'
            : u.hostname === 'tile.openstreetmap.org' ? 'map_tiles'
            : e.initiatorType === 'img' ? 'images'
            : e.initiatorType === 'script' ? 'scripts'
            : /\/rest\/v1\/|\/functions\/v1\//.test(u.pathname) ? 'backend' : 'other';
        } catch {}
        const bucket = resources[kind] ||= { count: 0, totalMs: 0 };
        bucket.count++; bucket.totalMs = ms(bucket.totalMs + e.duration);
      }
    }
  }
  for (const type of ['longtask', 'resource']) try {
    const observer = new PerformanceObserver(list => entries(list.getEntries()));
    observer.observe({ type, buffered: false }); observers.push(observer);
  } catch {}
  const onStage = e => mark(e.detail?.stage, e.detail || {});
  const onInput = () => { inputs++; if (inputs === 1) mark('click'); };
  const onError = e => {
    if (errors.length >= 20) return;
    const name = e.error?.name || e.reason?.name;
    errors.push({ atMs: ms(performance.now() - begin), type:
      ['Error','TypeError','RangeError','AbortError','NetworkError'].includes(name) ? name : 'TechnicalError' });
  };
  addEventListener('dealsifter:maxxis-performance', onStage);
  addEventListener('pointerdown', onInput, true);
  addEventListener('error', onError); addEventListener('unhandledrejection', onError);
  const timer = setInterval(() => {
    const now = performance.now(); largestGapMs = Math.max(largestGapMs, now - previous);
    previous = now;
  }, 50);
  function stop() {
    if (result) return result;
    clearInterval(timer); clearTimeout(deadline);
    for (const observer of observers) { entries(observer.takeRecords()); observer.disconnect(); }
    removeEventListener('dealsifter:maxxis-performance', onStage);
    removeEventListener('pointerdown', onInput, true);
    removeEventListener('error', onError); removeEventListener('unhandledrejection', onError);
    largestGapMs = Math.max(largestGapMs, performance.now() - previous);
    result = { diagnostic: 'report-freeze-opt-in', elapsedMs: ms(performance.now() - begin),
      marks, longTasks: tasks, largestTimerGapMs: ms(largestGapMs), inputs,
      heapBeforeMB, heapAfterMB: heap(), resources, errors };
    return result;
  }
  const deadline = setTimeout(stop, 60000);
  window.__dsFreeze = { mark, stop };
  console.info('Diagnóstico local ativo por até 60 s; nenhuma transmissão.');
})();
```

Limite de interpretação: contagens de recursos podem indicar repetição, mas não provam requisição duplicada do mesmo objeto, pois URLs não são retidas. O atraso de timer é um indicador, não o tempo de reação de um clique autenticado. A gravação real deve atribuir a tarefa longa antes de escolher entre eliminar duplicação, dividir a etapa ou usar Worker.
