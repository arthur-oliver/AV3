'use strict';
/* Telas da equipe interna (o que a API da AV1/AV2 já fazia, agora no navegador).
   Cada tela só aparece para os papéis que a API autoriza; quem decide de verdade é sempre o servidor. */
window.GC_INTERNO = function (GC) {
  const { h, $, pintar, num, reais, data, chamar, seguro, baixar, aviso, tabela, indicadores, selo, cabeca, opcoes, rotulo, STATUS, TIPOS, ESTADOS, LOTES, I, A } = GC;

  const PAPEIS = { SUPERUSUARIO: 'Superusuário', ADMINISTRADOR: 'Administrador', OPERADOR_CADASTRO: 'Operador de cadastro', GESTOR_ALMOXARIFADO: 'Gestor de almoxarifado', AUDITOR: 'Auditor' };
  const COMUNS = ['ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR'];
  const PAPEL_TEXTO = {
    SUPERUSUARIO: 'Você tem o maior nível de acesso: faz o que todos os papéis fazem e é o único que cria, altera, desativa e exclui contas de usuário.',
    ADMINISTRADOR: 'Você cuida de toda a operação: organizações e contratos, lotes e equipamentos, relatórios, auditoria, análises, chaves de API e fila. Contas de usuário são só do superusuário.',
    OPERADOR_CADASTRO: 'Você cadastra e altera organizações e contratos. Lotes, equipamentos e relatórios ficam disponíveis só para consulta.',
    GESTOR_ALMOXARIFADO: 'Você registra lotes, faz a triagem e movimenta os equipamentos. Organizações e relatórios ficam disponíveis só para consulta.',
    AUDITOR: 'Você consulta tudo, sem alterar nada, e tem acesso à auditoria, às análises e aos pedidos de relatório.'
  };
  const papel = () => GC.sessao().papel;
  const eh = (...p) => p.includes(papel());
  const podeCadastro = () => eh('SUPERUSUARIO', 'ADMINISTRADOR', 'OPERADOR_CADASTRO');
  const podeAlmox = () => eh('SUPERUSUARIO', 'ADMINISTRADOR', 'GESTOR_ALMOXARIFADO');
  const podeAuditar = () => eh('SUPERUSUARIO', 'ADMINISTRADOR', 'AUDITOR');
  const ehSuper = () => eh('SUPERUSUARIO');
  const curto = (id) => (id ? String(id).slice(0, 8) : '-');
  const hoje = () => new Date().toISOString().slice(0, 10);
  const dia = (d) => (d ? String(d).slice(0, 10) : '');
  const voltar = (href, texto) => h('p', null, h('a', { href }, texto));
  const sn = (v) => (v ? 'Sim' : 'Não');
  const refazer = () => GC.redesenhar();

  // ---------- diálogos e formulários ----------
  let seq = 0;
  function dialogo(titulo, form) {
    const d = h('dialog', { class: 'modal' }, h('h2', null, titulo), form);
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    return d;
  }
  const cancelar = (d) => h('button', { type: 'button', class: 'sec', onclick: () => d.close() }, 'Cancelar');

  // campos: [{ n, rot, tipo, op, valor, req, dica, min, max, step, linhas, marcado }]
  function modal(titulo, campos, enviar, botao = 'Salvar') {
    const ids = {};
    const form = h('form', null);
    for (const c of campos) {
      const id = `m${++seq}`;
      ids[c.n] = id;
      let el;
      if (c.op) el = h('select', { id, value: c.valor }, opcoes(c.op, c.vazio));
      else if (c.tipo === 'check') el = h('input', { id, type: 'checkbox', checked: !!c.valor, style: 'width:auto' });
      else if (c.linhas) el = h('textarea', { id, rows: String(c.linhas), maxlength: c.max, value: c.valor || '' });
      else el = h('input', { id, type: c.tipo || 'text', required: c.req, minlength: c.min, maxlength: c.max, step: c.step, autocomplete: c.tipo === 'password' ? 'new-password' : 'off', value: c.valor === undefined || c.valor === null ? '' : String(c.valor) });
      form.append(h('div', { class: 'campo' }, h('label', { for: id }, c.rot), el, c.dica ? h('small', { class: 'suave' }, c.dica) : null));
    }
    const d = dialogo(titulo, form);
    form.append(h('div', { class: 'acoes' }, h('button', { type: 'submit' }, botao), cancelar(d)));
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const v = {};
      for (const c of campos) {
        const el = document.getElementById(ids[c.n]);
        if (c.tipo === 'check') v[c.n] = el.checked;
        else if (el.value.trim() === '') v[c.n] = undefined;
        else v[c.n] = c.tipo === 'number' ? Number(el.value) : el.value.trim();
      }
      if (await enviar(v)) d.close();
    });
    return d;
  }

  const confirmar = (texto) => window.confirm(texto);

  // Chama a API, mostra o resultado e atualiza a tela. Devolve true se deu certo.
  async function agir(caminho, metodo, corpo, msg) {
    const r = await seguro(() => chamar(caminho, { metodo, corpo }));
    if (!r) return false;
    if (msg) aviso(msg);
    refazer();
    return true;
  }

  // Lista com páginas: "buscar(pagina)" devolve { dados, total }.
  function paginada(buscar, desenhar, tamanho = 15) {
    const alvo = h('div');
    let pagina = 1;
    async function carregar() {
      const r = await seguro(() => buscar(pagina, tamanho));
      if (!r) return;
      const ultima = Math.max(1, Math.ceil(r.total / tamanho));
      pintar(alvo, desenhar(r.dados), h('div', { class: 'paginacao' },
        h('button', { class: 'sec mini', disabled: pagina <= 1, onclick: () => { pagina--; carregar(); } }, 'Anterior'),
        `Página ${pagina} de ${ultima} (${r.total} no total)`,
        h('button', { class: 'sec mini', disabled: pagina >= ultima, onclick: () => { pagina++; carregar(); } }, 'Próxima')));
    }
    return { alvo, carregar: () => { pagina = 1; return carregar(); }, manter: carregar };
  }
  const qs = (o) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== null) q.set(k, v); return q.toString(); };
  const sel = (id, mapa, vazio) => h('select', { id }, opcoes(mapa, vazio));
  const camp = (rot, el, id) => h('div', { class: 'campo' }, h('label', { for: id }, rot), el);

  async function listarOrganizacoes() {
    const r = await seguro(() => chamar(I('/organizacoes?limite=200')));
    return r ? r.dados : [];
  }

  // ---------- início ----------
  function vInicio() {
    const s = GC.sessao();
    return h('div', null, cabeca(`Olá, ${s.nome || s.usuario}`, 'Este é o portal da equipe do Greencode.'),
      h('div', { class: 'painel' }, h('h3', null, PAPEIS[s.papel] || s.papel), h('p', null, PAPEL_TEXTO[s.papel] || ''),
        h('p', { class: 'suave' }, 'O menu mostra só o que o seu papel permite. A documentação técnica da API está em ', h('a', { href: '/docs' }, 'Swagger'), '.')));
  }

  // ---------- usuários (só superusuário) ----------
  function vUsuarios() {
    const eu = GC.sessao().id;
    const fp = sel('f-papel', PAPEIS, 'Todos os papéis');
    const fa = h('select', { id: 'f-ativo' }, h('option', { value: '' }, 'Todos'), h('option', { value: 'true' }, 'Ativos'), h('option', { value: 'false' }, 'Inativos'));
    const lista = paginada((p, l) => chamar(A(`/usuarios?${qs({ pagina: p, limite: l, papel: fp.value, ativo: fa.value })}`)), (us) => tabela([
      { titulo: 'Usuário', valor: (u) => u.usuario + (u.id === eu ? ' (você)' : '') },
      { titulo: 'Nome', valor: (u) => u.nome || '-' },
      { titulo: 'Papel', valor: (u) => PAPEIS[u.papel] || u.papel },
      { titulo: 'Situação', valor: (u) => selo(u.ativo ? 'Ativo' : 'Inativo', u.ativo ? 'ok' : 'erro') },
      { titulo: 'Último acesso', valor: (u) => data(u.ultimoAcesso) },
      { titulo: '', valor: (u) => acoesUsuario(u) }], us, { vazio: 'Nenhum usuário encontrado.' }));
    function acoesUsuario(u) {
      const outro = u.id !== eu;
      const b = (t, f, cls = 'sec') => h('button', { class: `${cls} mini`, onclick: f }, t);
      return h('span', { class: 'acoes' },
        b('Nome', () => modal('Alterar nome', [{ n: 'nome', rot: 'Nome de exibição', valor: u.nome, req: true, min: 2, max: 120 }], (v) => agir(A(`/usuarios/${u.id}/nome`), 'PATCH', { nome: v.nome, versao: u.versao }, 'Nome alterado'))),
        u.papel !== 'SUPERUSUARIO' && outro ? b('Papel', () => modal('Trocar papel', [{ n: 'papel', rot: 'Novo papel', op: Object.fromEntries(COMUNS.map((p) => [p, PAPEIS[p]])), valor: u.papel }], (v) => agir(A(`/usuarios/${u.id}`), 'PUT', { papel: v.papel, versao: u.versao }, 'Papel alterado'))) : null,
        outro ? b(u.ativo ? 'Desativar' : 'Ativar', () => { if (!u.ativo || confirmar(`Desativar ${u.usuario}? Ele não conseguirá mais entrar.`)) agir(A(`/usuarios/${u.id}/ativo`), 'PATCH', { ativo: !u.ativo }, u.ativo ? 'Usuário desativado' : 'Usuário ativado'); }) : null,
        outro ? b('Nova senha', () => modal('Redefinir senha', [{ n: 'novaSenha', rot: 'Nova senha', tipo: 'password', req: true, min: 8, max: 72, dica: 'De 8 a 72 caracteres. Também libera um login bloqueado por tentativas.' }], (v) => agir(A(`/usuarios/${u.id}/redefinir-senha`), 'POST', { novaSenha: v.novaSenha }, 'Senha redefinida'))) : null,
        outro && u.papel !== 'SUPERUSUARIO' ? b('Excluir', () => { if (confirmar(`Excluir ${u.usuario} de vez? Só é possível se ele nunca operou o sistema; caso contrário, desative.`)) agir(A(`/usuarios/${u.id}`), 'DELETE', undefined, 'Usuário excluído'); }, 'perigo') : null);
    }
    fp.addEventListener('change', lista.carregar); fa.addEventListener('change', lista.carregar);
    setTimeout(lista.carregar, 0);
    return h('div', null, cabeca('Usuários', 'Só o superusuário cria e administra contas. Cada usuário altera apenas o próprio nome e a própria senha, em Minha conta.'),
      h('div', { class: 'acoes' }, h('button', { onclick: () => modal('Novo usuário', [
        { n: 'usuario', rot: 'Login', req: true, min: 3, max: 60, dica: 'Letras, números, ponto, hífen e sublinhado.' },
        { n: 'nome', rot: 'Nome de exibição', max: 120 },
        { n: 'senha', rot: 'Senha inicial', tipo: 'password', req: true, min: 8, max: 72 },
        { n: 'papel', rot: 'Papel', op: Object.fromEntries(COMUNS.map((p) => [p, PAPEIS[p]])), valor: 'GESTOR_ALMOXARIFADO' }],
      (v) => agir(A('/usuarios'), 'POST', v, 'Usuário criado'), 'Criar usuário') }, 'Novo usuário')),
      h('div', { class: 'linha-campos' }, camp('Papel', fp, 'f-papel'), camp('Situação', fa, 'f-ativo')), lista.alvo);
  }

  // ---------- organizações ----------
  function vOrganizacoes(id) {
    if (id) return vOrganizacao(id);
    const busca = h('input', { id: 'f-busca', placeholder: 'Razão social ou CNPJ' });
    const fa = h('select', { id: 'f-ativo' }, h('option', { value: '' }, 'Todas'), h('option', { value: 'true' }, 'Ativas'), h('option', { value: 'false' }, 'Inativas'));
    const lista = paginada((p, l) => chamar(I(`/organizacoes?${qs({ pagina: p, limite: l, busca: busca.value.trim(), ativo: fa.value })}`)), (os) => tabela([
      { titulo: 'Razão social', valor: (o) => o.razaoSocial }, { titulo: 'CNPJ', valor: (o) => o.cnpj },
      { titulo: 'Contrato', valor: (o) => (o.contrato ? selo(o.contratoVigente ? 'Vigente' : 'Vencido', o.contratoVigente ? 'ok' : 'erro') : selo('Sem contrato')) },
      { titulo: 'Situação', valor: (o) => selo(o.ativo ? 'Ativa' : 'Inativa', o.ativo ? 'ok' : 'erro') }], os,
    { aoClicar: (o) => (location.hash = `#/organizacoes/${o.id}`), vazio: 'Nenhuma organização encontrada.' }));
    busca.addEventListener('input', () => { clearTimeout(busca.t); busca.t = setTimeout(lista.carregar, 350); }); fa.addEventListener('change', lista.carregar);
    setTimeout(lista.carregar, 0);
    return h('div', null, cabeca('Organizações', 'Empresas que enviam equipamentos, com o contrato de cada uma.'),
      podeCadastro() ? h('div', { class: 'acoes' }, h('button', { onclick: () => modal('Nova organização', camposOrg({}, true), (v) => salvarOrg(v), 'Cadastrar') }, 'Nova organização')) : null,
      h('div', { class: 'linha-campos' }, camp('Buscar', busca, 'f-busca'), camp('Situação', fa, 'f-ativo')), lista.alvo);
  }
  const camposOrg = (o, novo) => [
    { n: 'razaoSocial', rot: 'Razão social', valor: o.razaoSocial, req: true, min: 2, max: 200 },
    ...(novo ? [{ n: 'cnpj', rot: 'CNPJ', req: true, max: 20, dica: 'O sistema valida os dígitos verificadores.' }] : []),
    { n: 'inscricaoEstadual', rot: 'Inscrição estadual', valor: o.inscricaoEstadual, max: 30 },
    { n: 'enderecoCompleto', rot: 'Endereço', valor: o.enderecoCompleto, max: 1000 },
    { n: 'telefone', rot: 'Telefone', valor: o.telefone, max: 30 },
    { n: 'email', rot: 'E-mail', tipo: 'email', valor: o.email, max: 150 }];
  const salvarOrg = async (v) => {
    const r = await seguro(() => chamar(I('/organizacoes'), { metodo: 'POST', corpo: v }));
    if (!r) return false;
    aviso('Organização cadastrada'); location.hash = `#/organizacoes/${r.dados.id}`; return true;
  };
  const camposContrato = (c) => [
    { n: 'dataVencimento', rot: 'Vencimento', tipo: 'date', valor: dia(c && c.dataVencimento), req: true },
    { n: 'valorMensal', rot: 'Valor mensal (R$)', tipo: 'number', step: '0.01', min: 0, valor: c && Number(c.valorMensal), req: true },
    { n: 'clausulas', rot: 'Cláusulas', linhas: 4, valor: c && Array.isArray(c.clausulas) ? c.clausulas.join('\n') : '', dica: 'Uma por linha.' },
    { n: 'renovacaoAutomatica', rot: 'Renovação automática', tipo: 'check', valor: c && c.renovacaoAutomatica }];
  const corpoContrato = (v) => ({ dataVencimento: v.dataVencimento, valorMensal: v.valorMensal, clausulas: (v.clausulas || '').split('\n').map((x) => x.trim()).filter(Boolean), renovacaoAutomatica: !!v.renovacaoAutomatica });

  function vOrganizacao(id) {
    const alvo = h('div', null, h('p', { class: 'vazio' }, 'Carregando...'));
    seguro(() => chamar(I(`/organizacoes/${id}`))).then((r) => {
      if (!r) { pintar(alvo, voltar('#/organizacoes', 'Voltar para as organizações')); return; }
      const o = r.dados; const c = o.contrato; const pode = podeCadastro();
      const b = (t, f, cls = 'sec') => h('button', { class: cls, onclick: f }, t);
      pintar(alvo, 
        indicadores([['CNPJ', o.cnpj], ['Situação', o.ativo ? 'Ativa' : 'Inativa'], ['Inscrição estadual', o.inscricaoEstadual || '-'], ['Telefone', o.telefone || '-'], ['E-mail', o.email || '-']]),
        o.enderecoCompleto ? h('p', null, o.enderecoCompleto) : null,
        pode ? h('div', { class: 'acoes' },
          b('Editar dados', () => modal('Editar organização', camposOrg(o, false), (v) => agir(I(`/organizacoes/${id}`), 'PUT', { ...v, versao: o.versao }, 'Dados salvos')), 'primario'),
          b(o.ativo ? 'Inativar' : 'Reativar', () => { if (!o.ativo || confirmar('Inativar a organização? Os lotes e equipamentos dela também ficam inativos (podem ser reativados).')) agir(I(`/organizacoes/${id}/ativo`), 'PATCH', { ativo: !o.ativo, versao: o.versao }, o.ativo ? 'Organização inativada' : 'Organização reativada'); }),
          b('Excluir de vez', () => { if (confirmar('Excluir DEFINITIVAMENTE a organização, o contrato, os lotes, os equipamentos e as movimentações? Não dá para desfazer.')) seguro(() => chamar(I(`/organizacoes/${id}?versao=${o.versao}`), { metodo: 'DELETE' })).then((x) => { if (x) { aviso('Organização excluída'); location.hash = '#/organizacoes'; } }); }, 'perigo')) : null,
        h('h2', null, 'Contrato'),
        c ? h('div', null,
          indicadores([['Situação', o.contratoVigente ? 'Vigente' : 'Vencido'], ['Assinatura', data(c.dataAssinatura).slice(0, 10)], ['Vencimento', data(c.dataVencimento).slice(0, 10)], ['Valor mensal', reais(c.valorMensal)], ['Renovação automática', sn(c.renovacaoAutomatica)]]),
          h('ul', null, (Array.isArray(c.clausulas) ? c.clausulas : []).map((x) => h('li', null, x))),
          pode ? h('div', { class: 'acoes' },
            b('Renovar', () => modal('Renovar contrato', [{ n: 'novoVencimento', rot: 'Novo vencimento', tipo: 'date', req: true, dica: 'Precisa ser depois do vencimento atual.' }], (v) => agir(I(`/organizacoes/${id}/contrato/renovar`), 'PATCH', { novoVencimento: v.novoVencimento, versao: c.versao }, 'Contrato renovado')), 'primario'),
            b('Substituir', () => modal('Substituir contrato', camposContrato(c), (v) => agir(I(`/organizacoes/${id}/contrato`), 'PUT', { ...corpoContrato(v), versao: c.versao }, 'Contrato substituído'))),
            b('Remover', () => { if (confirmar('Remover o contrato? Sem contrato a organização não recebe novos lotes.')) seguro(() => chamar(I(`/organizacoes/${id}/contrato?versao=${c.versao}`), { metodo: 'DELETE' })).then((x) => { if (x) { aviso('Contrato removido'); refazer(); } }); }, 'perigo')) : null)
          : h('div', null, h('p', { class: 'vazio' }, 'Esta organização não tem contrato e, por isso, não recebe novos lotes.'), pode ? h('div', { class: 'acoes' }, b('Cadastrar contrato', () => modal('Novo contrato', camposContrato(null), (v) => agir(I(`/organizacoes/${id}/contrato`), 'PUT', corpoContrato(v), 'Contrato cadastrado'), 'Cadastrar'), 'primario')) : null));
      $('#titulo-org').textContent = o.razaoSocial;
    });
    return h('div', null, voltar('#/organizacoes', 'Voltar para as organizações'), h('div', { class: 'cabeca' }, h('h1', { id: 'titulo-org' }, 'Organização')), alvo);
  }

  // ---------- lotes ----------
  function vLotes(id) {
    if (id === 'novo') return vLoteNovo();
    if (id) return vLote(id);
    const fs = sel('f-status', LOTES, 'Todos');
    const fa = h('select', { id: 'f-ativo' }, h('option', { value: 'true' }, 'Ativos'), h('option', { value: 'false' }, 'Inativos'), h('option', { value: '' }, 'Todos'));
    const fo = h('select', { id: 'f-org' }, h('option', { value: '' }, 'Todas'));
    listarOrganizacoes().then((os) => os.forEach((o) => fo.append(h('option', { value: o.id }, o.razaoSocial))));
    const lista = paginada((p, l) => chamar(I(`/lotes?${qs({ pagina: p, limite: l, status: fs.value, ativo: fa.value, organizacaoId: fo.value })}`)), (ls) => tabela([
      { titulo: 'Nota fiscal', valor: (l) => l.notaFiscal }, { titulo: 'Organização', valor: (l) => (l.organizacao ? l.organizacao.razaoSocial : '-') }, { titulo: 'Entrada', valor: (l) => data(l.dataEntrada) },
      { titulo: 'Equipamentos', num: true, valor: (l) => (l._count ? l._count.equipamentos : '-') }, { titulo: 'Situação', valor: (l) => selo(rotulo(LOTES, l.statusProcessamento)) },
      { titulo: '', valor: (l) => (l.ativo ? null : selo('Inativo', 'erro')) }], ls,
    { aoClicar: (l) => (location.hash = `#/lotes/${l.id}`), vazio: 'Nenhum lote encontrado.' }));
    [fs, fa, fo].forEach((e) => e.addEventListener('change', lista.carregar));
    setTimeout(lista.carregar, 0);
    return h('div', null, cabeca('Lotes', 'Cada lote chega com uma nota fiscal e passa pela triagem.'),
      podeAlmox() ? h('div', { class: 'acoes' }, h('button', { onclick: () => (location.hash = '#/lotes/novo') }, 'Registrar lote')) : null,
      h('div', { class: 'linha-campos' }, camp('Situação do lote', fs, 'f-status'), camp('Cadastro', fa, 'f-ativo'), camp('Organização', fo, 'f-org')), lista.alvo);
  }

  // Linhas de equipamento (usadas ao registrar o lote e ao adicionar equipamentos).
  function linhasEquip() {
    const el = h('div'); const ano = new Date().getFullYear();
    function nova() {
      const l = h('div', { class: 'equip-linha' },
        h('div', null, h('label', null, 'Tipo'), h('select', { 'data-c': 'tipo' }, opcoes(TIPOS))),
        h('div', null, h('label', null, 'Marca'), h('input', { 'data-c': 'marca', maxlength: '80' })),
        h('div', null, h('label', null, 'Modelo'), h('input', { 'data-c': 'modelo', maxlength: '80' })),
        h('div', null, h('label', null, 'Ano'), h('input', { 'data-c': 'ano', type: 'number', min: '1970', max: '2100', value: String(ano - 3), required: true })),
        h('div', null, h('label', null, 'Estado'), h('select', { 'data-c': 'estado', value: 'USADO_LEVE' }, opcoes(ESTADOS))),
        h('div', null, h('label', null, 'Peso (kg)'), h('input', { 'data-c': 'peso', type: 'number', step: '0.001', min: '0.001', required: true })),
        h('button', { type: 'button', class: 'perigo mini', onclick: () => l.remove() }, 'Remover'));
      el.append(l);
    }
    nova();
    return { el, nova, valores: () => [...el.children].map((l) => { const v = (c) => l.querySelector(`[data-c="${c}"]`).value; return { tipo: v('tipo'), marca: v('marca') || undefined, modelo: v('modelo') || undefined, anoFabricacao: Number(v('ano')), estadoFisico: v('estado'), pesoQuilogramas: Number(v('peso')) }; }) };
  }

  function vLoteNovo() {
    const eq = linhasEquip(); const org = h('select', { id: 'n-org', required: true });
    listarOrganizacoes().then((os) => os.filter((o) => o.ativo).forEach((o) => org.append(h('option', { value: o.id }, `${o.razaoSocial}${o.contratoVigente ? '' : ' (sem contrato vigente)'}`))));
    async function enviar(ev) {
      ev.preventDefault();
      const corpo = { organizacaoId: org.value, notaFiscal: $('#n-nf').value, transportadora: $('#n-tr').value, observacoes: $('#n-ob').value || undefined, equipamentos: eq.valores() };
      if ($('#n-de').value) corpo.dataEntrada = $('#n-de').value;
      const r = await seguro(() => chamar(I('/lotes'), { metodo: 'POST', corpo }));
      if (r) { aviso('Lote registrado', `Nota fiscal ${r.dados.notaFiscal}.`); location.hash = `#/lotes/${r.dados.id}`; }
    }
    return h('div', null, voltar('#/lotes', 'Voltar para os lotes'), cabeca('Registrar lote', 'A organização precisa estar ativa e ter contrato vigente. Os equipamentos podem ser adicionados agora ou depois, até a triagem.'),
      h('form', { class: 'painel', onsubmit: enviar },
        h('div', { class: 'linha-campos' }, camp('Organização', org, 'n-org'), camp('Nota fiscal', h('input', { id: 'n-nf', required: true, maxlength: '60' }), 'n-nf'), camp('Transportadora', h('input', { id: 'n-tr', required: true, maxlength: '120' }), 'n-tr'), camp('Data de entrada (opcional)', h('input', { id: 'n-de', type: 'date', max: hoje() }), 'n-de')),
        camp('Observações', h('textarea', { id: 'n-ob', rows: '2', maxlength: '2000' }), 'n-ob'),
        h('h3', null, 'Equipamentos'), eq.el,
        h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'sec', onclick: eq.nova }, 'Adicionar equipamento'), h('button', { type: 'submit' }, 'Registrar lote'))));
  }

  function vLote(id) {
    const alvo = h('div', null, h('p', { class: 'vazio' }, 'Carregando...'));
    seguro(() => chamar(I(`/lotes/${id}`))).then((r) => {
      if (!r) { pintar(alvo, voltar('#/lotes', 'Voltar para os lotes')); return; }
      const l = r.dados; const pode = podeAlmox(); const b = (t, f, cls = 'sec') => h('button', { class: cls, onclick: f }, t);
      const recebido = l.statusProcessamento === 'RECEBIDO';
      pintar(alvo, 
        indicadores([['Nota fiscal', l.notaFiscal], ['Organização', l.organizacao ? l.organizacao.razaoSocial : '-'], ['Entrada', data(l.dataEntrada)], ['Transportadora', l.transportadora], ['Situação', rotulo(LOTES, l.statusProcessamento)], ['Cadastro', l.ativo ? 'Ativo' : 'Inativo'], ['Equipamentos', l.resumo.quantidade], ['Peso total', `${num(l.resumo.pesoTotalKg)} kg`]]),
        l.observacoes ? h('p', null, l.observacoes) : null,
        pode ? h('div', { class: 'acoes' },
          recebido && l.ativo ? b('Processar triagem', () => { if (confirmar('Processar a triagem? Os equipamentos vão para "Em triagem" e o lote passa a ser derivado deles.')) agir(I(`/lotes/${id}/triagem`), 'POST', { versao: l.versao }, 'Triagem processada'); }, 'primario') : null,
          recebido && l.ativo ? b('Adicionar equipamentos', () => adicionar(l)) : null,
          b('Corrigir dados', () => modal('Corrigir lote', [
            { n: 'notaFiscal', rot: 'Nota fiscal', valor: l.notaFiscal, req: true, max: 60 }, { n: 'transportadora', rot: 'Transportadora', valor: l.transportadora, req: true, max: 120 },
            ...(recebido ? [{ n: 'dataEntrada', rot: 'Data de entrada', tipo: 'date', valor: dia(l.dataEntrada), dica: 'Só pode mudar antes da triagem.' }] : []),
            { n: 'observacoes', rot: 'Observações', linhas: 3, valor: l.observacoes, max: 2000 }], (v) => agir(I(`/lotes/${id}`), 'PUT', { ...v, versao: l.versao }, 'Lote corrigido'))),
          b(l.ativo ? 'Inativar' : 'Reativar', () => { if (!l.ativo || confirmar('Inativar o lote? Os equipamentos dele também ficam inativos e o lote sai dos relatórios.')) agir(I(`/lotes/${id}/ativo`), 'PATCH', { ativo: !l.ativo, versao: l.versao }, l.ativo ? 'Lote inativado' : 'Lote reativado'); }),
          b('Excluir de vez', () => { if (confirmar('Excluir DEFINITIVAMENTE o lote, os equipamentos e as movimentações? Não dá para desfazer.')) seguro(() => chamar(I(`/lotes/${id}?versao=${l.versao}`), { metodo: 'DELETE' })).then((x) => { if (x) { aviso('Lote excluído'); location.hash = '#/lotes'; } }); }, 'perigo')) : null,
        h('h2', null, 'Equipamentos'),
        tabela([{ titulo: '#', num: true, valor: (e) => e.posicaoNoLote }, { titulo: 'Tipo', valor: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Marca e modelo', valor: (e) => `${e.marca || ''} ${e.modelo || ''}`.trim() || '-' }, { titulo: 'Ano', num: true, valor: (e) => e.anoFabricacao }, { titulo: 'Estado', valor: (e) => rotulo(ESTADOS, e.estadoFisico) }, { titulo: 'Situação', valor: (e) => selo(rotulo(STATUS, e.statusRastreamento)) }],
          l.equipamentos, { aoClicar: (e) => (location.hash = `#/equipamentos/${e.id}`), vazio: 'Este lote ainda não tem equipamentos.' }));
    });
    function adicionar(l) {
      const eq = linhasEquip(); const form = h('form', null, eq.el);
      const d = dialogo('Adicionar equipamentos', form);
      form.append(h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'sec', onclick: eq.nova }, 'Mais uma linha'), h('button', { type: 'submit' }, 'Adicionar'), cancelar(d)));
      form.addEventListener('submit', async (ev) => { ev.preventDefault(); if (await agir(I(`/lotes/${id}/equipamentos`), 'POST', { versao: l.versao, equipamentos: eq.valores() }, 'Equipamentos adicionados')) d.close(); });
    }
    return h('div', null, voltar('#/lotes', 'Voltar para os lotes'), cabeca('Detalhe do lote'), alvo);
  }

  // ---------- equipamentos ----------
  function vEquipamentos(id) {
    if (id) return vEquipamento(id);
    const fs = sel('f-status', STATUS, 'Todos'); const ft = sel('f-tipo', TIPOS, 'Todos');
    const lista = paginada((p, l) => chamar(I(`/equipamentos?${qs({ pagina: p, limite: l, status: fs.value, tipo: ft.value })}`)), (es) => tabela([
      { titulo: 'Código', valor: (e) => curto(e.id) }, { titulo: 'Tipo', valor: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Marca e modelo', valor: (e) => `${e.marca || ''} ${e.modelo || ''}`.trim() || '-' },
      { titulo: 'Estado', valor: (e) => rotulo(ESTADOS, e.estadoFisico) }, { titulo: 'Peso (kg)', num: true, valor: (e) => num(e.pesoQuilogramas) }, { titulo: 'Situação', valor: (e) => selo(rotulo(STATUS, e.statusRastreamento)) }], es,
    { aoClicar: (e) => (location.hash = `#/equipamentos/${e.id}`), vazio: 'Nenhum equipamento encontrado.' }));
    [fs, ft].forEach((e) => e.addEventListener('change', lista.carregar));
    setTimeout(lista.carregar, 0);
    return h('div', null, cabeca('Equipamentos', 'Todos os equipamentos recebidos. Abra um para ver o histórico e movimentá-lo.'), h('div', { class: 'linha-campos' }, camp('Situação', fs, 'f-status'), camp('Tipo', ft, 'f-tipo')), lista.alvo);
  }

  function vEquipamento(id) {
    const alvo = h('div', null, h('p', { class: 'vazio' }, 'Carregando...'));
    Promise.all([seguro(() => chamar(I(`/equipamentos/${id}`))), seguro(() => chamar(I(`/equipamentos/${id}/rastreamento`)))]).then(([a, b]) => {
      if (!a || !b) { pintar(alvo, voltar('#/equipamentos', 'Voltar para os equipamentos')); return; }
      const e = a.dados; const m = b.dados.movimentacoes; const pode = podeAlmox(); const bt = (t, f, cls = 'sec') => h('button', { class: cls, onclick: f }, t);
      const prox = Object.fromEntries((e.proximosStatusPermitidos || []).map((s) => [s, rotulo(STATUS, s)]));
      pintar(alvo, 
        h('h2', null, `${rotulo(TIPOS, e.tipo)} ${e.marca || ''} ${e.modelo || ''}`.trim()),
        indicadores([['Código de barras', e.codigoBarrasInterno || e.id], ['Situação', rotulo(STATUS, e.statusRastreamento)], ['Estado físico', rotulo(ESTADOS, e.estadoFisico)], ['Peso', `${num(e.pesoQuilogramas)} kg`], ['Ano de fabricação', e.anoFabricacao], ['Lote', e.lote ? e.lote.notaFiscal : '-']]),
        e.lote ? h('p', null, h('a', { href: `#/lotes/${e.loteId}` }, 'Abrir o lote')) : null,
        pode ? h('div', { class: 'acoes' },
          Object.keys(prox).length ? bt('Mudar situação', () => modal('Mudar situação', [{ n: 'status', rot: 'Nova situação', op: prox }, { n: 'justificativa', rot: 'Justificativa', linhas: 2, req: true, max: 1000, dica: 'Fica registrada no histórico.' }], (v) => agir(I(`/equipamentos/${id}/status`), 'PATCH', { ...v, versao: e.versao }, 'Situação alterada')), 'primario') : null,
          bt('Registrar movimentação', () => modal('Registrar movimentação', [{ n: 'destino', rot: 'Destino', req: true, max: 120, dica: 'Ex.: Prateleira B2, Bancada de desmonte.' }, { n: 'observacao', rot: 'Observação', max: 1000 }], (v) => agir(I(`/equipamentos/${id}/movimentacoes`), 'POST', v, 'Movimentação registrada'))),
          bt('Estado físico', () => modal('Alterar estado físico', [{ n: 'estadoFisico', rot: 'Novo estado', op: ESTADOS, valor: e.estadoFisico }, { n: 'justificativa', rot: 'Justificativa', linhas: 2, max: 1000, dica: 'Obrigatória se o estado piorar duas categorias ou mais.' }], (v) => agir(I(`/equipamentos/${id}/estado-fisico`), 'PATCH', { ...v, versao: e.versao }, 'Estado alterado'))),
          bt('Corrigir dados', () => modal('Corrigir equipamento', [{ n: 'tipo', rot: 'Tipo', op: TIPOS, valor: e.tipo }, { n: 'marca', rot: 'Marca', valor: e.marca, max: 80 }, { n: 'modelo', rot: 'Modelo', valor: e.modelo, max: 80 }, { n: 'anoFabricacao', rot: 'Ano', tipo: 'number', min: 1970, max: 2100, valor: e.anoFabricacao, req: true }, { n: 'pesoQuilogramas', rot: 'Peso (kg)', tipo: 'number', step: '0.001', min: 0.001, valor: Number(e.pesoQuilogramas), req: true }], (v) => agir(I(`/equipamentos/${id}`), 'PUT', { ...v, versao: e.versao }, 'Dados corrigidos'))),
          bt('Excluir', () => { if (confirmar('Excluir DEFINITIVAMENTE o equipamento e o histórico dele?')) seguro(() => chamar(I(`/equipamentos/${id}?versao=${e.versao}`), { metodo: 'DELETE' })).then((x) => { if (x) { aviso('Equipamento excluído'); location.hash = '#/equipamentos'; } }); }, 'perigo')) : null,
        h('h3', null, 'Histórico'),
        tabela([{ titulo: 'Quando', valor: (x) => data(x.dataHora) }, { titulo: 'De', valor: (x) => rotulo(STATUS, x.origem) }, { titulo: 'Para', valor: (x) => rotulo(STATUS, x.destino) }, { titulo: 'Responsável', valor: (x) => x.responsavel }, { titulo: 'Observação', valor: (x) => x.observacao || '-' }], m, { vazio: 'Sem movimentações.' }));
    });
    return h('div', null, voltar('#/equipamentos', 'Voltar para os equipamentos'), cabeca('Detalhe do equipamento'), alvo);
  }

  // ---------- relatórios (consulta imediata, com CSV) ----------
  function vRelatorios() {
    const tipo = h('select', { id: 'r-tipo' }, h('option', { value: 'org' }, 'Por organização'), h('option', { value: 'status' }, 'Por situação do equipamento'), h('option', { value: 'fin' }, 'Financeiro (contratos)'));
    const org = h('select', { id: 'r-org' }); const st = sel('r-st', STATUS);
    listarOrganizacoes().then((os) => os.forEach((o) => org.append(h('option', { value: o.id }, o.razaoSocial))));
    const ini = h('input', { id: 'r-ini', type: 'date' }); const fim = h('input', { id: 'r-fim', type: 'date' });
    const inat = h('input', { id: 'r-inat', type: 'checkbox', style: 'width:auto' });
    const campos = h('div', { class: 'linha-campos' });
    const saida = h('div');
    function url(csv) {
      const q = { inicio: ini.value, fim: fim.value, incluirInativos: inat.checked ? 'true' : '', formato: csv ? 'csv' : '' };
      if (tipo.value === 'org') return I(`/relatorios/organizacao/${org.value}?${qs(q)}`);
      if (tipo.value === 'status') return I(`/relatorios/status/${st.value}?${qs({ incluirInativos: q.incluirInativos, formato: q.formato })}`);
      return I(`/relatorios/financeiro?${qs({ inicio: q.inicio, fim: q.fim, formato: q.formato })}`);
    }
    function montar() {
      pintar(campos, ...[tipo.value === 'org' ? camp('Organização', org, 'r-org') : null, tipo.value === 'status' ? camp('Situação', st, 'r-st') : null,
        tipo.value !== 'status' ? camp('De', ini, 'r-ini') : null, tipo.value !== 'status' ? camp('Até', fim, 'r-fim') : null,
        tipo.value !== 'fin' ? h('div', { class: 'campo' }, h('label', { for: 'r-inat' }, 'Incluir inativos'), inat) : null].filter(Boolean));
    }
    tipo.addEventListener('change', () => { montar(); pintar(saida, ); }); montar();
    async function gerar(ev) {
      ev.preventDefault();
      const r = await seguro(() => chamar(url(false)));
      if (!r) return;
      const d = r.dados;
      if (tipo.value === 'org') pintar(saida, h('h2', null, d.organizacao.razaoSocial), indicadores([['Lotes', d.totalLotes], ['Equipamentos', d.totalEquipamentos], ['Peso total', `${num(d.pesoTotalKg)} kg`]]),
        h('h3', null, 'Equipamentos por situação'), tabela([{ titulo: 'Situação', valor: (x) => rotulo(STATUS, x[0]) }, { titulo: 'Quantidade', num: true, valor: (x) => x[1] }], Object.entries(d.equipamentosPorStatus), { vazio: 'Sem equipamentos no período.' }),
        h('h3', null, 'Lotes'), tabela([{ titulo: 'Nota fiscal', valor: (l) => l.notaFiscal }, { titulo: 'Entrada', valor: (l) => data(l.dataEntrada) }, { titulo: 'Situação', valor: (l) => rotulo(LOTES, l.statusProcessamento) }, { titulo: 'Equipamentos', num: true, valor: (l) => l.equipamentos }], d.lotes, { vazio: 'Sem lotes no período.' }));
      else if (tipo.value === 'status') pintar(saida, h('h2', null, rotulo(STATUS, d.status)), indicadores([['Equipamentos', d.total]]),
        tabela([{ titulo: 'Código', valor: (e) => curto(e.id) }, { titulo: 'Tipo', valor: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Marca e modelo', valor: (e) => `${e.marca || ''} ${e.modelo || ''}`.trim() || '-' }, { titulo: 'Lote', valor: (e) => (e.lote ? e.lote.notaFiscal : '-') }], d.equipamentos, { aoClicar: (e) => (location.hash = `#/equipamentos/${e.id}`), vazio: 'Nenhum equipamento nesta situação.' }));
      else pintar(saida, h('h2', null, 'Contratos no período'), indicadores([['Organizações com contrato', d.organizacoesComContrato], ['Valor mensal contratado', reais(d.valorMensalContratado)]]),
        tabela([{ titulo: 'Organização', valor: (c) => c.organizacao.razaoSocial }, { titulo: 'Valor mensal', num: true, valor: (c) => reais(c.valorMensal) }, { titulo: 'Vencimento', valor: (c) => data(c.dataVencimento).slice(0, 10) }, { titulo: 'Renovação automática', valor: (c) => sn(c.renovacaoAutomatica) }], d.contratos, { vazio: 'Nenhum contrato vigente no período.' }));
      saida.append(h('div', { class: 'acoes' }, h('button', { class: 'sec', onclick: () => baixar(url(true), 'relatorio.csv') }, 'Baixar CSV (abre no Excel)')));
    }
    return h('div', null, cabeca('Relatórios', 'Consultas imediatas, com opção de baixar em CSV. Para análises pesadas, use "Pedidos de relatório".'),
      h('form', { class: 'painel', onsubmit: gerar }, h('div', { class: 'linha-campos' }, camp('Relatório', tipo, 'r-tipo')), campos, h('div', { class: 'acoes' }, h('button', { type: 'submit' }, 'Gerar'))), h('section', { class: 'bloco' }, saida));
  }

  // ---------- auditoria ----------
  function vAuditoria() {
    const ent = h('input', { id: 'a-ent', list: 'a-ents', placeholder: 'Todas' }); const dl = h('datalist', { id: 'a-ents' }, ['Usuario', 'Organizacao', 'Contrato', 'Lote', 'Equipamento'].map((x) => h('option', { value: x })));
    const usu = h('input', { id: 'a-usu', placeholder: 'Login' }); const ini = h('input', { id: 'a-ini', type: 'date' }); const fim = h('input', { id: 'a-fim', type: 'date' });
    const lim = h('select', { id: 'a-lim' }, ['50', '100', '250', '500'].map((x) => h('option', { value: x }, x)));
    const saida = h('div');
    const url = (csv) => I(`/auditoria?${qs({ entidade: ent.value.trim(), usuario: usu.value.trim(), inicio: ini.value, fim: fim.value, limite: lim.value, formato: csv ? 'csv' : '' })}`);
    const json = (x) => (x === null || x === undefined ? '-' : JSON.stringify(x, null, 2));
    async function buscar(ev) {
      ev && ev.preventDefault();
      const r = await seguro(() => chamar(url(false)));
      if (!r) return;
      pintar(saida, h('p', { class: 'suave' }, `${r.dados.total} registro(s), do mais recente ao mais antigo. Clique em "Ver" para o antes e o depois.`),
        tabela([{ titulo: 'Quando', valor: (x) => data(x.timestamp) }, { titulo: 'Operação', valor: (x) => x.operacao }, { titulo: 'Entidade', valor: (x) => `${x.entidade} ${curto(x.entidadeId)}` }, { titulo: 'Usuário', valor: (x) => x.usuarioResponsavel },
          { titulo: '', valor: (x) => h('details', null, h('summary', null, 'Ver'), h('pre', { class: 'json' }, `Antes:\n${json(x.dadosAntes)}\n\nDepois:\n${json(x.dadosDepois)}`)) }], r.dados.registros, { vazio: 'Nenhum registro com esses filtros.' }),
        h('div', { class: 'acoes' }, h('button', { class: 'sec', onclick: () => baixar(url(true), 'auditoria.csv') }, 'Baixar CSV')));
    }
    setTimeout(buscar, 0);
    return h('div', null, cabeca('Auditoria', 'Registro de quem fez o quê, com o estado antes e depois de cada operação.'),
      h('form', { class: 'painel', onsubmit: buscar }, h('div', { class: 'linha-campos' }, camp('Entidade', ent, 'a-ent'), dl, camp('Usuário', usu, 'a-usu'), camp('De', ini, 'a-ini'), camp('Até', fim, 'a-fim'), camp('Quantidade', lim, 'a-lim')), h('div', { class: 'acoes' }, h('button', { type: 'submit' }, 'Filtrar'))), h('section', { class: 'bloco' }, saida));
  }

  // ---------- minha conta ----------
  function vConta() {
    const s = GC.sessao(); const alvo = h('div');
    async function carregar() {
      const r = await seguro(() => chamar(I('/auth/me')));
      if (!r) return;
      const eu = r.dados;
      pintar(alvo, indicadores([['Login', eu.usuario], ['Nome', eu.nome || '-'], ['Papel', PAPEIS[eu.papel] || eu.papel]]),
        h('div', { class: 'acoes' },
          h('button', { onclick: () => modal('Alterar meu nome', [{ n: 'nome', rot: 'Nome de exibição', valor: eu.nome, req: true, min: 2, max: 120 }], async (v) => {
            const x = await seguro(() => chamar(I('/auth/perfil'), { metodo: 'PUT', corpo: { nome: v.nome, versao: eu.versao } }));
            if (!x) return false; s.nome = v.nome; GC.salvarSessao(); aviso('Nome alterado'); refazer(); return true; }) }, 'Alterar nome'),
          h('button', { class: 'sec', onclick: () => modal('Alterar minha senha', [{ n: 'senhaAtual', rot: 'Senha atual', tipo: 'password', req: true, max: 100 }, { n: 'novaSenha', rot: 'Nova senha', tipo: 'password', req: true, min: 8, max: 72, dica: 'De 8 a 72 caracteres.' }], async (v) => {
            const x = await seguro(() => chamar(I('/auth/alterar-senha'), { metodo: 'POST', corpo: v }));
            if (x) aviso('Senha alterada'); return !!x; }) }, 'Alterar senha')));
    }
    setTimeout(carregar, 0);
    return h('div', null, cabeca('Minha conta', 'Você altera aqui o seu nome e a sua senha. As demais contas são do superusuário.'), alvo);
  }

  return { vInicio, vUsuarios, vOrganizacoes, vLotes, vEquipamentos, vRelatorios, vAuditoria, vConta, podeCadastro, podeAlmox, podeAuditar, ehSuper, PAPEIS };
};

// Arthur Oliver Rossi Alves, autor do Greencode.
