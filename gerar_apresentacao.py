#!/usr/bin/env python3
"""Gerador de apresentação executiva - RJNET - GESTÃO DE EVENTOS."""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
import datetime

# Registrar fontes TTF com suporte a acentos portugueses
FONT_REG  = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
pdfmetrics.registerFont(TTFont("LS",  FONT_REG))
pdfmetrics.registerFont(TTFont("LSB", FONT_BOLD))

# Cores corporativas
AMARELO   = colors.HexColor("#F5C000")
PRETO     = colors.HexColor("#0D0D0D")
CINZA_ESC = colors.HexColor("#1A1A1A")
CINZA_CLA = colors.HexColor("#F4F4F4")
BRANCO    = colors.white
VERDE     = colors.HexColor("#22C55E")

W, H = A4

NOME_SISTEMA = "RJNET - GESTÃO DE EVENTOS"
NOME_EMPRESA = "RJNET"


# ── Flowable: linha colorida ───────────────────────────────────────────────
class ColorLine(Flowable):
    def __init__(self, color=AMARELO, width=None, thickness=2):
        super().__init__()
        self.color = color
        self._width = width
        self.thickness = thickness

    def wrap(self, aW, aH):
        self.width = self._width or aW
        return self.width, self.thickness + 2

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, self.width, 0)


# ── Estilos ────────────────────────────────────────────────────────────────
def build_styles():
    base = ParagraphStyle("base", fontName="LS", fontSize=10,
                          leading=15, textColor=PRETO)
    return {
        "slide_num": ParagraphStyle("slide_num", parent=base, fontSize=9,
                                    textColor=colors.HexColor("#999999"),
                                    alignment=TA_RIGHT),
        "h1": ParagraphStyle("h1", parent=base, fontName="LSB",
                             fontSize=26, leading=32, textColor=PRETO, spaceAfter=4),
        "h2": ParagraphStyle("h2", parent=base, fontName="LSB",
                             fontSize=18, leading=24, textColor=PRETO,
                             spaceBefore=6, spaceAfter=4),
        "h3": ParagraphStyle("h3", parent=base, fontName="LSB",
                             fontSize=12, leading=17, textColor=PRETO,
                             spaceBefore=4, spaceAfter=2),
        "h3_am": ParagraphStyle("h3_am", parent=base, fontName="LSB",
                                fontSize=12, leading=17, textColor=AMARELO,
                                spaceBefore=4, spaceAfter=2),
        "body": ParagraphStyle("body", parent=base, fontSize=10, leading=15,
                               textColor=colors.HexColor("#222222"),
                               alignment=TA_JUSTIFY),
        "bullet": ParagraphStyle("bullet", parent=base, fontSize=10, leading=15,
                                 textColor=colors.HexColor("#222222"),
                                 leftIndent=12, spaceBefore=2),
        "label": ParagraphStyle("label", parent=base, fontName="LSB",
                                fontSize=8.5, textColor=colors.HexColor("#888888"),
                                spaceAfter=1),
    }


S = build_styles()


def p(text, style="body", **kw):
    """Shorthand para Paragraph com bold/italic via tags HTML."""
    return Paragraph(text, S[style])


def sp(n=6):
    return Spacer(1, n)


# ── Rodapé ─────────────────────────────────────────────────────────────────
def add_page_num(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("LS", 8)
    canvas_obj.setFillColor(colors.HexColor("#AAAAAA"))
    canvas_obj.drawRightString(W - 1.5*cm, 1*cm, f"Página {doc.page}")
    canvas_obj.drawString(1.5*cm, 1*cm,
                          f"{NOME_SISTEMA} — Documento Confidencial")
    canvas_obj.setStrokeColor(colors.HexColor("#EEEEEE"))
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(1.5*cm, 1.35*cm, W - 1.5*cm, 1.35*cm)
    canvas_obj.restoreState()


# ── Cabeçalho de slide ─────────────────────────────────────────────────────
def slide_header(num, title):
    return [
        p(f"Slide {num}", "slide_num"),
        sp(2),
        ColorLine(AMARELO, thickness=3),
        sp(8),
        p(title, "h2"),
        sp(6),
    ]


# ── Tabela padrão ──────────────────────────────────────────────────────────
def make_table(data, col_widths, font_size=10):
    # Converte strings em Paragraphs para suporte a acentos
    def cell(v, bold=False):
        if isinstance(v, str):
            fn = "LSB" if bold else "LS"
            return Paragraph(v, ParagraphStyle("tc", fontName=fn,
                             fontSize=font_size, leading=font_size+4,
                             textColor=BRANCO if bold else PRETO))
        return v

    fmt = []
    for ri, row in enumerate(data):
        fmt.append([cell(c, bold=(ri == 0)) for c in row])

    ts = TableStyle([
        ("BACKGROUND",    (0, 0), (-1,  0), CINZA_ESC),
        ("TEXTCOLOR",     (0, 0), (-1,  0), AMARELO),
        ("FONTNAME",      (0, 0), (-1,  0), "LSB"),
        ("FONTSIZE",      (0, 0), (-1,  0), font_size),
        ("BOTTOMPADDING", (0, 0), (-1,  0), 7),
        ("TOPPADDING",    (0, 0), (-1,  0), 7),
        ("FONTNAME",      (0, 1), (-1, -1), "LS"),
        ("FONTSIZE",      (0, 1), (-1, -1), font_size),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("TOPPADDING",    (0, 1), (-1, -1), 5),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [BRANCO, CINZA_CLA]),
        ("GRID",          (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ])
    t = Table(fmt, colWidths=col_widths)
    t.setStyle(ts)
    return t


# ── Tabela de ícone + texto (KPI) ──────────────────────────────────────────
def kpi_table(items):
    rows = []
    for icon, label, desc in items:
        rows.append([
            Paragraph(icon, ParagraphStyle("ic", fontName="LSB",
                      fontSize=16, textColor=AMARELO, alignment=TA_CENTER)),
            Paragraph(
                f"<b>{label}</b><br/>"
                f"<font size='9' color='#555555'>{desc}</font>",
                ParagraphStyle("kd", fontName="LSB", fontSize=10.5,
                               leading=14, textColor=PRETO)),
        ])
    ts = TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [CINZA_CLA, BRANCO]),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.3, colors.HexColor("#DDDDDD")),
    ])
    t = Table(rows, colWidths=[1.2*cm, 14*cm])
    t.setStyle(ts)
    return t


