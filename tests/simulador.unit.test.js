/**
 * Testes unitários do Simulador de Perfil de Consumo:
 * - catálogo de pacotes/apps/perfis (D-074) e combo de upsell
 * - molde padrão de perguntas + motor de pontuação dinâmico (D-075)
 * - resumo legível do perfil (leads novos com snapshot + leads legados)
 *
 * Para rodar: node tests/simulador.unit.test.js
 *
 * Diferente dos outros testes unitários (que duplicam funções pequenas),
 * aqui importamos o módulo REAL: src/lib/simulador.js não tem imports de
 * propósito, então dá pra carregá-lo como ESM via data-URL mesmo com o
 * projeto em CJS — os pesos do scoring são regra de negócio e o teste
 * precisa quebrar se alguém mudá-los sem ajustar aqui.
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(desc, cond) {
  if (cond) { console.log(`  ✓ ${desc}`); passed++; }
  else       { console.error(`  ✗ ${desc}`); failed++; }
}

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/lib/simulador.js'), 'utf8');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const {
    PERGUNTAS_SIMULADOR, PERGUNTAS_SIMULADOR_VERSAO, perguntasPadrao,
    normalizarRespostasDinamico, calcularPerfilDinamico, resumoPerfil,
    PACOTES_INTERNET, APPS_ADICIONAIS, PERFIS_SIMULADOR, pacotePorMega, pacoteUpgrade, perfilPorKey, montarCombo, fmtMoeda,
  } = mod;

  // ─── Molde legado (fonte de perguntasPadrao + resumoPerfil legado) ──────

  console.log('\ncatálogo PERGUNTAS_SIMULADOR (molde padrão + resumo legado)');
  assert('versão do formato é 2 (D-075: passou a incluir perguntas+combo)', PERGUNTAS_SIMULADOR_VERSAO === 2);
  assert('5 perguntas no molde', PERGUNTAS_SIMULADOR.length === 5);
  assert('keys únicas', new Set(PERGUNTAS_SIMULADOR.map(p => p.key)).size === PERGUNTAS_SIMULADOR.length);
  assert('toda pergunta tem tipo single ou multi', PERGUNTAS_SIMULADOR.every(p => ['single', 'multi'].includes(p.tipo)));
  assert('toda pergunta tem ao menos 2 opções', PERGUNTAS_SIMULADOR.every(p => p.opcoes.length >= 2));

  // ─── Catálogo de pacotes, apps e perfis (D-074) ──────────────────────────

  console.log('\ncatálogo de pacotes/apps/perfis');
  assert('6 pacotes de internet', PACOTES_INTERNET.length === 6);
  assert('megas únicos e crescentes', PACOTES_INTERNET.every((p, i) => i === 0 || p.mega > PACOTES_INTERNET[i - 1].mega));
  assert('só o 420 Mega é destaque', PACOTES_INTERNET.filter(p => p.destaque).map(p => p.mega).join(',') === '420');
  assert('2 apps adicionais com preço e itens', APPS_ADICIONAIS.length === 2 && APPS_ADICIONAIS.every(a => a.preco > 0 && a.itens.length > 0));
  assert('yellow custa 15, black custa 30', APPS_ADICIONAIS.find(a => a.key === 'yellow').preco === 15 && APPS_ADICIONAIS.find(a => a.key === 'black').preco === 30);
  assert('4 perfis, cada um com pacote válido do catálogo', PERFIS_SIMULADOR.length === 4 && PERFIS_SIMULADOR.every(p => PACOTES_INTERNET.some(pk => pk.mega === p.pacoteMega)));
  assert('perfis têm label e descrição não vazios', PERFIS_SIMULADOR.every(p => p.label && p.descricao));
  assert('gamer recomenda 420 ou maior', PERFIS_SIMULADOR.find(p => p.key === 'gamer').pacoteMega >= 420);

  console.log('\npacotePorMega / pacoteUpgrade');
  assert('pacotePorMega encontra pacote existente', pacotePorMega(420).preco === 99.90);
  assert('pacotePorMega retorna null pra mega inexistente', pacotePorMega(999) === null);
  assert('upgrade de 120 é 240', pacoteUpgrade(120).mega === 240);
  assert('upgrade do pacote mais alto (680) é null', pacoteUpgrade(680) === null);
  assert('perfilPorKey retorna null pra chave inválida', perfilPorKey('inexistente') === null);

  console.log('\nmontarCombo');
  assert('chave de perfil inválida retorna null', montarCombo('hack') === null);
  const comboBase = montarCombo('gamer', {});
  assert('combo base = só o pacote do perfil (gamer → 420, R$ 99,90)', comboBase.pacoteMega === 420 && comboBase.valorTotal === 99.90);
  const comboYellow = montarCombo('basico', { yellow: true });
  assert('básico + yellow = 79,90 + 15 = 94,90', comboYellow.valorTotal === 94.90);
  const comboBlack = montarCombo('basico', { black: true });
  assert('básico + black = 79,90 + 30 = 109,90', comboBlack.valorTotal === 109.90);
  const comboUpgrade = montarCombo('gamer', { upgrade: true });
  assert('gamer + upgrade = 680 Mega, R$ 119,90', comboUpgrade.pacoteFinalMega === 680 && comboUpgrade.valorTotal === 119.90);
  const comboTudo = montarCombo('basico', { yellow: true, black: true, upgrade: true });
  assert('básico com tudo marcado = 89,90(240) + 15 + 30 = 134,90', comboTudo.valorTotal === 134.90 && comboTudo.pacoteFinalMega === 240);
  const comboSemUpgrade = montarCombo('gamer', { upgrade: false });
  assert('upgrade não marcado mantém pacote do perfil', comboSemUpgrade.pacoteFinalMega === 420);
  assert('input hostil em opcoes (strings truthy) não vira boolean solto', montarCombo('gamer', { yellow: 'sim' }).yellow === false);

  console.log('\nfmtMoeda');
  assert('formata com vírgula e duas casas', fmtMoeda(99.9) === 'R$ 99,90');
  assert('formata valor inteiro', fmtMoeda(30) === 'R$ 30,00');

  // ─── perguntasPadrao (D-075) ─────────────────────────────────────────────

  console.log('\nperguntasPadrao');
  const padrao = perguntasPadrao();
  assert('mesmo total de perguntas do molde', padrao.length === PERGUNTAS_SIMULADOR.length);
  assert('formato novo: id/texto/opcoes[].id/.texto/.peso', padrao.every(p => p.id && p.texto && Array.isArray(p.opcoes) && p.opcoes.every(o => o.id && o.texto && typeof o.peso === 'number')));
  assert('ids de pergunta batem com as keys do molde legado', padrao.map(p => p.id).join(',') === PERGUNTAS_SIMULADOR.map(p => p.key).join(','));
  assert('cópia independente — editar uma não afeta a próxima chamada', (() => {
    const a = perguntasPadrao();
    a[0].texto = 'MUDEI';
    const b = perguntasPadrao();
    return b[0].texto !== 'MUDEI';
  })());
  assert('sem internet pesa 30 no molde padrão', padrao.find(p => p.id === 'tem_internet').opcoes.find(o => o.id === 'nao').peso === 30);

  // ─── normalizarRespostasDinamico (input hostil, por campanha) ───────────

  console.log('\nnormalizarRespostasDinamico');
  const perguntasTeste = [
    { id: 'q1', texto: 'Pergunta 1', tipo: 'single', opcoes: [{ id: 'a', texto: 'A', peso: 0 }, { id: 'b', texto: 'B', peso: 10 }] },
    { id: 'q2', texto: 'Pergunta 2', tipo: 'multi', opcoes: [{ id: 'x', texto: 'X', peso: 5 }, { id: 'y', texto: 'Y', peso: 5 }] },
  ];
  assert('perguntas não-array vira vazio', Object.keys(normalizarRespostasDinamico(null, { q1: 'a' })).length === 0);
  assert('input não-objeto vira vazio', Object.keys(normalizarRespostasDinamico(perguntasTeste, null)).length === 0);
  assert('id de pergunta desconhecido é descartado', !('hack' in normalizarRespostasDinamico(perguntasTeste, { hack: 'x', q1: 'a' })));
  assert('opção inválida em single é descartada', !('q1' in normalizarRespostasDinamico(perguntasTeste, { q1: 'DROP TABLE' })));
  assert('opção válida em single passa', normalizarRespostasDinamico(perguntasTeste, { q1: 'b' }).q1 === 'b');
  assert('multi filtra opções inválidas', normalizarRespostasDinamico(perguntasTeste, { q2: ['x', '<script>'] }).q2.join(',') === 'x');
  assert('multi com só inválidas é descartado', !('q2' in normalizarRespostasDinamico(perguntasTeste, { q2: ['z'] })));
  assert('single com array é descartado', !('q1' in normalizarRespostasDinamico(perguntasTeste, { q1: ['a'] })));

  // ─── calcularPerfilDinamico (soma de pesos + temperatura percentual) ───

  console.log('\ncalcularPerfilDinamico');
  assert('sem perguntas → pontuação 0, frio', (() => { const p = calcularPerfilDinamico([], {}); return p.pontuacao === 0 && p.pontuacaoMaxima === 0 && p.temperatura === 'frio'; })());
  const p1 = calcularPerfilDinamico(perguntasTeste, { q1: 'b' }); // 10 de 10(q1) + 10(q2 max) = 10/20 = 50%
  assert('single: soma o peso da opção escolhida', p1.pontuacao === 10);
  assert('máxima soma o maior peso de single + soma total de multi', p1.pontuacaoMaxima === 20); // max(0,10)=10 + (5+5)=10
  assert('50% → morno (30–59%)', p1.temperatura === 'morno');
  const p2 = calcularPerfilDinamico(perguntasTeste, { q1: 'b', q2: ['x', 'y'] }); // 10+5+5=20 de 20 = 100%
  assert('multi soma todas as opções marcadas', p2.pontuacao === 20);
  assert('100% → quente', p2.temperatura === 'quente');
  const p3 = calcularPerfilDinamico(perguntasTeste, { q1: 'a' }); // 0 de 20 = 0%
  assert('0% → frio', p3.temperatura === 'frio');
  assert('não responder nada não quebra (pontuação 0)', calcularPerfilDinamico(perguntasTeste, {}).pontuacao === 0);

  console.log('\ncalcularPerfilDinamico — replica o molde padrão (equivalência com o scoring antigo)');
  const quente = calcularPerfilDinamico(padrao, { tem_internet: 'nao', usos: ['streaming', 'jogos', 'home_office'], moradores: '5_mais' });
  assert('perfil pesado sem internet → pontuação alta e quente', quente.pontuacao === 30 + 8 + 8 + 8 + 10 && quente.temperatura === 'quente');
  const frioPadrao = calcularPerfilDinamico(padrao, { tem_internet: 'sim', dificuldade: 'satisfeito', usos: ['redes'], moradores: '1' });
  assert('satisfeito + uso leve → 0 pontos, frio', frioPadrao.pontuacao === 0 && frioPadrao.temperatura === 'frio');

  // ─── Resumo legível ─────────────────────────────────────────────────────

  console.log('\nresumoPerfil — leads novos (snapshot de perguntas, D-075)');
  assert('perfil vazio → resumo vazio', resumoPerfil(null).length === 0 && resumoPerfil({}).length === 0);
  const respostasNovas = normalizarRespostasDinamico(padrao, { moradores: '2_4', usos: ['streaming', 'jogos'], tem_internet: 'nao' });
  const resumoNovo = resumoPerfil({ versao: 2, perguntas: padrao, respostas: respostasNovas });
  assert('resumo usa textos do snapshot', resumoNovo.includes('2 a 4 pessoas') && resumoNovo.includes('Jogos online'));

  console.log('\nresumoPerfil — leads legados (catálogo fixo, sem snapshot, D-072)');
  const respostasLegadas = { moradores: '2_4', usos: ['streaming', 'jogos'], tem_internet: 'nao' };
  const resumoLegado = resumoPerfil({ versao: 1, respostas: respostasLegadas });
  assert('resumo usa labels do catálogo legado', resumoLegado.includes('2 a 4 pessoas') && resumoLegado.includes('Jogos online'));
  assert('sem internet vira "Sem internet hoje" (só no formato legado)', resumoLegado.includes('Sem internet hoje'));

  console.log('\nresumoPerfil — perfil + combo (D-074, comum aos dois formatos)');
  const resumoComCombo = resumoPerfil({
    versao: 2, perguntas: padrao, respostas: respostasNovas, perfil: 'gamer',
    combo: montarCombo('gamer', { yellow: true, upgrade: true }),
  });
  assert('inclui label do perfil escolhido', resumoComCombo.includes('Perfil: Gamer / Casa Conectada'));
  assert('inclui pacote final com marca de upgrade', resumoComCombo.includes('Pacote: 680 Mega (upgrade)'));
  assert('inclui add-on marcado', resumoComCombo.includes('+ Apps Yellow'));
  assert('não inclui add-on não marcado', !resumoComCombo.includes('+ Apps Black'));
  assert('inclui total formatado (420→99,90 + yellow 15 + upgrade delta 20 = 134,90)', resumoComCombo.includes('Total: R$ 134,90/mês'));
  assert('perfil inválido não quebra (chave desconhecida ignorada)', resumoPerfil({ perfil: 'hack' }).length === 0);

  // ─── Resultado ──────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Resultado: ${passed} passou | ${failed} falhou`);
  if (failed > 0) process.exit(1);
})();
