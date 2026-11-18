// @vitest-environment node
import {describe,expect,it,vi} from 'vitest';
import {resolveSenderProfile,readSenderProfile,requireGmailProfile} from './senderProfile';
describe('saved active-profile sender identity',()=>{
  const payload={resolved:{personal:{email:'Personal@gmail.com'},professional:{email:'business@gmail.com'},fsbo:{email:'owner@gmail.com'}}};
  it.each(['personal','professional','fsbo'] as const)('reads only the selected %s identity',scope=>{
    expect(resolveSenderProfile(payload,scope)).toEqual({scope,email:payload.resolved[scope].email.toLowerCase()});
  });
  it('does not borrow another profile or login email when the selected email is cleared',()=>{
    expect(resolveSenderProfile({...payload,loginEmail:'login@gmail.com',resolved:{...payload.resolved,personal:{email:''}},profiles:{personal:{email:'old@gmail.com'}}},'personal').email).toBe('');
    expect(resolveSenderProfile({loginEmail:'login@gmail.com'},'professional').email).toBe('');
  });
  it('accepts a Gmail profile with a different authentication email',()=>{
    expect(requireGmailProfile({id:'actor',email:'login@hotmail.com',senderProfile:{scope:'professional',email:'business@gmail.com'}}).email).toBe('business@gmail.com');
  });
  it('fails closed for a missing or non-Gmail profile',()=>{
    expect(()=>requireGmailProfile({id:'actor',email:'login@gmail.com'})).toThrow('PROFILE_EMAIL_REQUIRED');
    expect(()=>requireGmailProfile({id:'actor',senderProfile:{scope:'personal',email:'profile@hotmail.com'}})).toThrow('GMAIL_PROFILE_REQUIRED');
  });
  it('reads the authenticated owner row only and rejects arbitrary scopes before querying',async()=>{
    const chain={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data:{profile_payload:payload}}))};chain.select.mockReturnValue(chain);chain.eq.mockReturnValue(chain);
    const client={from:vi.fn(()=>chain)};
    expect((await readSenderProfile(client,'actor','professional')).email).toBe('business@gmail.com');
    expect(chain.eq).toHaveBeenCalledWith('user_id','actor');
    client.from.mockClear();await expect(readSenderProfile(client,'actor','another-user')).rejects.toThrow('INVALID_SENDER_PROFILE');expect(client.from).not.toHaveBeenCalled();
  });
});
