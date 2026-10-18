import { expect, it } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { executarAtendente } from '.';
import { novaSessao } from '../sessao';
import { FakeDomain } from '../domain-fake';
it.each(['Entrega grátis para sua surpresa', 'A mais bem avaliada para o aniversário', 'Sem lactose para seu jantar'])('porquê não publica atributo comercial ou de composição: %s',async porque=>{
 const fila=[new AIMessage({content:'',tool_calls:[{id:'t',type:'tool_call' as const,name:'mostrar_plano',args:{itens:[{categoria:'pizza',vertical:'RESTAURANT',porque}]}}]}),new AIMessage('Confira o plano.')];
 const modelo={bindTools:()=>({invoke:async()=>fila.shift()!})} as unknown as BaseChatModel;
 const r=await executarAtendente(novaSessao(`pr38-${Math.random()}`),{texto:'quero pizza',origem:'texto'},{modelo,nomeModelo:'roteiro',domain:new FakeDomain()});
 expect(r.tela?.plano.blocos[0].principal.freteCents).toBeGreaterThan(0);
 expect(r.tela?.plano.blocos[0].porque).toBeUndefined();
});
it.each([
 {categoria:'farinha',restricao:'gluten',ref:'bairro-farinha'},
 {categoria:'ovos',restricao:'ovo',ref:'bairro-ovos'},
 {categoria:'bolo',restricao:'lactose',ref:'bolos-chocolate'},
])('composição simulada exclui $ref com restrição $restricao',async({categoria,restricao,ref})=>{
 const vertical=categoria==='bolo'?'RESTAURANT':'GROCERIES';
 const opcoes=await new FakeDomain().buscarNecessidade({id:'n',categoria,vertical,restricoes:[restricao]},{});
 expect(opcoes.map(o=>o.ref)).not.toContain(ref);
});
it('leite integral novo não deve passar pelo filtro sem lactose do mock',async()=>{
 const opcoes=await new FakeDomain().buscarNecessidade({id:'n',categoria:'leite',vertical:'GROCERIES',restricoes:['lactose']},{});
 expect(opcoes.map(o=>o.ref)).not.toContain('bairro-leite');
});
