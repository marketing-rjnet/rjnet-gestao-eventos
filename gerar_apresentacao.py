#!/usr/bin/env python3
"""Gerador de apresentação executiva — RJNet Gestão de Eventos."""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas
import datetime

# ── Cores corporativas ──────────────────────────────────────────────────────
AMARELO   = colors.HexColor("#F5C000")
PRETO     = colors.HexColor("#0D0D0D")
CINZA_ESC = colors.HexColor("#1A1A1A")
CINZA_MED = colors.HexColor("#2E2E2E")
CINZA_CLA = colors.HexColor("#F4F4F4")
BRANCO    = colors.white
VERDE     = colors.HexColor("#22C55E")
VERMELHO  = colors.HexColor("#EF4444")
AZUL      = colors.HexColor("#60A5FA")
LARANJA   = colors.HexColor("#FB923C")

W, H = A4  # 595 x 842 pts


# ── Flowable: linha horizontal colorida ────────────────────────────────────
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


# ── Flowable: caixa colorida de destaque ───────────────────────────────────
class HighlightBox(Flowable):
    def __init__(self, text, bg=AMARELO, fg=PRETO, width=None, height=36, style=None):
        super().__init__()
        self.text = text
        self.bg = bg
        self.fg = fg
        self._width = width
        self.height = height
        self.style = style

    def wrap(self, aW, aH):
        self.width = self._width or aW
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self.width, self.height, 6, fill=1, stroke=0)
        c.setFillColor(self.fg)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(self.width / 2, self.height / 2 - 5, self.text)


# ── Estilos de parágrafo ───────────────────────────────────────────────────
def build_styles():
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=10,
                          leading=15, textColor=PRETO)
    return {
        "slide_num": ParagraphStyle("slide_num", parent=base,
                                    fontName="Helvetica", fontSize=9,
                                    textColor=colors.HexColor("#999999"),
                                    alignment=TA_RIGHT),
        "h1": ParagraphStyle("h1", parent=base, fontName="Helvetica-Bold",
                             fontSize=26, leading=32, textColor=PRETO,
                             spaceAfter=4),
        "h2": ParagraphStyle("h2", parent=base, fontName="Helvetica-Bold",
                             fontSize=18, leading=24, textColor=PRETO,
                             spaceBefore=6, spaceAfter=4),
        "h3": ParagraphStyle("h3", parent=base, fontName="Helvetica-Bold",
                             fontSize=13, leading=18, textColor=PRETO,
                             spaceBefore=4, spaceAfter=2),
        "h3_am": ParagraphStyle("h3_am", parent=base, fontName="Helvetica-Bold",
                                fontSize=13, leading=18, textColor=AMARELO,
                                spaceBefore=4, spaceAfter=2),
        "body": ParagraphStyle("body", parent=base, fontSize=10.5, leading=16,
                               textColor=colors.HexColor("#222222"),
                               alignment=TA_JUSTIFY),
        "bullet": ParagraphStyle("bullet", parent=base, fontSize=10.5,
                                 leading=16, textColor=colors.HexColor("#222222"),
                                 leftIndent=14, bulletIndent=0,
                                 spaceBefore=2),
        "sub": ParagraphStyle("sub", parent=base, fontSize=9.5, leading=14,
                              textColor=colors.HexColor("#555555")),
        "label": ParagraphStyle("label", parent=base, fontName="Helvetica-Bold",
                                fontSize=9, textColor=colors.HexColor("#888888"),
                                spaceAfter=1),
        "caption": ParagraphStyle("caption", parent=base, fontSize=9,
                                  textColor=colors.HexColor("#777777"),
                                  alignment=TA_CENTER),
        "cover_title": ParagraphStyle("cover_title", parent=base,
                                      fontName="Helvetica-Bold", fontSize=34,
                                      leading=40, textColor=BRANCO),
        "cover_sub": ParagraphStyle("cover_sub", parent=base, fontSize=15,
                                    leading=22, textColor=colors.HexColor("#DDDDDD")),
        "cover_tag": ParagraphStyle("cover_tag", parent=base,
                                    fontName="Helvetica-Bold", fontSize=10,
                                    textColor=AMARELO),
    }


S = build_styles()


# ── Numeração de páginas ───────────────────────────────────────────────────
def add_page_num(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(colors.HexColor("#AAAAAA"))
    canvas_obj.drawRightString(W - 1.5 * cm, 1 * cm,
                               f"Página {doc.page}")
    canvas_obj.drawString(1.5 * cm, 1 * cm,
                          "RJNet Gestão de Eventos — Documento Confidencial")
    canvas_obj.setStrokeColor(colors.HexColor("#EEEEEE"))
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(1.5 * cm, 1.3 * cm, W - 1.5 * cm, 1.3 * cm)
    canvas_obj.restoreState()


# ── Cabeçalho de slide (barra amarela + título) ────────────────────────────
def slide_header(num, title):
    return [
        Paragraph(f"Slide {num}", S["slide_num"]),
        Spacer(1, 2),
        ColorLine(AMARELO, thickness=3),
        Spacer(1, 8),
        Paragraph(title, S["h2"]),
        Spacer(1, 6),
    ]


# ── Bullet helper ──────────────────────────────────────────────────────────
def bullet(text, indent=0, bold_prefix=None):
    if bold_prefix:
        text = f"<b>{bold_prefix}</b> {text}"
    return Paragraph(f"• {text}", S["bullet"])


# ── Tabela simples ─────────────────────────────────────────────────────────
def make_table(data, col_widths, header_bg=CINZA_ESC, header_fg=AMARELO,
               row_bg_alt=CINZA_CLA, font_size=10):
    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), header_fg),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), font_size),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), font_size),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BRANCO, row_bg_alt]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 0), (-1, 0), [header_bg]),
    ])
    t = Table(data, colWidths=col_widths)
    t.setStyle(ts)
    return t


