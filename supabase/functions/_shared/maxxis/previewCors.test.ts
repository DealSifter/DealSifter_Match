import {afterEach,describe,expect,it,vi} from 'vitest';

afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
describe('authorized Preview origin without changing existing CORS configuration',()=>{
  it('adds only the configured Preview while preserving Production and denying unrelated deployments',async()=>{
    const values:Record<string,string>={MAXXIS_ALLOWED_ORIGINS:'https://production.example,https://app.example',APP_URL:'https://fallback.example',MAXXIS_PREVIEW_ALLOWED_ORIGINS:'https://review-only.example'};
    vi.stubGlobal('Deno',{env:{get:(name:string)=>values[name]}});
    const {corsHeaders}=await import('./config.ts');
    for(const origin of ['https://production.example','https://app.example','https://fallback.example','https://review-only.example'])expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBe(origin);
    expect(corsHeaders('https://unapproved-preview.example')['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeaders('https://review-only.example.evil.invalid')['Access-Control-Allow-Origin']).toBeUndefined();
  });
  it('keeps Preview access disabled when the new setting is absent',async()=>{
    vi.stubGlobal('Deno',{env:{get:(name:string)=>name==='MAXXIS_ALLOWED_ORIGINS'?'https://production.example':''}});
    const {corsHeaders}=await import('./config.ts');
    expect(corsHeaders('https://review-only.example')['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeaders('https://production.example')['Access-Control-Allow-Origin']).toBe('https://production.example');
  });
});
