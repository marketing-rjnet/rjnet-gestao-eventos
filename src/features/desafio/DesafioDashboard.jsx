import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { Kpi } from '../../components/ui';
import { centesimosParaTempo, formatarDiferenca } from '../../lib/desafioCronometro';
import { exportDesafioEntriesCSV } from '../../utils/csv';

// Desafio RJNet — Acerte 00:03:33 (D-089): painel administrativo do dia —
// KPIs, últimos cadastrados, participantes por dia (agrupado por data
// local, mesmo cuidado de MesDetail.jsx pra não virar o dia errado perto
// da meia-noite) e exportação CSV. Toda estatística é derivada só das
// participações desse `event_id` (nunca mistura dias).
export function DesafioDashboard({ desafio, entries }) {
  const { desafios } = useApp();

  const stats = useMemo(() => {
    const total = entries.length;
    const ganhadores = entries.filter((e) => e.isExactHit).length;
    const naoExatos = entries.filter((e) => !e.isExactHit);
    const menorDiferenca = naoExatos.length ? Math.min(...naoExatos.map((e) => e.differenceCentiseconds)) : null;
    const mediaCentesimos = total ? Math.round(entries.reduce((acc, e) => acc + e.resultCentiseconds, 0) / total) : null;
    const porDia = {};
    for (const e of entries) {
      const key = new Date(e.criadoEm).toLocaleDateString('pt-BR');
      porDia[key] = (porDia[key] || 0) + 1;
    }
    const ultimos = [...entries].sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)).slice(0, 8);
    return { total, ganhadores, menorDiferenca, mediaCentesimos, porDia, ultimos };
  }, [entries]);

  const exportar = () => exportDesafioEntriesCSV(entries, desafio.nome, formatarDiferenca);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grid-kpi-3">
        <Kpi label="Participantes" value={stats.total} icon="users" />
        <Kpi label="Ganhadores instantâneos" value={stats.ganhadores} icon="trophy" />
        <Kpi label="Menor diferença" value={stats.menorDiferenca != null ? centesimosParaTempo(stats.menorDiferenca) : '—'} icon="target" />
      </div>
      <div className="grid-kpi-3">
        <Kpi label="Média dos tempos" value={stats.mediaCentesimos != null ? centesimosParaTempo(stats.mediaCentesimos) : '—'} icon="chart" />
        <Kpi label="Dia" value={desafio.nome} icon="calendar" />
        <Kpi label="Alvo" value={centesimosParaTempo(desafio.targetCentiseconds)} icon="target" />
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span className="section-title">Últimos participantes cadastrados</span>
          <button type="button" className="btn-primary" style={{ fontSize: 12 }} onClick={exportar} disabled={entries.length === 0}>
            ⬇️ Exportar CSV
          </button>
        </div>
        {stats.ultimos.length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}>Nenhum participante ainda.</div>
        ) : (
          <div className="tbl-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>Nº</th><th>Nome</th><th>Tempo</th><th>Status</th><th>Cadastrado em</th></tr></thead>
              <tbody>
                {stats.ultimos.map((e) => (
                  <tr key={e.id}>
                    <td>{e.participantNumber}</td>
                    <td>{e.participantName}</td>
                    <td className="mono">{e.resultDisplay}</td>
                    <td>{e.isExactHit ? '🏆 Ganhador' : centesimosParaTempo(e.differenceCentiseconds)}</td>
                    <td>{new Date(e.criadoEm).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <span className="section-title">Participantes por dia</span>
        {Object.keys(stats.porDia).length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}>Sem dados ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {Object.entries(stats.porDia).map(([dia, qtd]) => (
              <div key={dia} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{dia}</span>
                <span className="strong">{qtd}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {desafios.length > 1 && (
        <p className="campo-hint">
          Este painel mostra só o dia "{desafio.nome}" — cada dia do desafio tem estatísticas totalmente independentes.
        </p>
      )}
    </div>
  );
}
