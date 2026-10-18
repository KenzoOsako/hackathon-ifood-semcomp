import { expect, it } from 'vitest';
import { agregarSinais, limparSinais, registrarSinal } from './sinais';
it('não publica nome fornecido no campo ocasião',()=>{
 limparSinais();
 registrarSinal({tipo:'plano',ocasiao:'aniversário de Maria Silva',categorias:['pizza'],naoAtendidas:[]});
 expect(JSON.stringify(agregarSinais())).not.toContain('maria silva');
});
it('normaliza também dados passados diretamente ao agregador',()=>{
 const dados=agregarSinais([{tipo:'busca',vertical:'RESTAURANT',categoria:'pizza de Maria Silva',restricoes:['restrição de João'],resultados:0}]);
 expect(JSON.stringify(dados)).not.toMatch(/maria|joão/i);
});
