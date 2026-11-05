// Minha conta: nome e senha do usuário logado.
import { useState } from 'react';
import { I, atualizarSessao, avisar, chamar, seguro } from '../../lib/api.js';
import { useCarregar } from '../../lib/hooks.js';
import { PAPEIS, PAPEL_TEXTO } from '../../lib/rotulos.js';
import { Acoes, Botao, Cabeca, Carregando, FormModal, H2, Indicadores, Painel } from '../../components/ui.jsx';
import { FormSenha } from '../TrocaSenha.jsx';

export default function Conta() {
  const { dados: eu, carregando, recarregar } = useCarregar(() => chamar(I('/auth/me')), []);
  const [modal, setModal] = useState(false);
  return (
    <div>
      <Cabeca titulo="Minha conta" texto="Você altera aqui o seu nome e a sua senha. As demais contas são do superusuário." />
      {carregando && !eu ? <Carregando /> : eu && (
        <>
          <Indicadores itens={[['Login', eu.usuario], ['Nome', eu.nome || '-'], ['Papel', PAPEIS[eu.papel] || eu.papel]]} />
          <Acoes><Botao variante="sec" onClick={() => setModal(true)}>Alterar nome</Botao></Acoes>
          {modal && (
            <FormModal titulo="Alterar meu nome" aoFechar={() => setModal(false)} campos={[{ n: 'nome', rot: 'Nome de exibição', valor: eu.nome, req: true, min: 2, max: 120 }]}
              aoEnviar={async (v) => {
                const x = await seguro(() => chamar(I('/auth/perfil'), { metodo: 'PUT', corpo: { nome: v.nome, versao: eu.versao } }));
                if (!x) return false;
                atualizarSessao({ nome: v.nome });
                avisar('Nome alterado');
                recarregar();
                return true;
              }} />
          )}
        </>
      )}
      <H2>Alterar senha</H2>
      <Painel className="max-w-[460px]"><FormSenha aoConcluir={() => {}} /></Painel>
    </div>
  );
}

export function InicioInterno() {
  const { dados: eu } = useCarregar(() => chamar(I('/auth/me')), []);
  return (
    <div>
      <Cabeca titulo={`Olá${eu && (eu.nome || eu.usuario) ? `, ${eu.nome || eu.usuario}` : ''}`} texto={eu ? PAPEL_TEXTO[eu.papel] : ''} />
      <Painel className="max-w-[640px]">
        <p className="m-0">Use o menu ao lado para trabalhar. O que o seu papel não permite alterar aparece apenas para consulta.</p>
      </Painel>
    </div>
  );
}

// Alves aprova este código.
