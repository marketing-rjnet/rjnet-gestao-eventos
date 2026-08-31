import React, { useEffect, useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { DesafioCadastro } from './DesafioCadastro';
import { DesafioRanking } from './DesafioRanking';
import { DesafioGanhadores } from './DesafioGanhadores';
import { DesafioDashboard } from './DesafioDashboard';
import { DesafioQrLink } from './DesafioQrLink';
import { DesafioPremio } from './DesafioPremio';
import { DesafioPremiosRanking } from './DesafioPremiosRanking';

const SUB_TABS = [
  { id: 'cadastro',   label: 'Cadastro',   ico: 'edit' },
  { id: 'ranking',    label: 'Ranking',    ico: 'chart' },
  { id: 'ganhadores', label: 'Ganhadores', ico: 'trophy' },
  { id: 'premio',     label: 'Prêmio',     ico: 'gift' },
  { id: 'dashboard',  label: 'Painel',     ico: 'activity' },
  { id: 'tv',         label: 'Tela de TV', ico: 'tv' },
];

// Desafio RJNet — Acerte 00:03:33 (D-089): detalhe de UM dia — carrega as
// participações desse dia on-demand (mesmo modelo de EventDetail.jsx) e
// nunca mistura com outro dia (toda leitura do array `desafioEntries` já
// vem filtrada pelo backend por event_id).
// D-101: `subTabs`/`initialSub` opcionais — permitem ao comercial reaproveitar
// este mesmo componente restrito só ao "Painel" (leitura + export CSV, ver
// DesafioComercialTab.jsx), sem duplicar a lógica de carregamento/navegação.
// Marketing não passa essas props e continua vendo as 6 sub-abas de sempre.
export function DesafioDetail({ desafio, onBack, subTabs = SUB_TABS, initialSub = 'cadastro' }) {
  const { carregarDesafioEntries, desafioEntries } = useApp();
  const [sub, setSub] = useState(initialSub);

  useEffect(() => { carregarDesafioEntries(desafio.id); }, [desafio.id]);

  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="btn-ghost" onClick={onBack}><Icon name="back" size={16} /> Voltar</button>
        <div>
          <div className="page-title">{desafio.nome}</div>
        </div>
      </div>

      <div className="seg-control" style={{ marginTop: 14, gridTemplateColumns: `repeat(${subTabs.length}, 1fr)` }}>
        {subTabs.map((t) => (
          <button key={t.id} type="button" className={'seg-btn' + (sub === t.id ? ' active' : '')} onClick={() => setSub(t.id)}>
            <Icon name={t.ico} size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {sub === 'cadastro' && <DesafioCadastro desafio={desafio} entries={desafioEntries} />}
        {sub === 'ranking' && <DesafioRanking desafio={desafio} entries={desafioEntries} />}
        {sub === 'ganhadores' && <DesafioGanhadores desafio={desafio} entries={desafioEntries} />}
        {sub === 'premio' && (
          <>
            <DesafioPremio desafio={desafio} />
            <DesafioPremiosRanking desafio={desafio} />
          </>
        )}
        {sub === 'dashboard' && <DesafioDashboard desafio={desafio} entries={desafioEntries} />}
        {sub === 'tv' && <DesafioQrLink desafio={desafio} />}
      </div>
    </div>
  );
}