# ── Info card (label | texto) ──────────────────────────────────────────────
def info_card(rows_data):
    elems = []
    for titulo, texto in rows_data:
        t = Table(
            [[p(titulo, "label"), p(texto)]],
            colWidths=[4.5*cm, 11.2*cm],
        )
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, 0), CINZA_CLA),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("LINEBELOW",     (0, 0), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
        ]))
        elems.append(t)
    return elems


# ══════════════════════════════════════════════════════════════════════════════
# DOCUMENTO
# ══════════════════════════════════════════════════════════════════════════════
def build_pdf():
    path = "/home/user/rjnet-gestao-eventos/RJNET_Gestao_Eventos_Apresentacao_Executiva.pdf"
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=1.8*cm,  bottomMargin=2*cm,
        title=f"{NOME_SISTEMA} — Apresentação Executiva",
        author=NOME_EMPRESA,
    )

    story = []

    # ── CAPA ───────────────────────────────────────────────────────────────
    class CoverPage(Flowable):
        def wrap(self, aW, aH):
            return aW, aH

        def draw(self):
            c = self.canv
            c.setFillColor(PRETO)
            c.rect(0, 0, W, H, fill=1, stroke=0)
            c.setFillColor(AMARELO)
            c.rect(0, 0, 8, H, fill=1, stroke=0)
            c.setFillColor(AMARELO)
            c.rect(0, H - 6, W, 6, fill=1, stroke=0)

            c.setFillColor(BRANCO)
            c.setFont("LSB", 42)
            c.drawString(2*cm, H - 5.5*cm, "RJNET")
            c.setFont("LSB", 20)
            c.drawString(2*cm, H - 7*cm, "GESTÃO DE EVENTOS")

            c.setStrokeColor(AMARELO)
            c.setLineWidth(2)
            c.line(2*cm, H - 7.8*cm, W - 2*cm, H - 7.8*cm)

            c.setFillColor(colors.HexColor("#DDDDDD"))
            c.setFont("LS", 13)
            c.drawString(2*cm, H - 8.8*cm,
                         "Apresentação Executiva do Sistema de Gerenciamento")

            c.setFillColor(AMARELO)
            c.setFont("LSB", 10)
            hoje = datetime.date.today().strftime("%B de %Y").capitalize()
            c.drawString(2*cm, H - 9.7*cm, f"Versão {hoje}")

            c.setFillColor(colors.HexColor("#AAAAAA"))
            c.setFont("LS", 9)
            temas = [
                "Visão Geral do Produto",
                "Perfis de Usuário",
                "Módulos do Sistema",
                "Indicadores e Relatórios",
                "Benefícios para o Negócio",
            ]
            y = H - 11.8*cm
            for t in temas:
                c.drawString(2*cm, y, f"▸  {t}")
                y -= 0.55*cm

            c.setFillColor(AMARELO)
            c.setFont("LSB", 18)
            c.drawString(2*cm, 3*cm, "RJNET")
            c.setFillColor(BRANCO)
            c.setFont("LS", 10)
            c.drawString(2*cm, 2.3*cm, "Documento Confidencial — Uso Interno")

    story.append(CoverPage())
    story.append(PageBreak())

    # ── SUMÁRIO ────────────────────────────────────────────────────────────
    story.append(p("Sumário", "h1"))
    story.append(ColorLine(AMARELO, thickness=3))
    story.append(sp(14))

    sumario_items = [
        ("01", "Visão Geral do Sistema"),
        ("02", "Fluxo Geral da Operação"),
        ("03", "Perfis de Usuário"),
        ("04", "Módulo Dashboard"),
        ("05", "Módulo Eventos"),
        ("06", "Módulo Estoque"),
        ("07", "Módulo Leads"),
        ("08", "Módulo Check-in"),
        ("09", "Módulo Equipe"),
        ("10", "Aplicativo do Vendedor"),
        ("11", "Indicadores e Relatórios"),
        ("12", "Integração e Sincronização"),
        ("13", "Benefícios para o Negócio"),
        ("14", "Resumo Executivo"),
    ]
    for num, titulo in sumario_items:
        row = Table(
            [[Paragraph(f"<font color='#F5C000'><b>{num}</b></font>", S["body"]),
              Paragraph(titulo, S["body"])]],
            colWidths=[1.5*cm, 14*cm],
        )
        row.setStyle(TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING",    (0,0), (-1,-1), 5),
            ("LINEBELOW",     (0,0), (-1, 0), 0.3, colors.HexColor("#DDDDDD")),
        ]))
        story.append(row)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 01 — VISÃO GERAL
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("01", "Visão Geral do Sistema")
    story.append(p(
        "O <b>RJNET — Gestão de Eventos</b> é a plataforma central que a RJNET utiliza para "
        "planejar, executar e monitorar suas ações comerciais em campo. O sistema conecta "
        "a equipe de marketing aos vendedores, centralizando em um único lugar tudo o que "
        "acontece antes, durante e depois de cada evento."
    ))
    story.append(sp(10))
    story += info_card([
        ["Objetivo Principal",
         "Gerenciar eventos comerciais da RJNET de ponta a ponta: desde o planejamento "
         "e alocação de materiais até a captação de leads e acompanhamento de resultados."],
        ["Problema Resolvido",
         "Elimina o uso de planilhas e processos manuais dispersos, reunindo controle de "
         "equipe, estoque de materiais, captação de leads e relatórios em um único sistema "
         "acessível de qualquer dispositivo."],
        ["Público que Utiliza",
         "Time de Marketing (gestão completa) e Equipe Comercial/Vendedores "
         "(registro de leads e consulta de informações do evento)."],
        ["Como é Acessado",
         "Via navegador de internet — computador, tablet ou celular — sem necessidade "
         "de instalação de aplicativo."],
    ])
    story.append(sp(12))
    story.append(p("Principais Capacidades do Sistema", "h3"))
    story.append(sp(6))
    story.append(kpi_table([
        ("📅", "Gestão de Eventos",       "Cadastro, acompanhamento e encerramento de eventos comerciais"),
        ("📦", "Controle de Estoque",     "Gerenciamento de materiais promocionais com alertas automáticos"),
        ("👥", "Captação de Leads",       "Registro rápido de potenciais clientes diretamente no campo"),
        ("📊", "Relatórios em Tempo Real","KPIs, gráficos e rankings atualizados automaticamente"),
        ("🔍", "Check-in por CPF",        "Verificação instantânea de participantes cadastrados"),
        ("🏆", "Ranking da Equipe",       "Placar de desempenho visível para toda a equipe em tempo real"),
    ]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 02 — FLUXO GERAL
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("02", "Fluxo Geral da Operação")
    story.append(p(
        "O sistema acompanha toda a jornada de um evento comercial, do planejamento "
        "ao fechamento. Abaixo está o fluxo completo de como a operação funciona na prática:"
    ))
    story.append(sp(12))

    etapas = [
        ("1", "PLANEJAMENTO",
         "O time de marketing cadastra o evento com local, datas, tipo e observações. "
         "São definidos quais materiais serão levados para o campo."),
        ("2", "PREPARAÇÃO",
         "Os materiais promocionais são alocados ao evento. O sistema calcula "
         "automaticamente a disponibilidade do estoque e sinaliza itens em quantidade crítica."),
        ("3", "EVENTO EM CAMPO",
         "A equipe de vendas acessa o aplicativo no celular. Cada vendedor registra leads "
         "com nome, telefone, serviço de interesse e temperatura. O ranking é visível em tempo real."),
        ("4", "ACOMPANHAMENTO",
         "O marketing acompanha pelo dashboard os indicadores do evento: total de leads, "
         "performance por vendedor e serviços mais demandados."),
        ("5", "ENCERRAMENTO",
         "Ao final do evento, os materiais são confirmados como devolvidos ao estoque. "
         "O evento é finalizado no sistema, preservando todos os dados para análise."),
        ("6", "ANÁLISE E CONVERSÃO",
         "O time comercial acessa os leads capturados, filtra por serviço ou evento, "
         "acompanha a temperatura de cada contato e exporta os dados para o CRM ou planilha."),
    ]
    for num, titulo, texto in etapas:
        bloco = Table(
            [[Paragraph(f"<font color='#F5C000'><b>{num}</b></font>",
                        ParagraphStyle("etn", fontName="LSB", fontSize=18,
                                       textColor=AMARELO, alignment=TA_CENTER)),
              [p(f"<b>{titulo}</b>", "h3"), p(texto)]]],
            colWidths=[1.2*cm, 14.5*cm],
        )
        bloco.setStyle(TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "TOP"),
            ("BACKGROUND",    (0,0), (0, 0), CINZA_CLA),
            ("LEFTPADDING",   (0,0), (-1,-1), 10),
            ("RIGHTPADDING",  (0,0), (-1,-1), 10),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("LINEBELOW",     (0,0), (-1,-1), 0.5, AMARELO),
        ]))
        story.append(bloco)
        story.append(sp(4))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 03 — PERFIS DE USUÁRIO
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("03", "Perfis de Usuário")
    story.append(p(
        "O sistema possui dois perfis de acesso distintos, cada um com um conjunto de "
        "funcionalidades adequado à sua função na operação."
    ))
    story.append(sp(10))

    story.append(p("Perfil: Marketing (Administrador)", "h3_am"))
    story.append(ColorLine(AMARELO, thickness=1.5))
    story.append(sp(6))
    story.append(p(
        "Responsável pela gestão completa do sistema. Tem acesso irrestrito a todas "
        "as funcionalidades e informações."
    ))
    story.append(sp(6))
    story.append(make_table([
        ["Área", "O que pode fazer"],
        ["Eventos",    "Criar, editar, finalizar e excluir eventos"],
        ["Estoque",    "Cadastrar materiais, alocar por evento, confirmar devoluções"],
        ["Leads",      "Visualizar todos os leads, filtrar e exportar para CSV"],
        ["Equipe",     "Cadastrar, editar, ativar/desativar e excluir usuários"],
        ["Dashboard",  "Ver KPIs, gráficos e alertas de toda a operação"],
        ["Check-in",   "Verificar presença de participantes pelo CPF"],
        ["Relatórios", "Acompanhar desempenho por vendedor, evento e serviço"],
    ], [4*cm, 11.7*cm]))
    story.append(sp(12))

    story.append(p("Perfil: Vendedor (Equipe Comercial)", "h3"))
    story.append(ColorLine(colors.HexColor("#AAAAAA"), thickness=1.5))
    story.append(sp(6))
    story.append(p(
        "Focado na operação em campo. Acessa uma visão simplificada e otimizada para "
        "celular, com apenas as funções necessárias para registrar e gerenciar seus leads."
    ))
    story.append(sp(6))
    story.append(make_table([
        ["Área", "O que pode fazer"],
        ["Registrar Leads",      "Cadastrar novos leads com formulário rápido (modo rápido disponível)"],
        ["Meus Leads",           "Ver, editar e atualizar a temperatura dos próprios leads"],
        ["Informações do Evento","Consultar local, datas e detalhes do evento em curso"],
        ["Ranking da Equipe",    "Acompanhar o placar de todos os vendedores em tempo real"],
        ["Tabela de Pacotes",    "Consultar planos e preços da RJNET durante o atendimento"],
    ], [4*cm, 11.7*cm]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 04 — DASHBOARD
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("04", "Módulo Dashboard")
    story.append(p(
        "A tela inicial do marketing concentra os principais indicadores da operação, "
        "permitindo uma leitura rápida do desempenho geral sem necessidade de navegar "
        "por outros módulos."
    ))
    story.append(sp(10))

    story.append(p("Indicadores Exibidos (KPIs)", "h3"))
    story.append(sp(6))
    story.append(make_table([
        ["Indicador", "O que representa", "Para que serve"],
        ["Eventos Ativos",    "Quantidade de eventos em andamento no momento",           "Tomada de decisão sobre campo"],
        ["Total de Leads",    "Soma de todos os leads captados no sistema",              "Acompanhar resultado global"],
        ["Materiais Críticos","Itens de estoque sem disponibilidade (alerta em vermelho)","Agir sobre reposição urgente"],
        ["Vendedores Ativos", "Número de vendedores com acesso ativo ao sistema",        "Gestão de equipe"],
    ], [3.8*cm, 6.5*cm, 5.4*cm], font_size=9.5))
    story.append(sp(12))

    story.append(p("Gráfico: Leads por Serviço", "h3"))
    story.append(sp(4))
    story.append(p(
        "Gráfico em formato de rosca que exibe a distribuição dos leads por tipo de serviço "
        "de interesse. Mostra em proporção quantos leads demonstraram interesse em "
        "<b>Fibra Residencial</b>, <b>Fibra Empresarial</b>, <b>RJNET Móvel/Streamings</b> e "
        "<b>Outros</b>. Facilita a identificação de quais serviços têm maior demanda nos eventos."
    ))
    story.append(sp(12))

    story.append(p("Próximos Eventos", "h3"))
    story.append(sp(4))
    story.append(p(
        "Lista os próximos 3 eventos com data mais próxima, mostrando nome, período e "
        "status atual (Planejado ou Ativo). Permite à liderança ter visão antecipada "
        "da agenda de campo sem sair da tela principal."
    ))
    story.append(sp(12))

    story.append(p("Valor para o Negócio", "h3"))
    story.append(sp(6))
    story.append(kpi_table([
        ("📈", "Visão executiva instantânea", "Todos os números relevantes em uma única tela"),
        ("🔴", "Alertas automáticos",         "Materiais críticos destacados em vermelho para ação imediata"),
        ("📅", "Agenda antecipada",           "Próximos eventos visíveis sem precisar navegar"),
        ("🎯", "Foco na conversão",           "Distribuição de serviços orienta esforços comerciais"),
    ]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 05 — MÓDULO EVENTOS
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("05", "Módulo Eventos")
    story.append(p(
        "Central de controle de todos os eventos comerciais da RJNET. É neste módulo "
        "que a operação de campo tem início e encerramento formal."
    ))
    story.append(sp(10))

    story.append(p("Informações Registradas em Cada Evento", "h3"))
    story.append(sp(6))
    story.append(make_table([
        ["Campo", "Descrição"],
        ["Nome do Evento",      "Identificação do evento (ex.: Ação Centro — Junho)"],
        ["Local",               "Endereço completo onde o evento será realizado"],
        ["Data de Início e Fim","Período de realização do evento"],
        ["Tipo",                "Sinalização / Presença Comercial / Ativação Especial"],
        ["Status",              "Planejado, Ativo ou Encerrado"],
        ["Observações",         "Informações complementares para a equipe"],
    ], [5*cm, 10.7*cm]))
    story.append(sp(10))

    story.append(p("Ciclo de Vida do Evento", "h3"))
    story.append(sp(6))
    ciclo = Table(
        [[
            Paragraph("PLANEJADO\nEvento cadastrado,\nainda não iniciado",
                      ParagraphStyle("c1", fontName="LS", fontSize=9.5,
                                     leading=13, alignment=TA_CENTER)),
            Paragraph("▶",
                      ParagraphStyle("ar", fontName="LSB", fontSize=18,
                                     textColor=AMARELO, alignment=TA_CENTER)),
            Paragraph("ATIVO\nEvento em andamento,\nrecebe novos leads",
                      ParagraphStyle("c2", fontName="LS", fontSize=9.5,
                                     leading=13, alignment=TA_CENTER)),
            Paragraph("▶",
                      ParagraphStyle("ar2", fontName="LSB", fontSize=18,
                                     textColor=AMARELO, alignment=TA_CENTER)),
            Paragraph("ENCERRADO\nEvento finalizado,\ndados preservados",
                      ParagraphStyle("c3", fontName="LS", fontSize=9.5,
                                     leading=13, alignment=TA_CENTER)),
        ]],
        colWidths=[4.5*cm, 1.2*cm, 4.5*cm, 1.2*cm, 4.5*cm],
    )
    ciclo.setStyle(TableStyle([
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("BACKGROUND",    (0,0), (0, 0), colors.HexColor("#FFF9E0")),
        ("BACKGROUND",    (2,0), (2, 0), colors.HexColor("#F0FFF4")),
        ("BACKGROUND",    (4,0), (4, 0), CINZA_CLA),
        ("TOPPADDING",    (0,0), (-1,-1), 12),
        ("BOTTOMPADDING", (0,0), (-1,-1), 12),
        ("GRID",          (0,0), (-1,-1), 0.4, colors.HexColor("#CCCCCC")),
    ]))
    story.append(ciclo)
    story.append(sp(10))

    story.append(p("Gestão de Materiais por Evento", "h3"))
    story.append(sp(4))
    story.append(p(
        "Dentro de cada evento, é possível alocar materiais do estoque e acompanhar "
        "sua utilização. Ao final do evento, o sistema registra a devolução de cada "
        "item, reintegrando-o automaticamente ao estoque disponível."
    ))
    story.append(sp(8))

    story.append(p("Desempenho por Vendedor (dentro do evento)", "h3"))
    story.append(sp(4))
    story.append(p(
        "Cada evento exibe um gráfico de barras com a quantidade de leads captados "
        "por cada vendedor, além de uma tabela completa com todos os leads registrados "
        "naquele evento: nome, telefone, endereço, serviço de interesse e vendedor responsável."
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 06 — MÓDULO ESTOQUE
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("06", "Módulo Estoque")
    story.append(p(
        "Controle completo dos materiais promocionais utilizados nos eventos. O sistema "
        "calcula automaticamente a disponibilidade de cada item com base nos eventos "
        "ativos e em planejamento."
    ))
    story.append(sp(10))

    story.append(p("Painel de Resumo do Estoque", "h3"))
    story.append(sp(6))
    story.append(make_table([
        ["Indicador", "Significado"],
        ["Total de Tipos","Quantidade de tipos diferentes de materiais cadastrados"],
        ["Total de Itens","Soma de todas as unidades em estoque"],
        ["Em Campo",     "Itens atualmente alocados em eventos ativos ou planejados"],
    ], [5*cm, 10.7*cm]))
    story.append(sp(10))

    story.append(p("Classificação Automática por Disponibilidade", "h3"))
    story.append(sp(6))
    story.append(make_table([
        ["Status",   "Critério",                      "O que fazer"],
        ["CRÍTICO",  "Disponível = 0 unidades",        "Repor ou redistribuir urgentemente"],
        ["ATENÇÃO",  "Disponível entre 1 e 3 unidades","Monitorar e planejar reposição"],
        ["OK",       "Disponível 4 ou mais unidades",  "Estoque suficiente para próximos eventos"],
    ], [3*cm, 5.5*cm, 7.2*cm]))
    story.append(sp(10))

    story.append(p("Como Funciona o Fluxo de Materiais", "h3"))
    story.append(sp(6))
    for num, titulo, texto in [
        ("1", "Cadastro",  "Material é cadastrado com nome, quantidade total e descrição"),
        ("2", "Alocação",  "Marketing aloca quantidade ao evento — sistema desconta do disponível"),
        ("3", "Em Campo",  "Material sai para o evento — status do evento atualiza disponibilidade"),
        ("4", "Devolução", "Ao final do evento, devolução é confirmada — estoque retorna ao disponível"),
    ]:
        row = Table(
            [[Paragraph(f"<b>{num}</b>",
                        ParagraphStyle("fn", fontName="LSB", fontSize=13,
                                       textColor=AMARELO, alignment=TA_CENTER)),
              p(f"<b>{titulo}:</b> {texto}")]],
            colWidths=[0.9*cm, 14.8*cm],
        )
        row.setStyle(TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING",   (0,0), (-1,-1), 8),
            ("TOPPADDING",    (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("LINEBELOW",     (0,0), (-1,-1), 0.4, colors.HexColor("#EEEEEE")),
        ]))
        story.append(row)

    story.append(sp(10))
    story.append(p("Benefícios para a Operação", "h3"))
    story.append(sp(6))
    story.append(kpi_table([
        ("📦", "Visibilidade total","Sabe-se exatamente onde cada material está"),
        ("⚡", "Alerta proativo",   "Problemas de estoque identificados antes do evento"),
        ("🔄", "Ciclo fechado",     "Controle de ida e volta de todos os materiais"),
    ]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 07 — MÓDULO LEADS
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("07", "Módulo Leads")
    story.append(p(
        "Central de gestão de todos os contatos comerciais captados nos eventos. "
        "Permite visualizar, filtrar, analisar e exportar leads para continuidade "
        "do processo de vendas."
    ))
    story.append(sp(10))

    story.append(p("Informações Registradas em Cada Lead", "h3"))
    story.append(sp(6))
    story.append(make_table([
        ["Campo", "Descrição"],
        ["Nome Completo",       "Nome do potencial cliente"],
        ["Telefone",            "Número de contato (formatado automaticamente)"],
        ["CPF",                 "Documento de identificação (opcional)"],
        ["Endereço",            "Endereço do cliente (opcional)"],
        ["Serviço de Interesse","Fibra Residencial / Fibra Empresarial / RJNET Móvel / Streamings / Outro"],
        ["Temperatura",         "Frio / Morno / Quente / Convertido — grau de interesse do contato"],
        ["Já é Cliente RJNET?", "Indicador se o lead já possui algum serviço ativo"],
        ["Observação",          "Notas rápidas: aguardando visita, interesse em combo, etc."],
        ["Vendedor",            "Quem registrou o lead no evento"],
        ["Evento",              "Em qual evento o lead foi captado"],
    ], [5*cm, 10.7*cm], font_size=9.5))
    story.append(sp(10))

    story.append(p("Temperatura dos Leads", "h3"))
    story.append(sp(6))
    t_temp = Table([
        ["Frio",      "Demonstrou pouco interesse — contato inicial"],
        ["Morno",     "Interesse moderado — precisa de mais informações"],
        ["Quente",    "Alto interesse — pronto para próximo contato de vendas"],
        ["Convertido","Fechou contrato ou avançou para proposta concreta"],
    ], colWidths=[4*cm, 11.7*cm])
    t_temp.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (-1,-1), "LS"),
        ("FONTSIZE",      (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("ROWBACKGROUNDS",(0,0), (-1,-1), [CINZA_CLA, BRANCO]),
        ("LINEBELOW",     (0,0), (-1,-2), 0.3, colors.HexColor("#DDDDDD")),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("FONTNAME",      (0,0), (0, -1), "LSB"),
    ]))
    story.append(t_temp)
    story.append(sp(10))

    story.append(p("Filtros e Exportação", "h3"))
    story.append(sp(6))
    for txt in [
        "- Filtrar leads por <b>evento específico</b>",
        "- Filtrar por <b>vendedor</b>",
        "- Filtrar por <b>serviço de interesse</b>",
        "- <b>Exportar para CSV</b>: arquivo pronto para importação em CRM, planilha ou ferramenta de e-mail",
        "- Exportação inclui: nome, CPF, telefone, endereço, serviço, temperatura, "
          "se já é cliente, vendedor, evento, observação e data de cadastro",
    ]:
        story.append(Paragraph(txt, S["bullet"]))
        story.append(sp(3))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 08 — MÓDULO CHECK-IN
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("08", "Módulo Check-in")
    story.append(p(
        "Ferramenta de verificação rápida que permite confirmar se um participante "
        "já está cadastrado como lead em um evento específico, utilizando o CPF "
        "como chave de busca."
    ))
    story.append(sp(12))

    story.append(p("Como Funciona", "h3"))
    story.append(sp(6))
    for num, titulo, texto in [
        ("1", "Seleção do Evento",  "Escolha o evento para verificar os participantes"),
        ("2", "Digitação do CPF",   "Digite o CPF completo (confirmação exata) ou parcial (busca ampla)"),
        ("3", "Resultado Imediato", "O sistema retorna o resultado em segundos"),
    ]:
        row = Table(
            [[Paragraph(f"<b>{num}</b>",
                        ParagraphStyle("fn2", fontName="LSB", fontSize=16,
                                       textColor=AMARELO, alignment=TA_CENTER)),
              [p(f"<b>{titulo}</b>", "h3"), p(texto)]]],
            colWidths=[1.2*cm, 14.5*cm],
        )
        row.setStyle(TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING",   (0,0), (-1,-1), 10),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("BACKGROUND",    (0,0), (-1,-1), CINZA_CLA),
            ("LINEBELOW",     (0,0), (-1,-1), 0.5, BRANCO),
        ]))
        story.append(row)
        story.append(sp(4))

    story.append(sp(10))
    story.append(p("Tipos de Resultado", "h3"))
    story.append(sp(6))
    story.append(make_table([
        ["Resultado",          "Quando Ocorre",                    "Informações Exibidas"],
        ["Lead Encontrado",    "CPF completo localizado no evento",
         "Nome, CPF, telefone, endereço, serviço, temperatura, vendedor e data de cadastro"],
        ["Múltiplos Resultados","CPF parcial com mais de uma ocorrência",
         "Lista de nomes, CPFs e telefones dos leads encontrados"],
        ["Não Encontrado",     "CPF não existe no evento selecionado",
         "Mensagem de alerta: participante não cadastrado"],
    ], [3.5*cm, 4.5*cm, 7.7*cm], font_size=9.5))
    story.append(sp(10))

    story.append(p("Aplicações Práticas", "h3"))
    story.append(sp(6))
    story.append(kpi_table([
        ("🔍", "Evitar duplicatas",       "Verificar se o cliente já foi abordado antes de registrar novamente"),
        ("🎟", "Controle de participação","Confirmar presença em eventos com lista de convidados"),
        ("⚡", "Agilidade no atendimento","Recuperar dados do cliente em segundos pelo CPF"),
    ]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 09 — MÓDULO EQUIPE
    # Todo o conteúdo em KeepTogether para evitar quebra parcial de página
    # ═══════════════════════════════════════════════════════════════════════
    slide09 = []
    slide09 += slide_header("09", "Módulo Equipe")
    slide09.append(p(
        "Gerenciamento completo dos usuários que acessam o sistema. O marketing "
        "tem controle total sobre quem pode registrar leads e quais permissões "
        "cada pessoa possui."
    ))
    slide09.append(sp(8))

    slide09.append(p("Informações de Cada Membro da Equipe", "h3"))
    slide09.append(sp(5))
    slide09.append(make_table([
        ["Campo",           "Descrição"],
        ["Nome Completo",   "Nome de exibição do usuário no sistema"],
        ["E-mail de Login", "Endereço de acesso ao sistema"],
        ["Perfil",          "Vendedor (campo) ou Marketing (administração)"],
        ["Status",          "Ativo (acessa o sistema) ou Inativo (bloqueado)"],
        ["Leads Captados",  "Total de leads registrados pelo vendedor"],
    ], [4.5*cm, 11.2*cm]))
    slide09.append(sp(8))

    slide09.append(p("Ações Disponíveis pelo Marketing", "h3"))
    slide09.append(sp(5))
    slide09.append(kpi_table([
        ("➕", "Adicionar usuário", "Cria novo acesso com nome, e-mail, senha inicial e perfil"),
        ("✏",  "Editar usuário",   "Atualiza nome e e-mail de qualquer membro"),
        ("🔄", "Alterar perfil",   "Muda um vendedor para marketing ou vice-versa"),
        ("🔒", "Ativar/Desativar", "Bloqueia ou restaura o acesso sem excluir o histórico"),
        ("🗑",  "Excluir usuário", "Remove definitivamente o acesso, com confirmação prévia"),
    ]))
    slide09.append(sp(8))

    slide09.append(p("Desempenho Individual", "h3"))
    slide09.append(sp(4))
    slide09.append(p(
        "Cada cartão de vendedor exibe um mini-gráfico com o desempenho nos últimos "
        "eventos e o total de leads captados, facilitando a identificação de quem "
        "está entregando melhores resultados sem precisar de relatórios separados."
    ))

    story.append(KeepTogether(slide09))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 10 — APLICATIVO DO VENDEDOR
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("10", "Aplicativo do Vendedor")
    story.append(p(
        "Interface simplificada e otimizada para uso em celular durante os eventos. "
        "O vendedor acessa as funções que precisa no campo de forma rápida e intuitiva, "
        "organizadas em 4 abas na parte inferior da tela."
    ))
    story.append(sp(8))

    abas = [
        ("REGISTRAR", [
            "Formulário de cadastro de novo lead",
            "Modo rápido: exibe apenas os campos essenciais (nome, telefone, serviço, temperatura)",
            "Contador de leads do dia com barra de progresso em direção à meta de 15 leads",
            "Chips de observação rápida: Mora em área coberta, Aguardando visita técnica, entre outros",
            "Confirmação ao registrar com opção de desfazer por 5 segundos",
        ]),
        ("MEUS LEADS", [
            "Lista de todos os leads registrados pelo vendedor naquele evento",
            "Botões de ação rápida: ligar diretamente ou abrir WhatsApp",
            "Alteração da temperatura com um toque: Frio, Morno, Quente ou Convertido",
            "Edição completa de qualquer lead cadastrado",
        ]),
        ("EVENTO", [
            "Informações completas do evento: local, datas, tipo e observações",
            "Botão para abrir a localização diretamente no Google Maps",
            "Ranking da equipe em tempo real com posições destacadas: ouro, prata e bronze",
        ]),
        ("PACOTES", [
            "Tabela de planos de Internet Fibra com preços",
            "Planos de TV com quantidade de canais e preços, incluindo canais premium",
            "Planos de telefonia móvel com franquias de dados",
            "Combos de aplicativos — pacote amarelo e pacote black",
        ]),
    ]
    for titulo, items in abas:
        header = Table(
            [[Paragraph(f"<b>{titulo}</b>",
                        ParagraphStyle("abah", fontName="LSB", fontSize=11,
                                       textColor=BRANCO))]],
            colWidths=[15.7*cm],
        )
        header.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), CINZA_ESC),
            ("LEFTPADDING",   (0,0), (-1,-1), 12),
            ("TOPPADDING",    (0,0), (-1,-1), 7),
            ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ]))
        story.append(header)
        for item in items:
            row = Table(
                [[Paragraph(f"— {item}", S["bullet"])]],
                colWidths=[15.7*cm],
            )
            row.setStyle(TableStyle([
                ("LEFTPADDING",   (0,0), (-1,-1), 18),
                ("TOPPADDING",    (0,0), (-1,-1), 4),
                ("BOTTOMPADDING", (0,0), (-1,-1), 4),
                ("LINEBELOW",     (0,0), (-1,-1), 0.3, colors.HexColor("#EEEEEE")),
            ]))
            story.append(row)
        story.append(sp(5))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 11 — INDICADORES E RELATÓRIOS
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("11", "Indicadores e Relatórios")
    story.append(p(
        "O sistema oferece múltiplas camadas de análise, desde indicadores gerais "
        "da operação até o desempenho individual de cada vendedor por evento."
    ))
    story.append(sp(10))

    story.append(make_table([
        ["Relatório / Indicador",  "Onde encontrar",      "O que mostra"],
        ["KPIs gerais",            "Dashboard",           "Eventos ativos, total de leads, materiais críticos, vendedores ativos"],
        ["Leads por Serviço",      "Dashboard",           "Distribuição percentual por tipo de serviço (gráfico de rosca)"],
        ["Leads por Vendedor",     "Detalhe do Evento",   "Barras comparativas de produtividade por vendedor no evento"],
        ["Leads por Evento",       "Aba Leads",           "Comparativo de leads captados em cada evento (gráfico de barras)"],
        ["Tabela de Leads",        "Aba Leads",           "Listagem completa com filtros por evento, vendedor e serviço"],
        ["Exportação CSV",         "Aba Leads",           "Arquivo com todos os dados dos leads para uso externo"],
        ["Desempenho por Vendedor","Aba Equipe",          "Histórico nos últimos eventos com mini-gráfico"],
        ["Ranking da Equipe",      "App do Vendedor",     "Placar em tempo real por evento com posições classificadas"],
        ["Resumo por Evento",      "Detalhe do Evento",   "Total de leads e materiais em campo por evento"],
        ["Controle de Estoque",    "Aba Estoque",         "Status de disponibilidade de cada material com alertas de cor"],
    ], [4*cm, 3.5*cm, 8.2*cm], font_size=9))
    story.append(sp(12))

    story.append(p("Meta Diária de Leads", "h3"))
    story.append(sp(4))
    story.append(p(
        "Cada vendedor possui uma meta de <b>15 leads por evento</b>. O sistema exibe "
        "uma barra de progresso em tempo real no aplicativo do vendedor, incentivando "
        "o desempenho durante o evento. Ao atingir a meta, a barra exibe a mensagem "
        "<b>Meta batida!</b>"
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 12 — INTEGRAÇÃO E SINCRONIZAÇÃO
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("12", "Integração e Sincronização")
    story.append(p(
        "O sistema foi projetado para funcionar em dois cenários: com conexão estável "
        "de internet e em situações de conectividade instável, que são comuns durante "
        "eventos em campo."
    ))
    story.append(sp(12))

    for icon, titulo, items in [
        ("🌐", "Modo Online (Padrão)", [
            "Todos os dados são salvos e sincronizados em tempo real",
            "Alterações feitas por qualquer usuário ficam disponíveis instantaneamente",
            "Ranking da equipe é atualizado automaticamente a cada novo lead registrado",
            "Sincronização automática a cada 60 segundos entre dispositivos",
        ]),
        ("📱", "Modo Offline (Automático)", [
            "Se a conexão cair, o sistema continua funcionando normalmente",
            "Leads registrados são salvos localmente no dispositivo",
            "Ao reconectar, todos os dados pendentes são enviados automaticamente",
            "Leads de eventos encerrados durante o período offline são descartados com segurança",
        ]),
    ]:
        story.append(p(f"{icon}  {titulo}", "h3_am"))
        story.append(ColorLine(AMARELO, thickness=1))
        story.append(sp(5))
        for item in items:
            story.append(Paragraph(f"— {item}", S["bullet"]))
        story.append(sp(10))

    story.append(p("Acesso Individual por Usuário", "h3"))
    story.append(sp(4))
    story.append(p(
        "Cada usuário faz login com seu e-mail e senha individuais. O sistema "
        "reconhece automaticamente o perfil (marketing ou vendedor) e exibe apenas "
        "as funcionalidades correspondentes. Um vendedor não vê os dados de outros "
        "vendedores; o marketing tem visão completa de todos."
    ))
    story.append(sp(12))

    story.append(p("Compatibilidade de Dispositivos", "h3"))
    story.append(sp(6))
    story.append(make_table([
        ["Dispositivo",         "Perfil Recomendado",     "Observação"],
        ["Computador/Notebook", "Marketing",              "Acesso completo a todos os módulos"],
        ["Tablet",              "Marketing ou Vendedor",  "Boa experiência em todos os módulos"],
        ["Celular",             "Vendedor",               "Interface otimizada para o aplicativo do vendedor"],
    ], [5*cm, 4.5*cm, 6.2*cm]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 13 — BENEFÍCIOS PARA O NEGÓCIO
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("13", "Benefícios para o Negócio")
    story.append(p(
        "O RJNET — Gestão de Eventos entrega resultados tangíveis para as principais "
        "áreas da empresa envolvidas em ações comerciais em campo."
    ))
    story.append(sp(8))

    for icon, area, beneficios in [
        ("📢", "Marketing", [
            "Planejamento centralizado de todos os eventos em uma única plataforma",
            "Visibilidade em tempo real do desempenho de cada ação",
            "Controle total do estoque de materiais sem planilhas",
            "Relatórios prontos para apresentação sem trabalho manual adicional",
        ]),
        ("💼", "Comercial e Vendas", [
            "Captação de leads mais rápida e padronizada em campo",
            "Classificação por temperatura facilita priorização do follow-up",
            "Exportação direta para ferramentas de vendas e CRM",
            "Ranking visível mantém equipe motivada e competitiva",
        ]),
        ("🏢", "Diretoria e Gestão", [
            "Indicadores atualizados em tempo real sem depender de relatórios manuais",
            "Histórico completo de todos os eventos realizados",
            "Rastreabilidade: sabe-se quem registrou cada lead e quando",
            "Tomada de decisão baseada em dados reais da operação",
        ]),
        ("⚙", "Operação", [
            "Eliminação de planilhas e processos manuais paralelos",
            "Continuidade da operação mesmo com instabilidade de internet",
            "Check-in por CPF evita duplicidades e melhora qualidade dos dados",
            "Gestão de devolução de materiais reduz perdas e extravios",
        ]),
    ]:
        story.append(Paragraph(
            f"<b>{icon}  {area}</b>",
            ParagraphStyle("areah", fontName="LSB", fontSize=11,
                           textColor=PRETO, spaceBefore=4)
        ))
        for b in beneficios:
            story.append(Paragraph(
                f"<font color='#F5C000'>✓</font>  {b}",
                ParagraphStyle("benef", fontName="LS", fontSize=10, leading=15,
                               leftIndent=12, textColor=colors.HexColor("#222222"),
                               spaceBefore=2),
            ))
        story.append(sp(6))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # SLIDE 14 — RESUMO EXECUTIVO
    # ═══════════════════════════════════════════════════════════════════════
    story += slide_header("14", "Resumo Executivo")
    story.append(p("Uma síntese objetiva do que o sistema entrega hoje para a RJNET."))
    story.append(sp(10))

    story.append(p("O que o sistema entrega hoje?", "h3_am"))
    story.append(ColorLine(AMARELO, thickness=1.5))
    story.append(sp(6))
    for e in [
        "Plataforma completa de gerenciamento de eventos comerciais em campo",
        "Captação digital de leads com dados padronizados e rastreáveis",
        "Controle de estoque de materiais promocionais com alertas automáticos",
        "Dashboard em tempo real com KPIs da operação",
        "Ferramenta de check-in por CPF para confirmação de participantes",
        "Aplicativo mobile para vendedores com registro rápido e ranking da equipe",
        "Exportação de dados para continuidade no processo de vendas",
        "Gestão completa de usuários com controle de acesso por perfil",
    ]:
        story.append(Paragraph(
            f"<font color='#22C55E'><b>✓</b></font>  {e}",
            ParagraphStyle("ent", fontName="LS", fontSize=10, leading=15,
                           leftIndent=12, textColor=colors.HexColor("#222222"),
                           spaceBefore=2),
        ))
    story.append(sp(10))

    story.append(p("Quais processos são automatizados?", "h3"))
    story.append(ColorLine(colors.HexColor("#AAAAAA"), thickness=1))
    story.append(sp(6))
    story.append(make_table([
        ["Processo",               "Como era antes",              "Como é com o sistema"],
        ["Registro de leads",      "Papel ou planilha em campo",  "App no celular, em tempo real"],
        ["Controle de materiais",  "Planilha manual",             "Estoque automático com alertas"],
        ["Relatório de eventos",   "Consolidação após o evento",  "Dashboard em tempo real"],
        ["Confirmação de presença","Lista impressa ou memória",   "Check-in por CPF instantâneo"],
        ["Exportação de contatos", "Transcrição manual",          "Download CSV com 1 clique"],
        ["Ranking da equipe",      "Apuração manual",             "Atualizado automaticamente"],
    ], [3.8*cm, 5.2*cm, 6.7*cm], font_size=9.5))
    story.append(sp(10))

    story.append(p("Áreas beneficiadas", "h3"))
    story.append(sp(6))
    t_areas = Table(
        [
            ["Marketing", "Vendas e Comercial", "Diretoria", "Operação"],
            ["Planejamento\nRelatórios\nEstoque",
             "Captação de leads\nRanking\nProdutividade",
             "KPIs em tempo real\nHistórico\nRastreabilidade",
             "Logística\nCheck-in\nSincronização"],
        ],
        colWidths=[3.9*cm, 3.9*cm, 3.9*cm, 3.9*cm]
    )
    t_areas.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1, 0), CINZA_ESC),
        ("TEXTCOLOR",     (0,0), (-1, 0), AMARELO),
        ("FONTNAME",      (0,0), (-1, 0), "LSB"),
        ("FONTSIZE",      (0,0), (-1, 0), 10),
        ("FONTNAME",      (0,1), (-1,-1), "LS"),
        ("FONTSIZE",      (0,1), (-1,-1), 9.5),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("GRID",          (0,0), (-1,-1), 0.4, colors.HexColor("#CCCCCC")),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [CINZA_CLA]),
    ]))
    story.append(t_areas)

    doc.build(story, onFirstPage=lambda c, d: None, onLaterPages=add_page_num)
    print(f"PDF gerado: {path}")


if __name__ == "__main__":
    build_pdf()
