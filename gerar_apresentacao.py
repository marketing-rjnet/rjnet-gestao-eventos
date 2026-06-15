#!/usr/bin/env python3
"""Gerador de apresentacao executiva - RJNET - GESTAO DE EVENTOS."""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable
import datetime

# Cores corporativas
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

NOME_SISTEMA = "RJNET - GESTAO DE EVENTOS"
NOME_EMPRESA = "RJNET"


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
    }


S = build_styles()


def add_page_num(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(colors.HexColor("#AAAAAA"))
    canvas_obj.drawRightString(W - 1.5 * cm, 1 * cm, f"Pagina {doc.page}")
    canvas_obj.drawString(1.5 * cm, 1 * cm,
                          f"{NOME_SISTEMA} - Documento Confidencial")
    canvas_obj.setStrokeColor(colors.HexColor("#EEEEEE"))
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(1.5 * cm, 1.3 * cm, W - 1.5 * cm, 1.3 * cm)
    canvas_obj.restoreState()


def slide_header(num, title):
    return [
        Paragraph(f"Slide {num}", S["slide_num"]),
        Spacer(1, 2),
        ColorLine(AMARELO, thickness=3),
        Spacer(1, 8),
        Paragraph(title, S["h2"]),
        Spacer(1, 6),
    ]


def bullet(text):
    return Paragraph(f"- {text}", S["bullet"])


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


def kpi_table(items):
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
    ])
    t = Table(rows, colWidths=[1.2 * cm, 14 * cm])
    t.setStyle(ts)
    return t


