import { AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { expect, it } from 'vitest';
import { executarAtendente } from '.';
import { novaSessao } from '../sessao';
import { FakeDomain } from '../domain-fake';
function setup() {
 const s=novaSessao(`pr35-review-${Math.random()}`);
 const fila:AIMessage[]=[];
 const modelo={bindTools:()=>({invoke:async()=>fila.shift()??new AIMessage('Confira a tela.')})} as unknown as BaseChatModel;
 const deps={modelo,nomeModelo:'roteiro',domain:new FakeDomain()};
 const tool=(name:string,args:Record<string,unknown>)=>fila.push(new AIMessage({content:'',tool_calls:[{id:'t',name,args,type:'tool_call'}]}));
 return {s,tool,deps,fale:(texto:string)=>executarAtendente(s,{texto,origem:'texto'},deps)};
}
it('não aplica teto de preço à escolha',async()=>{
 const {s,tool,fale}=setup();
 tool('buscar_no_ifood',{categoria:'hamburguer',vertical:'RESTAURANT',ordenar:'melhor_avaliada'});
 await fale('quais hamburgueres tem?');
 tool('mostrar_plano',{itens:[{categoria:'hamburguer',vertical:'RESTAURANT',ref:'ze-classico',orcamento:{max:20,tipo:'teto'}}]});
 await fale('quero o clássico mas tenho teto de vinte reais');
 expect(s.plano).toBeDefined();
 expect(s.plano?.blocos[0]?.principal.precoCents).toBe(2490);
});
it('plano prevalece quando há busca depois de mostrar_plano no mesmo turno',async()=>{
 const {tool,fale}=setup();
 tool('mostrar_plano',{itens:[{categoria:'pizza',vertical:'RESTAURANT'}]});
 tool('buscar_no_ifood',{categoria:'pizza',vertical:'RESTAURANT'});
 const r=await fale('monte pizza e confira alternativas');
 expect(r.tela?.tipo).toBe('mostrar_plano');
});
it('não recupera opção antiga excluída por restrição alimentar',async()=>{
 const {s,tool,deps,fale}=setup();
 const buscar=deps.domain.buscarNecessidade.bind(deps.domain);
 deps.domain.buscarNecessidade=async(n,o)=>[...await buscar(n,o),...await buscar({...n,categoria:'smash'},o)];
 tool('buscar_no_ifood',{categoria:'hamburguer',vertical:'RESTAURANT',ordenar:'melhor_avaliada'});
 const busca=await fale('mostre hamburgueres');
 expect(busca.tela?.plano.opcoes?.[0].itens.some(o=>o.ref==='smash-duplo')).toBe(true);
 tool('mostrar_plano',{itens:[{categoria:'hamburguer',vertical:'RESTAURANT',ref:'smash-duplo'}]});
 await fale('quero o smash mas sem lactose');
 expect(s.restricoes).toContain('lactose');
 expect(s.plano?.blocos.some(b=>b.principal.ref==='smash-duplo')).not.toBe(true);
});
