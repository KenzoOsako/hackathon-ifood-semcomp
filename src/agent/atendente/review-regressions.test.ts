import { it, expect } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { executarAtendente } from '.';
import { novaSessao } from '../sessao';
import { FakeDomain } from '../domain-fake';
function setup() {
  const s = novaSessao(`review-${Math.random()}`);
  const domain = new FakeDomain();
  let step = 0;
  const modelo = { bindTools: () => ({ invoke: async () => step++ === 0 ? new AIMessage({ content:'', tool_calls:[{ id:'1', name:'mostrar_plano', args:{itens:[{categoria:'pizza',vertical:'RESTAURANT'}]},type:'tool_call'}] }) : new AIMessage('Montei.') }) } as unknown as BaseChatModel;
  return {s, deps:{domain,modelo,nomeModelo:'roteiro'}};
}
it('review: negativa explícita não deve aprovar',async()=>{
  const {s,deps}=setup();
  await executarAtendente(s,{texto:'quero pizza',origem:'texto'},deps);
  const r=await executarAtendente(s,{texto:'não aprovo o plano',origem:'texto'},deps);
  expect(r.aprovacao).toBeUndefined();
});
it('review: baixa confiança da voz não deve aprovar',async()=>{
  const {s,deps}=setup();
  await executarAtendente(s,{texto:'quero pizza',origem:'texto'},deps);
  const r=await executarAtendente(s,{texto:'aprovo o plano',origem:'voz',sinais:{origem:'voz',interrompeu:false,confianca:0.1}},deps);
  expect(r.aprovacao).toBeUndefined();
});
it('review: restrição rígida da sessão deve chegar ao domínio',async()=>{
  const {s,deps}=setup(); s.restricoes=['lactose'];
  const orig=deps.domain.buscarNecessidade.bind(deps.domain);
  const received:string[][]=[];
  deps.domain.buscarNecessidade=async(n,o)=>{received.push(n.restricoes);return orig(n,o)};
  await executarAtendente(s,{texto:'pizza sem lactose',origem:'texto'},deps);
  expect(received.length).toBeGreaterThan(0);
  expect(received.every(r=>r.includes('lactose'))).toBe(true);
});
