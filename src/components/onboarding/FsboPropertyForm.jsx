import { SmartImage } from '../ui/SmartImage';

export function FsboPropertyForm({
  t,
  C,
  values,
  onChange,
  formatCurrencyInput,
  formatRateInput,
  renderMarketsSelector,
  togglePortfolioMarket,
  handlePortfolioImages,
  handlePortfolioVideo,
  portfolioFieldLabelStyle,
  portfolioFieldInputStyle,
  portfolioFieldSelectStyle,
  portfolioTextareaLabelStyle,
  portfolioFieldTextareaStyle,
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1.2fr) minmax(170px, 1.35fr) minmax(84px, 0.75fr)', gap: 6, marginBottom: 8, width: '100%', minWidth: 0 }}>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelAddrShort}</span>
          <input value={values.portfolioAddress} onChange={(e) => onChange('portfolioAddress', e.target.value)} placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 44 })} />
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelCityShort}</span>
          <input value={values.portfolioCity} onChange={(e) => onChange('portfolioCity', e.target.value)} placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 54 })} />
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>States</span>
          {renderMarketsSelector(values.portfolioMarkets, togglePortfolioMarket, { showSummary: false })}
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelZipShort}</span>
          <input value={values.portfolioZip} onChange={(e) => onChange('portfolioZip', e.target.value)} inputMode="numeric" maxLength={5} placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 36 })} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1.2fr) minmax(110px, 1.2fr) minmax(68px, 0.7fr) minmax(68px, 0.7fr)', gap: 6, marginBottom: 8, width: '100%', minWidth: 0 }}>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelUsdPriceShort}</span>
          <input value={values.portfolioPrice} onChange={(e) => onChange('portfolioPrice', formatCurrencyInput(e.target.value))} inputMode="decimal" placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 72 })} />
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelUsdRehabShort}</span>
          <input value={values.portfolioRehab} onChange={(e) => onChange('portfolioRehab', formatCurrencyInput(e.target.value))} inputMode="decimal" placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 80 })} />
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelBedsShort}</span>
          <input value={values.portfolioBeds} onChange={(e) => onChange('portfolioBeds', e.target.value)} inputMode="numeric" maxLength={2} placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 28 })} />
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelBathsShort}</span>
          <input value={values.portfolioBaths} onChange={(e) => onChange('portfolioBaths', e.target.value)} inputMode="numeric" maxLength={2} placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 28 })} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 0.9fr) minmax(110px, 1.1fr) minmax(90px, 1fr)', gap: 6, marginBottom: 8, width: '100%', minWidth: 0 }}>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelSqftShort}</span>
          <input value={values.portfolioSqft} onChange={(e) => onChange('portfolioSqft', e.target.value)} inputMode="numeric" maxLength={7} placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 36 })} />
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelLotShort}</span>
          <input value={values.portfolioLot} onChange={(e) => onChange('portfolioLot', e.target.value)} placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 34 })} />
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioFieldLabelStyle}>{t.labelCapShort}</span>
          <input value={values.portfolioCapRate} onChange={(e) => onChange('portfolioCapRate', formatRateInput(e.target.value))} inputMode="decimal" maxLength={5} placeholder="" style={portfolioFieldInputStyle({ paddingLeft: 46 })} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(118px, 1.1fr) minmax(0, 3fr)', gap: 6, marginBottom: 8, width: '100%', minWidth: 0 }}>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelTypeShort}</span>
              <select value={values.portfolioType} onChange={(e) => onChange('portfolioType', e.target.value)} style={portfolioFieldSelectStyle()}>
                <option value="" >Select</option><option value="SFR">SFR</option><option value="Commercial">{t.optionTypeCommercial}</option><option value="Multifamily">{t.optionTypeMultifamily}</option><option value="Land">{t.optionTypeLand}</option>
              </select>
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.labelGoalShort}</span>
              <select value={values.portfolioObjective} onChange={(e) => onChange('portfolioObjective', e.target.value)} style={portfolioFieldSelectStyle()}>
                <option value="" >Select</option>
                <option value="Sell">{t.optionGoalSell}</option>
                <option value="Rent">{t.optionGoalRent}</option>
                <option value="Partner">{t.optionGoalPartner}</option>
                <option value="Seller Financing">Seller Financing</option>
                <option value="BRRRR">BRRRR</option>
                <option value="SUB-TO">SUB-TO</option>
                <option value="New Construction">New Construction</option>
                <option value="Develop">Develop</option>
                <option value="Commercial Point">Commercial Point</option>
              </select>
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <span style={portfolioFieldLabelStyle}>{t.prefixPrimary || 'Primary'}</span>
              <select name="primaryProfileScope" aria-label="Perfil principal" value={values.primaryProfileScope} onChange={(e) => onChange('primaryProfileScope', e.target.value)} style={portfolioFieldSelectStyle()}>
                <option value="">{t.optionSelectPlaceholder || 'Select'}</option>
                <option value="personal">Personal</option>
                <option value="professional">Business</option>
                <option value="fsbo">FSBO</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={portfolioTextareaLabelStyle}>{t.labelDescShort || 'Description'}</span>
          <textarea value={values.portfolioDescription} onChange={(e) => onChange('portfolioDescription', e.target.value)} placeholder="" style={portfolioFieldTextareaStyle()} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 6, marginBottom: 8, alignItems: 'start' }}>
        <label style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: 'auto', gap: 6 }}>
          <span style={{ fontSize: 10, color: C.t3, fontWeight: 700 }}>{t.labelImagesUpTo10}</span>
          <input type="file" accept="image/*" multiple onChange={handlePortfolioImages} style={{ display: 'block', marginTop: 4, fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: 'auto', gap: 6 }}>
          <span style={{ fontSize: 10, color: C.t3, fontWeight: 700 }}>{t.labelVideoUpTo60}</span>
          <input type="file" accept="video/*" onChange={handlePortfolioVideo} style={{ display: 'block', marginTop: 4, fontSize: 11 }} />
        </label>
        {values.portfolioImages.length > 0 && (
          <div style={{ gridColumn: '1 / -1', marginTop: 8, display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {values.portfolioImages.map((src, idx) => (
              <div key={`preview-fsbo-${idx}`} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: C.alpha(C.t1, 0.02), border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 72, flex: '0 0 120px' }}>
                <SmartImage src={src} alt={`img-${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', right: 6, top: 6, display: 'flex', gap: 6 }}>
                  <button onClick={() => {
                    if (idx <= 0) return;
                    onChange('portfolioImages', values.portfolioImages.map((_, i, arr) => {
                      if (i === idx - 1) return arr[idx];
                      if (i === idx) return arr[idx - 1];
                      return arr[i];
                    }));
                  }} title={t.moveUp} style={{ background: 'rgba(0,0,0,0.35)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: idx <= 0 ? 'default' : 'pointer' }}>‹</button>
                  <button onClick={() => {
                    if (idx >= values.portfolioImages.length - 1) return;
                    onChange('portfolioImages', values.portfolioImages.map((_, i, arr) => {
                      if (i === idx + 1) return arr[idx];
                      if (i === idx) return arr[idx + 1];
                      return arr[i];
                    }));
                  }} title={t.moveDown} style={{ background: 'rgba(0,0,0,0.35)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: idx >= values.portfolioImages.length - 1 ? 'default' : 'pointer' }}>›</button>
                  <button onClick={() => onChange('portfolioImages', values.portfolioImages.filter((_, i) => i !== idx))} title={t.actionRemove} style={{ background: 'rgba(0,0,0,0.35)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {values.portfolioMsg ? <div style={{ gridColumn: '1 / -1', fontSize: 10, color: C.danger }}>{values.portfolioMsg}</div> : null}
      </div>
    </>
  );
}
