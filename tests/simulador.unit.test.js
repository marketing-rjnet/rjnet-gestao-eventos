/**
 * Testes unitários do Simulador de Perfil de Consumo:
 * - normalização de respostas (input hostil de formulário público)
 * - cálculo de pontuação e temperatura
 * - recomendação (nível + serviços de interesse)
 * - resumo legível do perfil
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
    PERGUNTAS_SIMULADOR, PERGUNTAS_SIMULADOR_VERSAO, normalizarRespostas, calcularPerfil, perguntasVisiveis, resumoPerfil,
    PACOTES_INTERNET, APPS_ADICIONAIS, PERFIS_SIMULADOR, pacotePorMega, pacoteUpgrade, perfilPorKey, montarCombo, fmtMoeda,
  } = mod;

  // ─── Catálogo ───────────────────────────────────────────────────────────

  console.log('\ncatálogo de perguntas');
  assert('versão do catálogo definida', PERGUNTAS_SIMULADOR_VERSAO === 1);
  assert('5 perguntas no catálogo v1', PERGUNTAS_SIMULADOR.length === 5);
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

  // ─── Perguntas condicionais ─────────────────────────────────────────────

  console.log('\nperguntasVisiveis');
  assert('sem respostas, dificuldade fica oculta', !perguntasVisiveis({}).some(p => p.key === 'dificuldade'));
  assert('com internet, dificuldade aparece', perguntasVisiveis({ tem_internet: 'sim' }).some(p => p.key === 'dificuldade'));
  assert('sem internet, dificuldade não aparece', !perguntasVisiveis({ tem_internet: 'nao' }).some(p => p.key === 'dificuldade'));

  // ─── Normalização (input hostil) ────────────────────────────────────────

  console.log('\nnormalizarRespostas');
  assert('input não-objeto vira vazio', Object.keys(normalizarRespostas(null)).length === 0 && Object.keys(normalizarRespostas('x')).length === 0);
  assert('chave fora do catálogo é descartada', !('hack' in normalizarRespostas({ hack: 'x', moradores: '2_4' })));
  assert('opção inválida em single é descartada', !('moradores' in normalizarRespostas({ moradores: 'DROP TABLE' })));
  assert('opção válida em single passa', normalizarRespostas({ moradores: '2_4' }).moradores === '2_4');
  assert('multi filtra opções inválidas', normalizarRespostas({ usos: ['jogos', '<script>', 'streaming'] }).usos.join(',') === 'jogos,streaming');
  assert('multi com só inválidas é descartado', !('usos' in normalizarRespostas({ usos: ['x', 'y'] })));
  assert('single com array é descartado', !('moradores' in normalizarRespostas({ moradores: ['2_4'] })));
  assert('dificuldade sem tem_internet=sim é descartada', !('dificuldade' in normalizarRespostas({ dificuldade: 'lenta', tem_internet: 'nao' })));
  assert('dificuldade com tem_internet=sim passa', normalizarRespostas({ dificuldade: 'lenta', tem_internet: 'sim' }).dificuldade === 'lenta');

  // ─── Scoring ────────────────────────────────────────────────────────────

  console.log('\ncalcularPerfil — pontuação');
  assert('respostas vazias → pontuação 0, frio', (() => { const p = calcularPerfil({}); return p.pontuacao === 0 && p.temperatura === 'frio'; })());
  assert('sem internet soma 30', calcularPerfil({ tem_internet: 'nao' }).pontuacao === 30);
  assert('dor ativa (oscilação) soma 20', calcularPerfil({ tem_internet: 'sim', dificuldade: 'oscilacao' }).pontuacao === 20);
  assert('preço soma 15', calcularPerfil({ tem_internet: 'sim', dificuldade: 'preco' }).pontuacao === 15);
  assert('satisfeito subtrai (clamp em 0)', calcularPerfil({ tem_internet: 'sim', dificuldade: 'satisfeito' }).pontuacao === 0);
  assert('cada uso de alta demanda soma 8 (redes/estudos não)', calcularPerfil({ usos: ['jogos', 'home_office', 'redes', 'estudos'] }).pontuacao === 16);
  assert('5+ moradores soma 10', calcularPerfil({ moradores: '5_mais' }).pontuacao === 10);
  assert('2 a 4 moradores soma 5', calcularPerfil({ moradores: '2_4' }).pontuacao === 5);
  assert('3+ equipamentos soma 5', calcularPerfil({ equipamentos: ['smart_tv', 'pc', 'celular'] }).pontuacao === 5);
  assert('2 equipamentos não soma', calcularPerfil({ equipamentos: ['smart_tv', 'pc'] }).pontuacao === 0);

  console.log('\ncalcularPerfil — temperatura');
  const quente = calcularPerfil({ tem_internet: 'nao', usos: ['streaming', 'jogos', 'home_office'], moradores: '5_mais' }); // 30+24+10 = 64
  assert('perfil pesado sem internet → quente (>=60)', quente.pontuacao === 64 && quente.temperatura === 'quente');
  const morno = calcularPerfil({ tem_internet: 'sim', dificuldade: 'lenta', usos: ['streaming'], moradores: '2_4' }); // 20+8+5 = 33
  assert('dor ativa + uso médio → morno (30–59)', morno.pontuacao === 33 && morno.temperatura === 'morno');
  const frio = calcularPerfil({ tem_internet: 'sim', dificuldade: 'satisfeito', usos: ['redes'], moradores: '1' }); // 0
  assert('satisfeito + uso leve → frio (<30)', frio.pontuacao === 0 && frio.temperatura === 'frio');

  console.log('\ncalcularPerfil — recomendação');
  assert('oferta recomendada é sempre um serviço válido', calcularPerfil({}).ofertaRecomendada === 'internet_residencial');
  assert('interesse base é residencial', calcularPerfil({}).servicosInteresse.join(',') === 'internet_residencial');
  assert('streaming declarado vira interesse secundário', calcularPerfil({ usos: ['streaming'] }).servicosInteresse.join(',') === 'internet_residencial,streamings');

  // ─── Resumo legível ─────────────────────────────────────────────────────

  console.log('\nresumoPerfil');
  assert('perfil vazio → resumo vazio', resumoPerfil(null).length === 0 && resumoPerfil({}).length === 0);
  const perfil = calcularPerfil({ moradores: '2_4', usos: ['streaming', 'jogos'], tem_internet: 'nao' });
  const resumo = resumoPerfil({ versao: 1, respostas: perfil.respostas });
  assert('resumo usa labels do catálogo', resumo.includes('2 a 4 pessoas') && resumo.includes('Jogos online'));
  assert('sem internet vira "Sem internet hoje"', resumo.includes('Sem internet hoje'));

  console.log('\nresumoPerfil — perfil + combo (D-074)');
  const resumoComCombo = resumoPerfil({
    versao: 1, respostas: perfil.respostas, perfil: 'gamer',
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