def build_pdf():
    path = "/home/user/rjnet-gestao-eventos/RJNET_Gestao_Eventos_Apresentacao_Executiva.pdf"
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.8 * cm,
        bottomMargin=2 * cm,
        title=f"{NOME_SISTEMA} - Apresentacao Executiva",
        author=NOME_EMPRESA,
        subject="Documentacao Executiva do Sistema",
    )

    story = []

    # CAPA
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
            c.setFont("Helvetica-Bold", 36)
            c.drawString(2 * cm, H - 5.5 * cm, "RJNET")
            c.setFont("Helvetica-Bold", 22)
            c.drawString(2 * cm, H - 6.8 * cm, "GESTAO DE EVENTOS")

            c.setStrokeColor(AMARELO)
            c.setLineWidth(2)
            c.line(2 * cm, H - 7.6 * cm, W - 2 * cm, H - 7.6 * cm)

            c.setFillColor(colors.HexColor("#DDDDDD"))
            c.setFont("Helvetica", 14)
            c.drawString(2 * cm, H - 8.6 * cm,
                         "Apresentacao Executiva do Sistema de Gerenciamento")

            c.setFillColor(AMARELO)
            c.setFont("Helvetica-Bold", 10)
            hoje = datetime.date.today().strftime("%B de %Y").capitalize()
            c.drawString(2 * cm, H - 9.5 * cm, f"Versao {hoje}")

            c.setFillColor(colors.HexColor("#AAAAAA"))
            c.setFont("Helvetica", 9)
            temas = [
                "Visao Geral do Produto",
                "Perfis de Usuario",
                "Modulos do Sistema",
                "Indicadores e Relatorios",
                "Beneficios para o Negocio",
            ]
            y = H - 11.8 * cm
            for t in temas:
                c.drawString(2 * cm, y, f">  {t}")
                y -= 0.55 * cm

            c.setFillColor(AMARELO)
            c.setFont("Helvetica-Bold", 18)
            c.drawString(2 * cm, 3 * cm, "RJNET")
            c.setFillColor(BRANCO)
            c.setFont("Helvetica", 11)
            c.drawString(2 * cm, 2.3 * cm, "Documento Confidencial - Uso Interno")

    story.append(CoverPage())
    story.append(PageBreak())

    # SUMARIO
    story.append(Paragraph("Sumario", S["h1"]))
    story.append(ColorLine(AMARELO, thickness=3))
    story.append(Spacer(1, 14))

    sumario_items = [
        ("01", "Visao Geral do Sistema"),
        ("02", "Fluxo Geral da Operacao"),
        ("03", "Perfis de Usuario"),
        ("04", "Modulo Dashboard"),
        ("05", "Modulo Eventos"),
        ("06", "Modulo Estoque"),
        ("07", "Modulo Leads"),
        ("08", "Modulo Check-in"),
        ("09", "Modulo Equipe"),
        ("10", "Aplicativo do Vendedor"),
        ("11", "Indicadores e Relatorios"),
        ("12", "Integracao e Sincronizacao"),
        ("13", "Beneficios para o Negocio"),
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

    # SLIDE 01 - VISAO GERAL
    story += slide_header("01", "Visao Geral do Sistema")

    story.append(Paragraph(
        "O <b>RJNET - Gestao de Eventos</b> e a plataforma central que a RJNET utiliza para "
        "planejar, executar e monitorar suas acoes comerciais em campo. O sistema conecta "
        "a equipe de marketing aos vendedores, centralizando em um unico lugar tudo o que "
        "acontece antes, durante e depois de cada evento.",
        S["body"]
    ))
    story.append(Spacer(1, 10))

    info_data = [
        ["Objetivo Principal",
         "Gerenciar eventos comerciais da RJNET de ponta a ponta: desde o planejamento "
         "e alocacao de materiais ate a captacao de leads e acompanhamento de resultados."],
        ["Problema Resolvido",
         "Elimina o uso de planilhas e processos manuais dispersos, reunindo controle de "
         "equipe, estoque de materiais, captacao de leads e relatorios em um unico sistema "
         "acessivel de qualquer dispositivo."],
        ["Publico que Utiliza",
         "Time de Marketing (gestao completa) e Equipe Comercial/Vendedores "
         "(registro de leads e consulta de informacoes do evento)."],
        ["Como e Acessado",
         "Via navegador de internet (computador, tablet ou celular) sem necessidade "
         "de instalacao de aplicativo."],
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
        ("📅", "Gestao de Eventos", "Cadastro, acompanhamento e encerramento de eventos comerciais"),
        ("📦", "Controle de Estoque", "Gerenciamento de materiais promocionais com alertas automaticos"),
        ("👥", "Captacao de Leads", "Registro rapido de potenciais clientes diretamente no campo"),
        ("📊", "Relatorios em Tempo Real", "KPIs, graficos e rankings atualizados automaticamente"),
        ("🔍", "Check-in por CPF", "Verificacao instantanea de participantes cadastrados"),
        ("🏆", "Ranking da Equipe", "Placar de desempenho visivel para toda a equipe em tempo real"),
    ]
    story.append(kpi_table(caps))

    story.append(PageBreak())

    # SLIDE 02 - FLUXO GERAL
    story += slide_header("02", "Fluxo Geral da Operacao")

    story.append(Paragraph(
        "O sistema acompanha toda a jornada de um evento comercial, do planejamento "
        "ao fechamento. Abaixo esta o fluxo completo de como a operacao funciona na pratica:",
        S["body"]
    ))
    story.append(Spacer(1, 14))

    etapas = [
        ("1", "PLANEJAMENTO", "O time de marketing cadastra o evento com local, datas, "
          "tipo e observacoes. Sao definidos quais materiais serao levados para o campo."),
        ("2", "PREPARACAO", "Os materiais promocionais sao alocados ao evento. "
          "O sistema calcula automaticamente a disponibilidade do estoque e "
          "sinaliza itens em quantidade critica."),
        ("3", "EVENTO EM CAMPO", "A equipe de vendas acessa o aplicativo no celular. "
          "Cada vendedor registra leads com nome, telefone, servico de interesse e "
          "temperatura de interesse. O ranking da equipe e visivel em tempo real."),
        ("4", "ACOMPANHAMENTO", "O marketing acompanha pelo dashboard os indicadores "
          "do evento: total de leads, performance por vendedor e servicos mais demandados."),
        ("5", "ENCERRAMENTO", "Ao final do evento, os materiais sao confirmados como "
          "devolvidos ao estoque. O evento e finalizado no sistema, preservando "
          "todos os dados para analise."),
        ("6", "ANALISE E CONVERSAO", "O time comercial acessa os leads capturados, "
          "filtra por servico ou evento, acompanha a temperatura de cada contato "
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

    # SLIDE 03 - PERFIS DE USUARIO
    story += slide_header("03", "Perfis de Usuario")

    story.append(Paragraph(
        "O sistema possui dois perfis de acesso distintos, cada um com um conjunto de "
        "funcionalidades adequado a sua funcao na operacao.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Perfil: Marketing (Administrador)", S["h3_am"]))
    story.append(ColorLine(AMARELO, thickness=1.5))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Responsavel pela gestao completa do sistema. Tem acesso irrestrito a todas "
        "as funcionalidades e informacoes.",
        S["body"]
    ))
    story.append(Spacer(1, 6))

    mkt_data = [
        ["Area", "O que pode fazer"],
        ["Eventos", "Criar, editar, finalizar e excluir eventos"],
        ["Estoque", "Cadastrar materiais, alocar por evento, confirmar devolucoes"],
        ["Leads", "Visualizar todos os leads, filtrar, exportar para CSV"],
        ["Equipe", "Cadastrar, editar, ativar/desativar e excluir usuarios"],
        ["Dashboard", "Ver KPIs, graficos e alertas de toda a operacao"],
        ["Check-in", "Verificar presenca de participantes pelo CPF"],
        ["Relatorios", "Acompanhar desempenho por vendedor, evento e servico"],
    ]
    story.append(make_table(mkt_data, [4 * cm, 11.7 * cm], font_size=10))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Perfil: Vendedor (Equipe Comercial)", S["h3"]))
    story.append(ColorLine(colors.HexColor("#AAAAAA"), thickness=1.5))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Focado na operacao em campo. Acessa uma visao simplificada e otimizada para "
        "celular, com apenas as funcoes necessarias para registrar e gerenciar seus leads.",
        S["body"]
    ))
    story.append(Spacer(1, 6))

    vend_data = [
        ["Area", "O que pode fazer"],
        ["Registrar Leads", "Cadastrar novos leads com formulario rapido (modo rapido disponivel)"],
        ["Meus Leads", "Ver, editar e atualizar a temperatura dos proprios leads"],
        ["Informacoes do Evento", "Consultar local, datas e detalhes do evento em curso"],
        ["Ranking da Equipe", "Acompanhar o placar de todos os vendedores em tempo real"],
        ["Tabela de Pacotes", "Consultar planos e precos da RJNET durante o atendimento"],
    ]
    story.append(make_table(vend_data, [4 * cm, 11.7 * cm], font_size=10))

    story.append(PageBreak())

    # SLIDE 04 - DASHBOARD
    story += slide_header("04", "Modulo Dashboard")

    story.append(Paragraph(
        "A tela inicial do marketing concentra os principais indicadores da operacao, "
        "permitindo uma leitura rapida do desempenho geral sem necessidade de navegar "
        "por outros modulos.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Indicadores Exibidos (KPIs)", S["h3"]))
    story.append(Spacer(1, 6))

    kpi_data = [
        ["Indicador", "O que representa", "Acao"],
        ["Eventos Ativos", "Quantidade de eventos em andamento no momento", "Tomada de decisao sobre campo"],
        ["Total de Leads", "Soma de todos os leads captados no sistema", "Acompanhar resultado global"],
        ["Materiais Criticos", "Itens de estoque sem disponibilidade (alerta em vermelho)", "Agir sobre reposicao urgente"],
        ["Vendedores Ativos", "Numero de vendedores com acesso ativo ao sistema", "Gestao de equipe"],
    ]
    story.append(make_table(kpi_data, [3.8 * cm, 6.5 * cm, 5.4 * cm], font_size=9.5))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Grafico: Leads por Servico", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Grafico em formato de rosca que exibe a distribuicao dos leads por tipo de servico "
        "de interesse. Mostra em proporcao quantos leads demonstraram interesse em "
        "<b>Fibra Residencial</b>, <b>Fibra Empresarial</b>, <b>RJNET Movel/Streamings</b> e "
        "<b>Outros</b>. Facilita a identificacao de quais servicos tem maior demanda nos eventos.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Proximos Eventos", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Lista os proximos 3 eventos com data mais proxima, mostrando nome, periodo e "
        "status atual (Planejado ou Ativo). Permite a lideranca ter visao antecipada "
        "da agenda de campo sem sair da tela principal.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Valor para o Negocio", S["h3"]))
    story.append(Spacer(1, 6))
    beneficios_dash = [
        ("📈", "Visao executiva instantanea", "Todos os numeros relevantes em uma unica tela"),
        ("🔴", "Alertas automaticos", "Materiais criticos destacados em vermelho para acao imediata"),
        ("📅", "Agenda antecipada", "Proximos eventos visiveis sem precisar navegar"),
        ("🎯", "Foco na conversao", "Distribuicao de servicos orienta esforcos comerciais"),
    ]
    story.append(kpi_table(beneficios_dash))

    story.append(PageBreak())

    # SLIDE 05 - MODULO EVENTOS
    story += slide_header("05", "Modulo Eventos")

    story.append(Paragraph(
        "Central de controle de todos os eventos comerciais da RJNET. E neste modulo "
        "que a operacao de campo tem inicio e encerramento formal.",
        S["body"]
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Informacoes Registradas em Cada Evento", S["h3"]))
    story.append(Spacer(1, 6))

    campos_ev = [
        ["Campo", "Descricao"],
        ["Nome do Evento", "Identificacao do evento (ex.: Acao Centro Junho)"],
        ["Local", "Endereco completo onde o evento sera realizado"],
        ["Data de Inicio e Fim", "Periodo de realizacao do evento"],
        ["Tipo", "Sinalizacao / Presenca Comercial / Ativacao Especial"],
        ["Status", "Planejado, Ativo ou Encerrado"],
        ["Observacoes", "Informacoes complementares para a equipe"],
    ]
    story.append(make_table(campos_ev, [5 * cm, 10.7 * cm], font_size=10))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Ciclo de Vida do Evento", S["h3"]))
    story.append(Spacer(1, 6))

    ciclo = Table(
        [[
            Paragraph("PLANEJADO\nEvento cadastrado,\nainda nao iniciado",
                      ParagraphStyle("cic", fontName="Helvetica", fontSize=9.5,
                                     leading=14, alignment=TA_CENTER)),
            Paragraph(">",
                      ParagraphStyle("arr", fontName="Helvetica-Bold",
                                     fontSize=18, textColor=AMARELO,
                                     alignment=TA_CENTER)),
            Paragraph("ATIVO\nEvento em andamento,\nrecebe novos leads",
                      ParagraphStyle("cic2", fontName="Helvetica", fontSize=9.5,
                                     leading=14, alignment=TA_CENTER)),
            Paragraph(">",
                      ParagraphStyle("arr2", fontName="Helvetica-Bold",
                                     fontSize=18, textColor=AMARELO,
                                     alignment=TA_CENTER)),
            Paragraph("ENCERRADO\nEvento finalizado,\ndados preservados",
                      ParagraphStyle("cic3", fontName="Helvetica", fontSize=9.5,
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
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
    ]))
    story.append(ciclo)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Gestao de Materiais por Evento", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Dentro de cada evento, e possivel alocar materiais do estoque e acompanhar "
        "sua utilizacao. Ao final do evento, o sistema registra a devolucao de cada "
        "item, reintegrando-o automaticamente ao estoque disponivel.",
        S["body"]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Desempenho por Vendedor (dentro do evento)", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Cada evento exibe um grafico de barras com a quantidade de leads captados "
        "por cada vendedor, alem de uma tabela completa com todos os leads registrados "
        "naquele evento: nome, telefone, endereco, servico de interesse e vendedor responsavel.",
        S["body"]
    ))

    story.append(PageBreak())

    # SLIDE 06 - MODULO ESTOQUE
    story += slide_header("06", "Modulo Estoque")

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

    story.append(Paragraph("Classificacao Automatica por Disponibilidade", S["h3"]))
    story.append(Spacer(1, 6))

    status_est = [
        ["Status", "Criterio", "O que fazer"],
        ["CRITICO", "Disponivel = 0 unidades", "Repor ou redistribuir urgentemente"],
        ["ATENCAO", "Disponivel entre 1 e 3 unidades", "Monitorar e planejar reposicao"],
        ["OK", "Disponivel 4 ou mais unidades", "Estoque suficiente para proximos eventos"],
    ]
    story.append(make_table(status_est, [3 * cm, 5.5 * cm, 7.2 * cm], font_size=10))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Como Funciona o Fluxo de Materiais", S["h3"]))
    story.append(Spacer(1, 6))

    fluxo_mat = [
        ("1", "Cadastro", "Material e cadastrado com nome, quantidade total e descricao"),
        ("2", "Alocacao", "Marketing aloca quantidade ao evento. Sistema desconta do disponivel"),
        ("3", "Em Campo", "Material sai para o evento. Status do evento atualiza disponibilidade"),
        ("4", "Devolucao", "Ao final do evento, devolucao e confirmada. Estoque retorna ao disponivel"),
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
    story.append(Paragraph("Beneficios para a Operacao", S["h3"]))
    story.append(Spacer(1, 6))
    benef_est = [
        ("📦", "Visibilidade total", "Sabe-se exatamente onde cada material esta"),
        ("⚡", "Alerta proativo", "Problemas de estoque identificados antes do evento"),
        ("🔄", "Ciclo fechado", "Controle de ida e volta de todos os materiais"),
    ]
    story.append(kpi_table(benef_est))

    story.append(PageBreak())

    # SLIDE 07 - MODULO LEADS
    story += slide_header("07", "Modulo Leads")

    story.append(Paragraph(
        "Central de gestao de todos os contatos comerciais captados nos eventos. "
        "Permite visualizar, filtrar, analisar e exportar leads para continuidade "
        "do processo de vendas.",
        S["body"]
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Informacoes Registradas em Cada Lead", S["h3"]))
    story.append(Spacer(1, 6))

    campos_lead = [
        ["Campo", "Descricao"],
        ["Nome Completo", "Nome do potencial cliente"],
        ["Telefone", "Numero de contato (formatado automaticamente)"],
        ["CPF", "Documento de identificacao (opcional)"],
        ["Endereco", "Endereco do cliente (opcional)"],
        ["Servico de Interesse", "Fibra Residencial / Fibra Empresarial / RJNET Movel / Streamings / Outro"],
        ["Temperatura", "Frio / Morno / Quente / Convertido: grau de interesse do contato"],
        ["Ja e Cliente RJNET?", "Indicador se o lead ja possui algum servico ativo"],
        ["Observacao", "Notas rapidas como: aguardando visita, interesse em combo, etc."],
        ["Vendedor", "Quem registrou o lead no evento"],
        ["Evento", "Em qual evento o lead foi captado"],
    ]
    story.append(make_table(campos_lead, [5 * cm, 10.7 * cm], font_size=9.5))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Temperatura dos Leads", S["h3"]))
    story.append(Spacer(1, 6))

    temp_data = [
        ["Frio", "Demonstrou pouco interesse, contato inicial"],
        ["Morno", "Interesse moderado, precisa de mais informacoes"],
        ["Quente", "Alto interesse, pronto para proximo contato de vendas"],
        ["Convertido", "Fechou contrato ou avancou para proposta concreta"],
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

    story.append(Paragraph("Filtros e Exportacao", S["h3"]))
    story.append(Spacer(1, 6))
    for txt in [
        "- Filtrar leads por <b>evento especifico</b>",
        "- Filtrar por <b>vendedor</b>",
        "- Filtrar por <b>servico de interesse</b>",
        "- <b>Exportar para CSV</b>: arquivo pronto para importacao em CRM, planilha ou ferramenta de e-mail marketing",
        "- O arquivo exportado inclui: nome, CPF, telefone, endereco, servico, temperatura, "
          "se ja e cliente, vendedor, evento, observacao e data de cadastro",
    ]:
        story.append(Paragraph(txt, S["body"]))
        story.append(Spacer(1, 3))

    story.append(PageBreak())

    # SLIDE 08 - MODULO CHECK-IN
    story += slide_header("08", "Modulo Check-in")

    story.append(Paragraph(
        "Ferramenta de verificacao rapida que permite confirmar se um participante "
        "ja esta cadastrado como lead em um evento especifico, utilizando o CPF "
        "como chave de busca.",
        S["body"]
    ))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Como Funciona", S["h3"]))
    story.append(Spacer(1, 6))

    checkin_steps = [
        ("1", "Selecao do Evento", "Escolha o evento para verificar os participantes"),
        ("2", "Digitacao do CPF", "Digite o CPF completo (confirmacao exata) ou parcial (busca ampla)"),
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

    story.append(Spacer(1, 12))
    story.append(Paragraph("Tipos de Resultado", S["h3"]))
    story.append(Spacer(1, 6))

    result_data = [
        ["Resultado", "Quando Ocorre", "Informacoes Exibidas"],
        ["Lead Encontrado", "CPF completo localizado no evento",
         "Nome, CPF, telefone, endereco, servico, temperatura, vendedor e data de cadastro"],
        ["Multiplos Resultados", "CPF parcial com mais de um match",
         "Lista de nomes, CPFs e telefones dos leads encontrados"],
        ["Nao Encontrado", "CPF nao existe no evento selecionado",
         "Mensagem de alerta: participante nao cadastrado"],
    ]
    story.append(make_table(result_data, [3.5 * cm, 4.5 * cm, 7.7 * cm], font_size=9.5))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Aplicacoes Praticas", S["h3"]))
    story.append(Spacer(1, 6))
    apps_ci = [
        ("🔍", "Evitar duplicatas", "Verificar se o cliente ja foi abordado antes de registrar novamente"),
        ("🎟", "Controle de participacao", "Confirmar presenca em eventos com lista de convidados"),
        ("⚡", "Agilidade no atendimento", "Recuperar dados do cliente em segundos pelo CPF"),
    ]
    story.append(kpi_table(apps_ci))

    story.append(PageBreak())

    # SLIDE 09 - MODULO EQUIPE
    story += slide_header("09", "Modulo Equipe")

    story.append(Paragraph(
        "Gerenciamento completo dos usuarios que acessam o sistema. O marketing "
        "tem controle total sobre quem pode registrar leads e quais permissoes "
        "cada pessoa possui.",
        S["body"]
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Informacoes de Cada Membro da Equipe", S["h3"]))
    story.append(Spacer(1, 6))

    equipe_campos = [
        ["Campo", "Descricao"],
        ["Nome Completo", "Nome de exibicao do usuario no sistema"],
        ["E-mail de Login", "Endereco de acesso ao sistema"],
        ["Perfil", "Vendedor (campo) ou Marketing (administracao)"],
        ["Status", "Ativo (acessa o sistema) ou Inativo (bloqueado)"],
        ["Leads Captados", "Total de leads registrados pelo vendedor"],
    ]
    story.append(make_table(equipe_campos, [4.5 * cm, 11.2 * cm], font_size=10))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Acoes Disponiveis pelo Marketing", S["h3"]))
    story.append(Spacer(1, 6))

    acoes_equipe = [
        ("➕", "Adicionar usuario", "Cria novo acesso com nome, e-mail, senha inicial e perfil"),
        ("✏", "Editar usuario", "Atualiza nome e e-mail de qualquer membro"),
        ("🔄", "Alterar perfil", "Muda um vendedor para marketing ou vice-versa"),
        ("🔒", "Ativar ou Desativar", "Bloqueia ou restaura o acesso sem excluir o historico"),
        ("🗑", "Excluir usuario", "Remove definitivamente o acesso, com confirmacao previa"),
    ]
    story.append(kpi_table(acoes_equipe))
    story.append(Spacer(1, 10))

    # KeepTogether garante que a secao de desempenho nao fique sozinha numa pagina
    desempenho_bloco = KeepTogether([
        Paragraph("Desempenho Individual", S["h3"]),
        Spacer(1, 4),
        Paragraph(
            "Cada cartao de vendedor exibe um mini-grafico com o desempenho nos ultimos "
            "eventos e o total de leads captados, facilitando a identificacao de quem "
            "esta entregando melhores resultados sem precisar de relatorios separados.",
            S["body"]
        ),
    ])
    story.append(desempenho_bloco)

    story.append(PageBreak())

    # SLIDE 10 - APLICATIVO DO VENDEDOR
    story += slide_header("10", "Aplicativo do Vendedor")

    story.append(Paragraph(
        "Interface simplificada e otimizada para uso em celular durante os eventos. "
        "O vendedor acessa as funcoes que precisa no campo de forma rapida e intuitiva, "
        "organizadas em 4 abas na parte inferior da tela.",
        S["body"]
    ))
    story.append(Spacer(1, 10))

    abas = [
        ("REGISTRAR", [
            "Formulario de cadastro de novo lead",
            "Modo rapido: exibe apenas os campos essenciais (nome, telefone, servico, temperatura)",
            "Contador de leads do dia com barra de progresso em direcao a meta de 15 leads",
            "Chips de observacao rapida: Mora em area coberta, Aguardando visita tecnica, entre outros",
            "Confirmacao ao registrar com opcao de desfazer por 5 segundos",
        ]),
        ("MEUS LEADS", [
            "Lista de todos os leads registrados pelo vendedor naquele evento",
            "Botoes de acao rapida: ligar diretamente ou abrir WhatsApp",
            "Alteracao da temperatura com um toque: Frio, Morno, Quente ou Convertido",
            "Edicao completa de qualquer lead cadastrado",
        ]),
        ("EVENTO", [
            "Informacoes completas do evento: local, datas, tipo e observacoes",
            "Botao para abrir a localizacao diretamente no Google Maps",
            "Ranking da equipe em tempo real com posicoes destacadas (ouro, prata, bronze)",
        ]),
        ("PACOTES", [
            "Tabela de planos de Internet Fibra com precos",
            "Planos de TV com quantidade de canais e precos, incluindo canais premium",
            "Planos de telefonia movel com franquias de dados",
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
                [[Paragraph(f"- {item}", S["body"])]],
                colWidths=[15.7 * cm],
            )
            row.setStyle(TableStyle([
                ("LEFTPADDING", (0, 0), (-1, -1), 20),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#EEEEEE")),
            ]))
            story.append(row)
        story.append(Spacer(1, 6))

    story.append(PageBreak())

    # SLIDE 11 - INDICADORES E RELATORIOS
    story += slide_header("11", "Indicadores e Relatorios")

    story.append(Paragraph(
        "O sistema oferece multiplas camadas de analise, desde indicadores gerais "
        "da operacao ate o desempenho individual de cada vendedor por evento.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    relatorios = [
        ["Relatorio / Indicador", "Onde encontrar", "O que mostra"],
        ["KPIs gerais", "Dashboard", "Eventos ativos, total de leads, materiais criticos, vendedores ativos"],
        ["Leads por Servico", "Dashboard", "Distribuicao percentual por tipo de servico (grafico de rosca)"],
        ["Leads por Vendedor", "Detalhe do Evento", "Barras comparativas de produtividade por vendedor no evento"],
        ["Leads por Evento", "Aba Leads", "Comparativo de leads captados em cada evento (grafico de barras)"],
        ["Tabela de Leads", "Aba Leads", "Listagem completa com filtros por evento, vendedor e servico"],
        ["Exportacao CSV", "Aba Leads", "Arquivo com todos os dados dos leads para uso externo"],
        ["Desempenho por Vendedor", "Aba Equipe", "Historico nos ultimos eventos com mini-grafico"],
        ["Ranking da Equipe", "App do Vendedor", "Placar em tempo real por evento com posicoes classificadas"],
        ["Resumo por Evento", "Detalhe do Evento", "Total de leads e materiais em campo por evento"],
        ["Controle de Estoque", "Aba Estoque", "Status de disponibilidade de cada material com alertas de cor"],
    ]
    story.append(make_table(relatorios, [4 * cm, 3.5 * cm, 8.2 * cm], font_size=9))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Meta Diaria de Leads", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Cada vendedor possui uma meta de <b>15 leads por evento</b>. O sistema exibe "
        "uma barra de progresso em tempo real no aplicativo do vendedor, incentivando "
        "o desempenho durante o evento. Ao atingir a meta, a barra exibe a mensagem "
        '"Meta batida!".',
        S["body"]
    ))

    story.append(PageBreak())

    # SLIDE 12 - INTEGRACAO E SINCRONIZACAO
    story += slide_header("12", "Integracao e Sincronizacao")

    story.append(Paragraph(
        "O sistema foi projetado para funcionar em dois cenarios: com conexao estavel "
        "de internet e em situacoes de conectividade instavel, que sao comuns durante "
        "eventos em campo.",
        S["body"]
    ))
    story.append(Spacer(1, 14))

    modos = [
        ("🌐", "Modo Online (Padrao)", [
            "Todos os dados sao salvos e sincronizados em tempo real",
            "Alteracoes feitas por qualquer usuario ficam disponiveis para todos instantaneamente",
            "Ranking da equipe e atualizado automaticamente a cada novo lead registrado",
            "Sincronizacao automatica a cada 60 segundos entre dispositivos",
        ]),
        ("📱", "Modo Offline (Automatico)", [
            "Se a conexao cair, o sistema continua funcionando normalmente",
            "Leads registrados sao salvos localmente no dispositivo",
            "Ao reconectar, todos os dados pendentes sao enviados automaticamente",
            "Leads de eventos encerrados durante o periodo offline sao descartados com seguranca",
        ]),
    ]

    for icon, titulo, items in modos:
        story.append(Paragraph(f"{icon}  {titulo}", S["h3_am"]))
        story.append(ColorLine(AMARELO, thickness=1))
        story.append(Spacer(1, 6))
        for item in items:
            story.append(bullet(item))
        story.append(Spacer(1, 12))

    story.append(Paragraph("Acesso Individual por Usuario", S["h3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Cada usuario faz login com seu e-mail e senha individuais. O sistema "
        "reconhece automaticamente o perfil (marketing ou vendedor) e exibe apenas "
        "as funcionalidades correspondentes. Um vendedor nao ve os dados de outros "
        "vendedores; o marketing tem visao completa de todos.",
        S["body"]
    ))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Compatibilidade de Dispositivos", S["h3"]))
    story.append(Spacer(1, 6))

    disp_data = [
        ["Dispositivo", "Perfil Recomendado", "Observacao"],
        ["Computador / Notebook", "Marketing", "Acesso completo a todos os modulos"],
        ["Tablet", "Marketing ou Vendedor", "Boa experiencia em todos os modulos"],
        ["Celular", "Vendedor", "Interface otimizada para o aplicativo do vendedor"],
    ]
    story.append(make_table(disp_data, [5 * cm, 4.5 * cm, 6.2 * cm], font_size=10))

    story.append(PageBreak())

    # SLIDE 13 - BENEFICIOS PARA O NEGOCIO
    story += slide_header("13", "Beneficios para o Negocio")

    story.append(Paragraph(
        "O RJNET - Gestao de Eventos entrega resultados tangiveis para as principais "
        "areas da empresa envolvidas em acoes comerciais em campo.",
        S["body"]
    ))
    story.append(Spacer(1, 10))

    areas = [
        ("📢", "Marketing", [
            "Planejamento centralizado de todos os eventos em uma unica plataforma",
            "Visibilidade em tempo real do desempenho de cada acao",
            "Controle total do estoque de materiais sem planilhas",
            "Relatorios prontos para apresentacao sem trabalho manual adicional",
        ]),
        ("💼", "Comercial e Vendas", [
            "Captacao de leads mais rapida e padronizada em campo",
            "Classificacao por temperatura facilita priorizacao do follow-up",
            "Exportacao direta para ferramentas de vendas e CRM",
            "Ranking visivel mantem equipe motivada e competitiva",
        ]),
        ("🏢", "Diretoria e Gestao", [
            "Indicadores atualizados em tempo real sem depender de relatorios manuais",
            "Historico completo de todos os eventos realizados",
            "Rastreabilidade: sabe-se quem registrou cada lead e quando",
            "Tomada de decisao baseada em dados reais da operacao",
        ]),
        ("⚙", "Operacao", [
            "Eliminacao de planilhas e processos manuais paralelos",
            "Continuidade da operacao mesmo com instabilidade de internet",
            "Check-in por CPF evita duplicidades e melhora qualidade dos dados",
            "Gestao de devolucao de materiais reduz perdas e extravios",
        ]),
    ]

    for icon, area, beneficios in areas:
        story.append(Paragraph(f"<b>{icon}  {area}</b>",
                               ParagraphStyle("areah", fontName="Helvetica-Bold",
                                              fontSize=12, textColor=PRETO,
                                              spaceBefore=4)))
        for b in beneficios:
            story.append(Paragraph(
                f"<font color='#F5C000'>+</font>  {b}",
                ParagraphStyle("benef", fontName="Helvetica", fontSize=10.5,
                               leading=16, leftIndent=12, textColor=colors.HexColor("#222222"),
                               spaceBefore=2),
            ))
        story.append(Spacer(1, 6))

    story.append(PageBreak())

    # SLIDE 14 - RESUMO EXECUTIVO
    story += slide_header("14", "Resumo Executivo")

    story.append(Paragraph(
        "Uma sintese objetiva do que o sistema entrega hoje para a RJNET.",
        S["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("O que o sistema entrega hoje?", S["h3_am"]))
    story.append(ColorLine(AMARELO, thickness=1.5))
    story.append(Spacer(1, 8))
    entrega = [
        "Plataforma completa de gerenciamento de eventos comerciais em campo",
        "Captacao digital de leads com dados padronizados e rastreaveis",
        "Controle de estoque de materiais promocionais com alertas automaticos",
        "Dashboard em tempo real com KPIs da operacao",
        "Ferramenta de check-in por CPF para confirmacao de participantes",
        "Aplicativo mobile para vendedores com registro rapido e ranking da equipe",
        "Exportacao de dados para continuidade no processo de vendas",
        "Gestao completa de usuarios com controle de acesso por perfil",
    ]
    for e in entrega:
        story.append(Paragraph(
            f"<font color='#22C55E'><b>+</b></font>  {e}",
            ParagraphStyle("ent", fontName="Helvetica", fontSize=10.5, leading=16,
                           leftIndent=12, textColor=colors.HexColor("#222222"), spaceBefore=2),
        ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Quais processos sao automatizados?", S["h3"]))
    story.append(ColorLine(colors.HexColor("#AAAAAA"), thickness=1))
    story.append(Spacer(1, 8))
    processos = [
        ["Processo", "Como era antes", "Como e com o sistema"],
        ["Registro de leads", "Papel ou planilha em campo", "App no celular, em tempo real"],
        ["Controle de materiais", "Planilha manual", "Estoque automatico com alertas"],
        ["Relatorio de eventos", "Consolidacao apos o evento", "Dashboard em tempo real"],
        ["Confirmacao de presenca", "Lista impressa ou memoria", "Check-in por CPF instantaneo"],
        ["Exportacao de contatos", "Transcricao manual", "Download CSV com 1 clique"],
        ["Ranking da equipe", "Apuracao manual", "Atualizado automaticamente"],
    ]
    story.append(make_table(processos, [3.8 * cm, 5.2 * cm, 6.7 * cm], font_size=9.5))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Areas beneficiadas", S["h3"]))
    story.append(Spacer(1, 6))
    areas_benef = [
        ["Marketing", "Vendas e Comercial", "Diretoria", "Operacao"],
        ["Planejamento\nRelatorios\nEstoque", "Captacao de leads\nRanking\nProdutividade",
         "KPIs em tempo real\nHistorico\nRastreabilidade", "Logistica\nCheck-in\nSincronizacao"],
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

    doc.build(story, onFirstPage=lambda c, d: None, onLaterPages=add_page_num)
    print(f"PDF gerado: {path}")
    return path


if __name__ == "__main__":
    build_pdf()