# ── Caixa de benefício KPI ─────────────────────────────────────────────────
def kpi_table(items):
    """items: list of (icon_char, label, description)"""
    rows = []
    for icon, label, desc in items:
        rows.append([
            Paragraph(f"<b>{icon}</b>", ParagraphStyle("ic", fontName="Helvetica-Bold",
                      fontSize=18, textColor=AMARELO, alignment=TA_CENTER)),
            Paragraph(f"<b>{label}</b><br/><font size=9 color='#555555'>{desc}</font>",
                      ParagraphStyle("kd", fontName="Helvetica-Bold", fontSize=11,
                                     leading=15, textColor=PRETO)),
        ])

    ts = TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [CINZA_CLA, BRANCO]),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#DDDDDD")),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ])
    t = Table(rows, colWidths=[1.2 * cm, 14 * cm])
    t.setStyle(ts)
    return t


# ══════════════════════════════════════════════════════════════════════════════
# CONSTRUÇÃO DO DOCUMENTO
# ══════════════════════════════════════════════════════════════════════════════

def build_pdf():
    path = "/home/user/rjnet-gestao-eventos/RJNet_Gestao_Eventos_Apresentacao_Executiva.pdf"
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.8 * cm,
        bottomMargin=2 * cm,
        title="RJNet Gestão de Eventos — Apresentação Executiva",
        author="RJNet",
        subject="Documentação Executiva do Sistema",
    )

    story = []

    # ── CAPA ───────────────────────────────────────────────────────────────
    # Bloco preto de capa
    class CoverPage(Flowable):
        def wrap(self, aW, aH):
            return aW, aH

        def draw(self):
            c = self.canv
            # Fundo preto
            c.setFillColor(PRETO)
            c.rect(0, 0, W, H, fill=1, stroke=0)
            # Barra amarela lateral
            c.setFillColor(AMARELO)
            c.rect(0, 0, 8, H, fill=1, stroke=0)
            # Barra amarela topo
            c.setFillColor(AMARELO)
            c.rect(0, H - 6, W, 6, fill=1, stroke=0)

            # Título
            c.setFillColor(BRANCO)
            c.setFont("Helvetica-Bold", 38)
            c.drawString(2 * cm, H - 5.5 * cm, "RJNet Gestão")
            c.drawString(2 * cm, H - 7 * cm, "de Eventos")

            # Linha amarela decorativa
            c.setStrokeColor(AMARELO)
            c.setLineWidth(2)
            c.line(2 * cm, H - 7.8 * cm, W - 2 * cm, H - 7.8 * cm)

            # Subtítulo
            c.setFillColor(colors.HexColor("#DDDDDD"))
            c.setFont("Helvetica", 15)
            c.drawString(2 * cm, H - 8.8 * cm,
                         "Apresentação Executiva do Sistema de Gerenciamento")

            # Data
            c.setFillColor(AMARELO)
            c.setFont("Helvetica-Bold", 10)
            hoje = datetime.date.today().strftime("%B de %Y").capitalize()
            c.drawString(2 * cm, H - 9.8 * cm, f"Versão {hoje}")

            # Seções que serão cobertas
            c.setFillColor(colors.HexColor("#AAAAAA"))
            c.setFont("Helvetica", 9)
            temas = [
                "Visão Geral do Produto",
                "Perfis de Usuário",
                "Módulos do Sistema",
                "Indicadores e Relatórios",
                "Benefícios para o Negócio",
            ]
            y = H - 12 * cm
            for t in temas:
                c.drawString(2 * cm, y, f"▸  {t}")
                y -= 0.55 * cm

            # Logo / marca
            c.setFillColor(AMARELO)
            c.setFont("Helvetica-Bold", 22)
            c.drawString(2 * cm, 3 * cm, "RJNet")
            c.setFillColor(BRANCO)
            c.setFont("Helvetica", 11)
            c.drawString(2 * cm, 2.3 * cm, "Documento Confidencial — Uso Interno")

    story.append(CoverPage())
    story.append(PageBreak())

    # ── SUMÁRIO ────────────────────────────────────────────────────────────
    story.append(Paragraph("Sumário", S["h1"]))
    story.append(ColorLine(AMARELO, thickness=3))
    story.append(Spacer(1, 14))

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
            colWidths=[1.5 * cm, 14 * cm],
        )
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("LINEBELOW", (0, 0), (-1, 0), 0.3, colors.HexColor("#DDDDDD")),
        ]))
        story.append(row)

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 01 — VISÃO GERAL
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("01", "Visão Geral do Sistema")

    story.append(Paragraph(
        "O <b>RJNet Gestão de Eventos</b> é a plataforma central que a RJNet utiliza para "
        "planejar, executar e monitorar suas ações comerciais em campo. O sistema conecta "
        "a equipe de marketing aos vendedores, centralizando em um único lugar tudo o que "
        "acontece antes, durante e depois de cada evento.",
        S["body"]
    ))
    story.append(Spacer(1, 10))

    info_data = [
        ["Objetivo Principal",
         "Gerenciar eventos comerciais da RJNet de ponta a ponta — desde o planejamento "
         "e alocação de materiais até a captação de leads e acompanhamento de resultados."],
        ["Problema Resolvido",
         "Elimina o uso de planilhas e processos manuais dispersos, reunindo controle de "
         "equipe, estoque de materiais, captação de leads e relatórios em um único sistema "
         "acessível de qualquer dispositivo."],
        ["Público que Utiliza",
         "Time de Marketing (gestão completa) e Equipe Comercial / Vendedores "
         "(registro de leads e consulta de informações do evento)."],
        ["Como é Acessado",
         "Via navegador de internet (computador, tablet ou celular) — sem necessidade "
         "de instalação de aplicativo."],
    ]

    for titulo, texto in info_data:
        t = Table(
            [[Paragraph(titulo, S["label"]), Paragraph(texto, S["body"])]],
            colWidths=[4.5 * cm, 11.2 * cm],
        )
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), CINZA_CLA),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
        ]))
        story.append(t)

    story.append(Spacer(1, 14))
    story.append(Paragraph("Principais Capacidades do Sistema", S["h3"]))
    story.append(Spacer(1, 6))
    caps = [
        ("📅", "Gestão de Eventos", "Cadastro, acompanhamento e encerramento de eventos comerciais"),
        ("📦", "Controle de Estoque", "Gerenciamento de materiais promocionais com alertas automáticos"),
        ("👥", "Captação de Leads", "Registro rápido de potenciais clientes diretamente no campo"),
        ("📊", "Relatórios em Tempo Real", "KPIs, gráficos e rankings atualizados automaticamente"),
        ("🔍", "Check-in por CPF", "Verificação instantânea de participantes cadastrados"),
        ("🏆", "Ranking da Equipe", "Placar de desempenho visível para toda a equipe em tempo real"),
    ]
    story.append(kpi_table(caps))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 02 — FLUXO GERAL
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("02", "Fluxo Geral da Operação")

    story.append(Paragraph(
        "O sistema acompanha toda a jornada de um evento comercial, do planejamento "
        "ao fechamento. Abaixo está o fluxo completo de como a operação funciona na prática:",
        S["body"]
    ))
    story.append(Spacer(1, 16))

    etapas = [
        ("1", "PLANEJAMENTO", "O time de marketing cadastra o evento com local, datas, "
          "tipo e observações. São definidos quais materiais serão levados para o campo."),
        ("2", "PREPARAÇÃO", "Os materiais promocionais são alocados ao evento. "
          "O sistema calcula automaticamente a disponibilidade do estoque e "
          "sinaliza itens em quantidade crítica."),
        ("3", "EVENTO EM CAMPO", "A equipe de vendas acessa o aplicativo no celular. "
          "Cada vendedor registra leads com nome, telefone, serviço de interesse e "
          "temperatura de interesse. O ranking da equipe é visível em tempo real."),
        ("4", "ACOMPANHAMENTO", "O marketing acompanha pelo dashboard os indicadores "
          "do evento: total de leads, performance por vendedor e serviços mais demandados."),
        ("5", "ENCERRAMENTO", "Ao final do evento, os materiais são confirmados como "
          "devolvidos ao estoque. O evento é finalizado no sistema, preservando "
          "todos os dados para análise."),
        ("6", "ANÁLISE E CONVERSÃO", "O time comercial acessa os leads capturados, "
          "filtra por serviço ou evento, acompanha a temperatura de cada contato "
          "e exporta os dados para o CRM ou planilha."),
    ]

    for num, titulo, texto in etapas:
        bloco = Table(
            [[
                Paragraph(f"<font color='#F5C000'><b>{num}</b></font>",
                          ParagraphStyle("etnum", fontName="Helvetica-Bold",
                                         fontSize=20, textColor=AMARELO,
                                         alignment=TA_CENTER)),
                [Paragraph(f"<b>{titulo}</b>", S["h3"]),
                 Paragraph(texto, S["body"])],
            ]],
            colWidths=[1.2 * cm, 14.5 * cm],
        )
        bloco.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (0, 0), CINZA_CLA),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, AMARELO),
        ]))
        story.append(bloco)
        story.append(Spacer(1, 4))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 03 — PERFIS DE USUÁRIO
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("03", "Perfis de Usuário")

    story.append(Paragraph(
        "O sistema possui dois perfis de acesso distintos, cada um com um conjunto de "
        "funcionalidades adequado à sua função na operação.",
        S["body"]
    ))
    story.append(Spacer(1, 14))

    # Marketing
    story.append(Paragraph("Perfil: Marketing (Administrador)", S["h3_am"]))
    story.append(ColorLine(AMARELO, thickness=1.5))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Responsável pela gestão completa do sistema. Tem acesso irrestrito a todas "
        "as funcionalidades e informações.",
        S["body"]
    ))
    story.append(Spacer(1, 6))

    mkt_data = [
        ["Área", "O que pode fazer"],
        ["Eventos", "Criar, editar, finalizar e excluir eventos"],
        ["Estoque", "Cadastrar materiais, alocar por evento, confirmar devoluções"],
        ["Leads", "Visualizar todos os leads, filtrar, exportar para CSV"],
        ["Equipe", "Cadastrar, editar, ativar/desativar e excluir usuários"],
        ["Dashboard", "Ver KPIs, gráficos e alertas de toda a operação"],
        ["Check-in", "Verificar presença de participantes pelo CPF"],
        ["Relatórios", "Acompanhar desempenho por vendedor, evento e serviço"],
    ]
    story.append(make_table(mkt_data, [4 * cm, 11.7 * cm], font_size=10))
    story.append(Spacer(1, 16))

    # Vendedor
    story.append(Paragraph("Perfil: Vendedor (Equipe Comercial)", S["h3"]))
    story.append(ColorLine(colors.HexColor("#AAAAAA"), thickness=1.5))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Focado na operação em campo. Acessa uma visão simplificada e otimizada para "
        "celular, com apenas as funções necessárias para registrar e gerenciar seus leads.",
        S["body"]
    ))
    story.append(Spacer(1, 6))

    vend_data = [
        ["Área", "O que pode fazer"],
        ["Registrar Leads", "Cadastrar novos leads com formulário rápido (modo rápido disponível)"],
        ["Meus Leads", "Ver, editar e atualizar a temperatura dos próprios leads"],
        ["Informações do Evento", "Consultar local, datas e detalhes do evento em curso"],
        ["Ranking da Equipe", "Acompanhar o placar de todos os vendedores em tempo real"],
        ["Tabela de Pacotes", "Consultar planos e preços da RJNet durante o atendimento"],
    ]
    story.append(make_table(vend_data, [4 * cm, 11.7 * cm], font_size=10))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 04 — DASHBOARD
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("04", "Módulo Dashboard")

    story.append(Paragraph(
        "A tela inicial do marketing concentra os principais indicadores da operação, "
        "permitindo uma leitura rápida do desempenho geral sem necessidade de navegar "
        "por outros módulos.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Indicadores Exibidos (KPIs)", S["h3"]))
    story.append(Spacer(1, 6))

    kpi_data = [
        ["Indicador", "O que representa", "Ação"],
        ["Eventos Ativos", "Quantidade de eventos em andamento no momento", "Tomada de decisão sobre campo"],
        ["Total de Leads", "Soma de todos os leads captados no sistema", "Acompanhar resultado global"],
        ["Materiais Críticos", "Itens de estoque sem disponibilidade (alerta em vermelho)", "Agir sobre reposição urgente"],
        ["Vendedores Ativos", "Número de vendedores com acesso ativo ao sistema", "Gestão de equipe"],
    ]
    story.append(make_table(kpi_data, [3.8 * cm, 6.5 * cm, 5.4 * cm], font_size=9.5))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Gráfico: Leads por Serviço", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Gráfico em formato de rosca que exibe a distribuição dos leads por tipo de serviço "
        "de interesse. Mostra em proporção quantos leads demonstraram interesse em "
        "<b>Fibra Residencial</b>, <b>Fibra Empresarial</b>, <b>RJNET Móvel / Streamings</b> e "
        "<b>Outros</b>. Facilita a identificação de quais serviços têm maior demanda nos eventos.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Próximos Eventos", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Lista os próximos 3 eventos com data mais próxima, mostrando nome, período e "
        "status atual (Planejado ou Ativo). Permite à liderança ter visão antecipada "
        "da agenda de campo sem sair da tela principal.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Valor para o Negócio", S["h3"]))
    story.append(Spacer(1, 6))
    beneficios_dash = [
        ("📈", "Visão executiva instantânea", "Todos os números relevantes em uma única tela"),
        ("🔴", "Alertas automáticos", "Materiais críticos destacados em vermelho para ação imediata"),
        ("📅", "Agenda antecipada", "Próximos eventos visíveis sem precisar navegar"),
        ("🎯", "Foco na conversão", "Distribuição de serviços orienta esforços comerciais"),
    ]
    story.append(kpi_table(beneficios_dash))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 05 — MÓDULO EVENTOS
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("05", "Módulo Eventos")

    story.append(Paragraph(
        "Central de controle de todos os eventos comerciais da RJNet. É neste módulo "
        "que a operação de campo tem início e encerramento formal.",
        S["body"]
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Informações Registradas em Cada Evento", S["h3"]))
    story.append(Spacer(1, 6))

    campos_ev = [
        ["Campo", "Descrição"],
        ["Nome do Evento", "Identificação do evento (ex.: Ação Centro — Junho)"],
        ["Local", "Endereço completo onde o evento será realizado"],
        ["Data de Início e Fim", "Período de realização do evento"],
        ["Tipo", "Sinalização / Presença Comercial / Ativação Especial"],
        ["Status", "Planejado → Ativo → Encerrado"],
        ["Observações", "Informações complementares para a equipe"],
    ]
    story.append(make_table(campos_ev, [5 * cm, 10.7 * cm], font_size=10))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Ciclo de Vida do Evento", S["h3"]))
    story.append(Spacer(1, 6))

    ciclo = Table(
        [[
            Paragraph("🟡  PLANEJADO\nEvento cadastrado,\nainda não iniciado",
                      ParagraphStyle("cic", fontName="Helvetica", fontSize=9.5,
                                     leading=14, alignment=TA_CENTER)),
            Paragraph("→", ParagraphStyle("arr", fontName="Helvetica-Bold",
                                          fontSize=18, textColor=AMARELO,
                                          alignment=TA_CENTER)),
            Paragraph("🟢  ATIVO\nEvento em andamento,\nrecebe novos leads",
                      ParagraphStyle("cic", fontName="Helvetica", fontSize=9.5,
                                     leading=14, alignment=TA_CENTER)),
            Paragraph("→", ParagraphStyle("arr", fontName="Helvetica-Bold",
                                          fontSize=18, textColor=AMARELO,
                                          alignment=TA_CENTER)),
            Paragraph("⚫  ENCERRADO\nEvento finalizado,\ndados preservados",
                      ParagraphStyle("cic", fontName="Helvetica", fontSize=9.5,
                                     leading=14, alignment=TA_CENTER)),
        ]],
        colWidths=[4.5 * cm, 1.2 * cm, 4.5 * cm, 1.2 * cm, 4.5 * cm],
    )
    ciclo.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#FFF9E0")),
        ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#F0FFF4")),
        ("BACKGROUND", (4, 0), (4, 0), CINZA_CLA),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(ciclo)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Gestão de Materiais por Evento", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Dentro de cada evento, é possível alocar materiais do estoque e acompanhar "
        "sua utilização. Ao final do evento, o sistema registra a devolução de cada "
        "item, reintegrando-o automaticamente ao estoque disponível.",
        S["body"]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Desempenho por Vendedor (dentro do evento)", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Cada evento exibe um gráfico de barras com a quantidade de leads captados "
        "por cada vendedor, além de uma tabela completa com todos os leads registrados "
        "naquele evento — nome, telefone, endereço, serviço de interesse e vendedor responsável.",
        S["body"]
    ))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 06 — MÓDULO ESTOQUE
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("06", "Módulo Estoque")

    story.append(Paragraph(
        "Controle completo dos materiais promocionais utilizados nos eventos. O sistema "
        "calcula automaticamente a disponibilidade de cada item com base nos eventos "
        "ativos e em planejamento.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Painel de Resumo do Estoque", S["h3"]))
    story.append(Spacer(1, 6))

    resumo_est = [
        ["Indicador", "Significado"],
        ["Total de Tipos", "Quantidade de tipos diferentes de materiais cadastrados"],
        ["Total de Itens", "Soma de todas as unidades em estoque"],
        ["Em Campo", "Itens atualmente alocados em eventos ativos ou planejados"],
    ]
    story.append(make_table(resumo_est, [5 * cm, 10.7 * cm], font_size=10))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Classificação Automática por Disponibilidade", S["h3"]))
    story.append(Spacer(1, 6))

    status_est = [
        ["Status", "Critério", "O que fazer"],
        ["🔴  CRÍTICO", "Disponível = 0 unidades", "Repor ou redistribuir urgentemente"],
        ["🟡  ATENÇÃO", "Disponível entre 1 e 3 unidades", "Monitorar e planejar reposição"],
        ["🟢  OK", "Disponível 4 ou mais unidades", "Estoque suficiente para próximos eventos"],
    ]
    story.append(make_table(status_est, [3 * cm, 5.5 * cm, 7.2 * cm], font_size=10))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Como Funciona o Fluxo de Materiais", S["h3"]))
    story.append(Spacer(1, 6))

    fluxo_mat = [
        ("1", "Cadastro", "Material é cadastrado com nome, quantidade total e descrição"),
        ("2", "Alocação", "Marketing aloca quantidade ao evento. Sistema desconta do disponível"),
        ("3", "Em Campo", "Material sai para o evento. Status do evento atualiza disponibilidade"),
        ("4", "Devolução", "Ao final do evento, devolução é confirmada. Estoque retorna ao disponível"),
    ]
    for num, titulo, texto in fluxo_mat:
        row = Table(
            [[Paragraph(f"<b>{num}</b>",
                        ParagraphStyle("fn", fontName="Helvetica-Bold", fontSize=13,
                                       textColor=AMARELO, alignment=TA_CENTER)),
              Paragraph(f"<b>{titulo}:</b> {texto}", S["body"])]],
            colWidths=[0.9 * cm, 14.8 * cm],
        )
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#EEEEEE")),
        ]))
        story.append(row)

    story.append(Spacer(1, 12))
    story.append(Paragraph("Benefícios para a Operação", S["h3"]))
    story.append(Spacer(1, 6))
    benef_est = [
        ("📦", "Visibilidade total", "Sabe-se exatamente onde cada material está"),
        ("⚡", "Alerta proativo", "Problemas de estoque identificados antes do evento"),
        ("🔄", "Ciclo fechado", "Controle de ida e volta de todos os materiais"),
    ]
    story.append(kpi_table(benef_est))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 07 — MÓDULO LEADS
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("07", "Módulo Leads")

    story.append(Paragraph(
        "Central de gestão de todos os contatos comerciais captados nos eventos. "
        "Permite visualizar, filtrar, analisar e exportar leads para continuidade "
        "do processo de vendas.",
        S["body"]
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Informações Registradas em Cada Lead", S["h3"]))
    story.append(Spacer(1, 6))

    campos_lead = [
        ["Campo", "Descrição"],
        ["Nome Completo", "Nome do potencial cliente"],
        ["Telefone", "Número de contato (formatado automaticamente)"],
        ["CPF", "Documento de identificação (opcional)"],
        ["Endereço", "Endereço do cliente (opcional)"],
        ["Serviço de Interesse", "Fibra Residencial / Fibra Empresarial / RJNET Móvel / Streamings / Outro"],
        ["Temperatura", "Frio / Morno / Quente / Convertido — grau de interesse do contato"],
        ["Já é Cliente RJNet?", "Indicador se o lead já possui algum serviço ativo"],
        ["Observação", "Notas rápidas como: aguardando visita, interesse em combo, etc."],
        ["Vendedor", "Quem registrou o lead no evento"],
        ["Evento", "Em qual evento o lead foi captado"],
    ]
    story.append(make_table(campos_lead, [5 * cm, 10.7 * cm], font_size=9.5))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Temperatura dos Leads", S["h3"]))
    story.append(Spacer(1, 6))

    temp_data = [
        ["🔵  Frio", "Demonstrou pouco interesse, contato inicial"],
        ["🟠  Morno", "Interesse moderado, precisa de mais informações"],
        ["🔴  Quente", "Alto interesse, pronto para próximo contato de vendas"],
        ["🟢  Convertido", "Fechou contrato ou avançou para proposta concreta"],
    ]
    t_temp = Table(temp_data, colWidths=[4 * cm, 11.7 * cm])
    t_temp.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [CINZA_CLA, BRANCO]),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#DDDDDD")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ]))
    story.append(t_temp)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Filtros e Exportação", S["h3"]))
    story.append(Spacer(1, 6))
    for txt in [
        "• Filtrar leads por <b>evento específico</b>",
        "• Filtrar por <b>vendedor</b>",
        "• Filtrar por <b>serviço de interesse</b>",
        "• <b>Exportar para CSV</b> — arquivo pronto para importação em CRM, planilha ou ferramenta de e-mail marketing",
        "• O arquivo exportado inclui: nome, CPF, telefone, endereço, serviço, temperatura, "
          "se já é cliente, vendedor, evento, observação e data de cadastro",
    ]:
        story.append(Paragraph(txt, S["body"]))
        story.append(Spacer(1, 3))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 08 — MÓDULO CHECK-IN
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("08", "Módulo Check-in")

    story.append(Paragraph(
        "Ferramenta de verificação rápida que permite confirmar se um participante "
        "já está cadastrado como lead em um evento específico, utilizando o CPF "
        "como chave de busca.",
        S["body"]
    ))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Como Funciona", S["h3"]))
    story.append(Spacer(1, 6))

    checkin_steps = [
        ("1", "Seleção do Evento", "Escolha o evento para verificar os participantes"),
        ("2", "Digitação do CPF", "Digite o CPF completo (confirmação exata) ou parcial (busca ampla)"),
        ("3", "Resultado Imediato", "O sistema retorna o resultado em segundos"),
    ]
    for num, titulo, texto in checkin_steps:
        row = Table(
            [[Paragraph(f"<b>{num}</b>",
                        ParagraphStyle("fn2", fontName="Helvetica-Bold", fontSize=16,
                                       textColor=AMARELO, alignment=TA_CENTER)),
              [Paragraph(f"<b>{titulo}</b>", S["h3"]),
               Paragraph(texto, S["body"])]]],
            colWidths=[1.2 * cm, 14.5 * cm],
        )
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("BACKGROUND", (0, 0), (-1, -1), CINZA_CLA),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, BRANCO),
        ]))
        story.append(row)
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 14))
    story.append(Paragraph("Tipos de Resultado", S["h3"]))
    story.append(Spacer(1, 6))

    result_data = [
        ["Resultado", "Quando Ocorre", "Informações Exibidas"],
        ["✅  Lead Encontrado", "CPF completo localizado no evento",
         "Nome, CPF, telefone, endereço, serviço, temperatura, vendedor e data de cadastro"],
        ["🔵  Múltiplos Resultados", "CPF parcial com mais de um match",
         "Lista de nomes, CPFs e telefones dos leads encontrados"],
        ["❌  Não Encontrado", "CPF não existe no evento selecionado",
         "Mensagem de alerta — participante não cadastrado"],
    ]
    story.append(make_table(result_data, [3.5 * cm, 4.5 * cm, 7.7 * cm], font_size=9.5))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Aplicações Práticas", S["h3"]))
    story.append(Spacer(1, 6))
    apps_ci = [
        ("🔍", "Evitar duplicatas", "Verificar se o cliente já foi abordado antes de registrar novamente"),
        ("🎟️", "Controle de participação", "Confirmar presença em eventos com lista de convidados"),
        ("⚡", "Agilidade no atendimento", "Recuperar dados do cliente em segundos pelo CPF"),
    ]
    story.append(kpi_table(apps_ci))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 09 — MÓDULO EQUIPE
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("09", "Módulo Equipe")

    story.append(Paragraph(
        "Gerenciamento completo dos usuários que acessam o sistema. O marketing "
        "tem controle total sobre quem pode registrar leads e quais permissões "
        "cada pessoa possui.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Informações de Cada Membro da Equipe", S["h3"]))
    story.append(Spacer(1, 6))

    equipe_campos = [
        ["Campo", "Descrição"],
        ["Nome Completo", "Nome de exibição do usuário no sistema"],
        ["E-mail de Login", "Endereço de acesso ao sistema"],
        ["Perfil", "Vendedor (campo) ou Marketing (administração)"],
        ["Status", "Ativo (acessa o sistema) ou Inativo (bloqueado)"],
        ["Leads Captados", "Total de leads registrados pelo vendedor"],
    ]
    story.append(make_table(equipe_campos, [4.5 * cm, 11.2 * cm], font_size=10))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Ações Disponíveis pelo Marketing", S["h3"]))
    story.append(Spacer(1, 6))

    acoes_equipe = [
        ("➕", "Adicionar usuário", "Cria novo acesso com nome, e-mail, senha inicial e perfil"),
        ("✏️", "Editar usuário", "Atualiza nome e e-mail de qualquer membro"),
        ("🔄", "Alterar perfil", "Muda um vendedor para marketing ou vice-versa"),
        ("🔒", "Ativar / Desativar", "Bloqueia ou restaura o acesso sem excluir o histórico"),
        ("🗑️", "Excluir usuário", "Remove definitivamente o acesso (com confirmação)"),
    ]
    story.append(kpi_table(acoes_equipe))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Desempenho Individual", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Cada cartão de vendedor exibe um mini-gráfico com o desempenho nos últimos "
        "eventos e o total de leads captados, facilitando a identificação de quem "
        "está entregando melhores resultados sem precisar de relatórios separados.",
        S["body"]
    ))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 10 — APLICATIVO DO VENDEDOR
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("10", "Aplicativo do Vendedor")

    story.append(Paragraph(
        "Interface simplificada e otimizada para uso em celular durante os eventos. "
        "O vendedor acessa as funções que precisa no campo de forma rápida e intuitiva, "
        "organizadas em 4 abas na parte inferior da tela.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    abas = [
        ("📝 REGISTRAR", [
            "Formulário de cadastro de novo lead",
            "Modo rápido: exibe apenas os campos essenciais (nome, telefone, serviço, temperatura)",
            "Contador de leads do dia com barra de progresso em direção à meta de 15 leads",
            "Chips de observação rápida: 'Mora em área coberta', 'Aguardando visita técnica', etc.",
            "Feedback vibratório ao registrar + opção de desfazer por 5 segundos",
        ]),
        ("👤 MEUS LEADS", [
            "Lista de todos os leads registrados pelo vendedor naquele evento",
            "Botões de ação rápida: ligar diretamente ou abrir WhatsApp",
            "Alteração da temperatura com um toque (Frio → Morno → Quente → Convertido)",
            "Edição completa de qualquer lead cadastrado",
        ]),
        ("📅 EVENTO", [
            "Informações completas do evento: local, datas, tipo e observações",
            "Botão para abrir a localização diretamente no Google Maps",
            "Ranking da equipe em tempo real com posições destacadas (ouro, prata, bronze)",
        ]),
        ("📦 PACOTES", [
            "Tabela de planos de Internet Fibra com preços",
            "Planos de TV (canais e preços) + canais premium disponíveis",
            "Planos de telefonia móvel com franquias de dados",
            "Combos de aplicativos (pacote amarelo e pacote black)",
        ]),
    ]

    for titulo, items in abas:
        header = Table(
            [[Paragraph(f"<b>{titulo}</b>",
                        ParagraphStyle("abah", fontName="Helvetica-Bold", fontSize=12,
                                       textColor=BRANCO))]],
            colWidths=[15.7 * cm],
        )
        header.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CINZA_ESC),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(header)
        for item in items:
            row = Table(
                [[Paragraph(f"• {item}", S["body"])]],
                colWidths=[15.7 * cm],
            )
            row.setStyle(TableStyle([
                ("LEFTPADDING", (0, 0), (-1, -1), 20),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#EEEEEE")),
            ]))
            story.append(row)
        story.append(Spacer(1, 8))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 11 — INDICADORES E RELATÓRIOS
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("11", "Indicadores e Relatórios")

    story.append(Paragraph(
        "O sistema oferece múltiplas camadas de análise, desde indicadores gerais "
        "da operação até o desempenho individual de cada vendedor por evento.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    relatorios = [
        ["Relatório / Indicador", "Onde encontrar", "O que mostra"],
        ["KPIs gerais", "Dashboard", "Eventos ativos, total de leads, materiais críticos, vendedores ativos"],
        ["Leads por Serviço", "Dashboard", "Distribuição percentual por tipo de serviço (gráfico de rosca)"],
        ["Leads por Vendedor", "Detalhe do Evento", "Barras comparativas de produtividade por vendedor no evento"],
        ["Leads por Evento", "Aba Leads", "Comparativo de leads captados em cada evento (gráfico de barras)"],
        ["Tabela de Leads", "Aba Leads", "Listagem completa com filtros por evento, vendedor e serviço"],
        ["Exportação CSV", "Aba Leads", "Arquivo com todos os dados dos leads para uso externo"],
        ["Desempenho por Vendedor", "Aba Equipe", "Histórico nos últimos eventos com mini-gráfico"],
        ["Ranking da Equipe", "App do Vendedor / Evento", "Placar em tempo real por evento com posições classificadas"],
        ["Resumo por Evento", "Detalhe do Evento", "Total de leads + materiais em campo por evento"],
        ["Controle de Estoque", "Aba Estoque", "Status de disponibilidade de cada material com alertas de cor"],
    ]
    story.append(make_table(relatorios, [4 * cm, 3.5 * cm, 8.2 * cm], font_size=9))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Meta Diária de Leads", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Cada vendedor possui uma meta de <b>15 leads por evento</b>. O sistema exibe "
        "uma barra de progresso em tempo real no aplicativo do vendedor, incentivando "
        "o desempenho durante o evento. Ao atingir a meta, a barra exibe a mensagem "
        '"Meta batida! 🎯".',
        S["body"]
    ))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 12 — INTEGRAÇÃO E SINCRONIZAÇÃO
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("12", "Integração e Sincronização")

    story.append(Paragraph(
        "O sistema foi projetado para funcionar em dois cenários: com conexão estável "
        "de internet e em situações de conectividade instável, que são comuns durante "
        "eventos em campo.",
        S["body"]
    ))
    story.append(Spacer(1, 14))

    modos = [
        ("🌐", "Modo Online (Padrão)", [
            "Todos os dados são salvos e sincronizados em tempo real",
            "Alterações feitas por qualquer usuário ficam disponíveis para todos instantaneamente",
            "Ranking da equipe é atualizado automaticamente a cada novo lead registrado",
            "Sincronização automática a cada 60 segundos entre dispositivos",
        ]),
        ("📱", "Modo Offline (Automático)", [
            "Se a conexão cair, o sistema continua funcionando normalmente",
            "Leads registrados são salvos localmente no dispositivo",
            "Ao reconectar, todos os dados pendentes são enviados automaticamente",
            "Leads de eventos encerrados durante o período offline são descartados com segurança",
        ]),
    ]

    for icon, titulo, items in modos:
        story.append(Paragraph(f"{icon}  {titulo}", S["h3_am"]))
        story.append(ColorLine(AMARELO, thickness=1))
        story.append(Spacer(1, 6))
        for item in items:
            story.append(bullet(item))
        story.append(Spacer(1, 12))

    story.append(Paragraph("Acesso Individual por Usuário", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Cada usuário faz login com seu e-mail e senha individuais. O sistema "
        "reconhece automaticamente o perfil (marketing ou vendedor) e exibe apenas "
        "as funcionalidades correspondentes. Um vendedor não vê os dados de outros "
        "vendedores; o marketing tem visão completa de todos.",
        S["body"]
    ))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Compatibilidade de Dispositivos", S["h3"]))
    story.append(Spacer(1, 6))

    disp_data = [
        ["Dispositivo", "Perfil Recomendado", "Observação"],
        ["Computador / Notebook", "Marketing", "Acesso completo a todos os módulos"],
        ["Tablet", "Marketing / Vendedor", "Boa experiência em todos os módulos"],
        ["Celular", "Vendedor", "Interface otimizada para o aplicativo do vendedor"],
    ]
    story.append(make_table(disp_data, [5 * cm, 4.5 * cm, 6.2 * cm], font_size=10))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 13 — BENEFÍCIOS PARA O NEGÓCIO
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("13", "Benefícios para o Negócio")

    story.append(Paragraph(
        "O RJNet Gestão de Eventos entrega resultados tangíveis para as principais "
        "áreas da empresa envolvidas em ações comerciais em campo.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    areas = [
        ("📢", "Marketing", [
            "Planejamento centralizado de todos os eventos em uma única plataforma",
            "Visibilidade em tempo real do desempenho de cada ação",
            "Controle total do estoque de materiais sem planilhas",
            "Relatórios prontos para apresentação sem trabalho manual adicional",
        ]),
        ("💼", "Comercial / Vendas", [
            "Captação de leads mais rápida e padronizada em campo",
            "Classificação por temperatura facilita priorização do follow-up",
            "Exportação direta para ferramentas de vendas e CRM",
            "Ranking visível mantém equipe motivada e competitiva",
        ]),
        ("🏢", "Diretoria / Gestão", [
            "Indicadores atualizados em tempo real sem depender de relatórios manuais",
            "Histórico completo de todos os eventos realizados",
            "Rastreabilidade: sabe-se quem registrou cada lead e quando",
            "Tomada de decisão baseada em dados reais da operação",
        ]),
        ("⚙️", "Operação", [
            "Eliminação de planilhas e processos manuais paralelos",
            "Continuidade da operação mesmo com instabilidade de internet",
            "Check-in por CPF evita duplicidades e melhora qualidade dos dados",
            "Gestão de devolução de materiais reduz perdas e extravios",
        ]),
    ]

    for icon, area, beneficios in areas:
        story.append(Paragraph(f"<b>{icon}  {area}</b>",
                               ParagraphStyle("areah", fontName="Helvetica-Bold",
                                              fontSize=12, textColor=PRETO,
                                              spaceBefore=4)))
        for b in beneficios:
            story.append(Paragraph(
                f"<font color='#F5C000'>✓</font>  {b}",
                ParagraphStyle("benef", fontName="Helvetica", fontSize=10.5,
                               leading=16, leftIndent=12, textColor=colors.HexColor("#222222"),
                               spaceBefore=2),
            ))
        story.append(Spacer(1, 8))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SLIDE 14 — RESUMO EXECUTIVO
    # ══════════════════════════════════════════════════════════════════════
    story += slide_header("14", "Resumo Executivo")

    story.append(Paragraph(
        "Uma síntese objetiva do que o sistema entrega hoje para a RJNet.",
        S["body"]
    ))
    story.append(Spacer(1, 14))

    # Bloco 1
    story.append(Paragraph("O que o sistema entrega hoje?", S["h3_am"]))
    story.append(ColorLine(AMARELO, thickness=1.5))
    story.append(Spacer(1, 8))
    entrega = [
        "Plataforma completa de gerenciamento de eventos comerciais em campo",
        "Captação digital de leads com dados padronizados e rastreáveis",
        "Controle de estoque de materiais promocionais com alertas automáticos",
        "Dashboard em tempo real com KPIs da operação",
        "Ferramenta de check-in por CPF para confirmação de participantes",
        "Aplicativo mobile para vendedores com registro rápido e ranking da equipe",
        "Exportação de dados para continuidade no processo de vendas",
        "Gestão completa de usuários com controle de acesso por perfil",
    ]
    for e in entrega:
        story.append(Paragraph(
            f"<font color='#22C55E'><b>✓</b></font>  {e}",
            ParagraphStyle("ent", fontName="Helvetica", fontSize=10.5, leading=16,
                           leftIndent=12, textColor=colors.HexColor("#222222"), spaceBefore=2),
        ))
    story.append(Spacer(1, 14))

    # Bloco 2
    story.append(Paragraph("Quais processos são automatizados?", S["h3"]))
    story.append(ColorLine(colors.HexColor("#AAAAAA"), thickness=1))
    story.append(Spacer(1, 8))
    processos = [
        ["Processo", "Como era antes", "Como é com o sistema"],
        ["Registro de leads", "Papel ou planilha em campo", "App no celular, em tempo real"],
        ["Controle de materiais", "Planilha manual", "Estoque automático com alertas"],
        ["Relatório de eventos", "Consolidação após o evento", "Dashboard em tempo real"],
        ["Confirmação de presença", "Lista impressa ou memória", "Check-in por CPF instantâneo"],
        ["Exportação de contatos", "Transcrição manual", "Download CSV com 1 clique"],
        ["Ranking da equipe", "Apuração manual", "Atualizado automaticamente"],
    ]
    story.append(make_table(processos, [3.8 * cm, 5.2 * cm, 6.7 * cm], font_size=9.5))
    story.append(Spacer(1, 14))

    # Bloco 3
    story.append(Paragraph("Áreas beneficiadas", S["h3"]))
    story.append(Spacer(1, 6))
    areas_benef = [
        ["Marketing", "Vendas / Comercial", "Diretoria", "Operação"],
        ["Planejamento\nRelatórios\nEstoque", "Captação de leads\nRanking\nProdutividade",
         "KPIs em tempo real\nHistórico\nRastreabilidade", "Logística\nCheck-in\nSincronização"],
    ]
    t_areas = Table(areas_benef, colWidths=[3.9 * cm, 3.9 * cm, 3.9 * cm, 3.9 * cm])
    t_areas.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), CINZA_ESC),
        ("TEXTCOLOR", (0, 0), (-1, 0), AMARELO),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [CINZA_CLA]),
    ]))
    story.append(t_areas)

    # ── CONSTRUIR ──────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=lambda c, d: None, onLaterPages=add_page_num)
    print(f"PDF gerado: {path}")
    return path


if __name__ == "__main__":
    build_pdf()
