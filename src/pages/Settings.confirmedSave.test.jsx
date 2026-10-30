// @vitest-environment jsdom
import React,{useState} from 'react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Settings} from './Settings';
import {setLang} from '../i18n/translations';
const state=vi.hoisted(()=>({requests:[]}));
vi.mock('../lib/supabaseClient',()=>({isSupabaseConfigured:true,supabaseAnonKey:'test',getSupabaseFunctionUrl:()=>'',supabase:{
 from:table=>{let update=null;const query={select:()=>query,eq:()=>query,order:()=>query,limit:()=>Promise.resolve({data:[]}),update:payload=>{update=payload;return query;},maybeSingle:()=>update?new Promise(resolve=>state.requests.push({payload:update,resolve})):Promise.resolve({data:table==='users'?{full_name:'Existing name',phone:'123'}:null,error:null})};return query;},
 rpc:()=>Promise.resolve({data:[],error:null}),channel:()=>({on(){return this;},subscribe(){return this;},unsubscribe:()=>Promise.resolve()}),removeChannel:()=>Promise.resolve(),auth:{getSession:()=>Promise.resolve({data:{session:null}})}
}}));
function Harness(){const[systemAccount,setSystemAccount]=useState({fullName:'Existing name',phone:'123',email:'owner@example.test'});return <Settings systemAccount={systemAccount} setSystemAccount={setSystemAccount} supabaseUserId="owner" setPage={()=>{}} authSession={{emailVerified:true}}/>;}
const tick=async ms=>act(async()=>{await vi.advanceTimersByTimeAsync(ms);});
const status=()=>screen.getByTestId('settings-profile-save-status');
async function ready(){render(<Harness/>);await tick(0);await tick(600);expect(state.requests.length).toBeGreaterThan(0);await act(async()=>{state.requests.at(-1).resolve({data:{id:'owner'},error:null});});expect(status().textContent).toBe('Saved');}
beforeEach(()=>{state.requests=[];localStorage.clear();setLang('en');vi.useFakeTimers();});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('settings confirms saves with the server',()=>{
 it('keeps Saving past the old timer until the server confirms the update',async()=>{
   await ready();fireEvent.change(screen.getByDisplayValue('Existing name'),{target:{value:'Updated name'}});await tick(1000);expect(status().textContent).toBe('Saving...');
   expect(state.requests.at(-1).payload.settings_payload.systemAccount.fullName).toBe('Updated name');
   await act(async()=>{state.requests.at(-1).resolve({data:{id:'owner'},error:null});});expect(status().textContent).toBe('Saved');
 });
 it.each([{error:{message:'denied'},data:null},{error:null,data:null}])('shows failure without a confirmed row and supports retry: %o',async result=>{
   await ready();fireEvent.change(screen.getByDisplayValue('Existing name'),{target:{value:'New name'}});await tick(600);
   await act(async()=>{state.requests.at(-1).resolve(result);});expect(status().textContent).toContain('Could not confirm saving.');
   fireEvent.click(screen.getByRole('button',{name:'Try again',exact:true}));await tick(600);expect(status().textContent).toBe('Saving...');
   await act(async()=>{state.requests.at(-1).resolve({data:{id:'owner'},error:null});});expect(status().textContent).toBe('Saved');
 });
 it('does not mark a newer edit saved when an older request finishes',async()=>{
   await ready();fireEvent.change(screen.getByDisplayValue('Existing name'),{target:{value:'First edit'}});await tick(600);const older=state.requests.at(-1);
   fireEvent.change(screen.getByDisplayValue('First edit'),{target:{value:'Second edit'}});await tick(600);const newer=state.requests.at(-1);
   await act(async()=>{older.resolve({data:{id:'owner'},error:null});});expect(status().textContent).toBe('Saving...');
   await act(async()=>{newer.resolve({data:{id:'owner'},error:null});});expect(status().textContent).toBe('Saved');
 });
});
