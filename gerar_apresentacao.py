#!/usr/bin/env python3
"""Apresentação executiva visual — RJNET — GESTÃO DE EVENTOS."""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus.flowables import Flowable
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.utils import ImageReader
import datetime, math, os

# ── Fontes ─────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont("LS",  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("LSB", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("LSI", "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"))

# ── Paleta ──────────────────────────────────────────────────────────────────
AM  = colors.HexColor("#F5C000")   # amarelo (primary accent)
PR  = colors.HexColor("#0D0D0D")   # preto (primary text)
CE  = colors.HexColor("#F8F8F8")   # cinza claro (card bg — was #1A1A1A dark)
CM  = colors.HexColor("#E0E0E0")   # borda clara (was #2E2E2E dark)
CL  = colors.HexColor("#FFFFFF")   # branco (page bg)
BR  = colors.white                  # unchanged
VE  = colors.HexColor("#16A34A")   # verde escuro (more readable)
VM  = colors.HexColor("#DC2626")   # vermelho escuro (more readable)
AZ  = colors.HexColor("#2563EB")   # azul escuro (more readable)
LA  = colors.HexColor("#EA580C")   # laranja escuro (more readable)
T1  = colors.HexColor("#0D0D0D")   # texto primário (was white — now black for light theme)
T2  = colors.HexColor("#555555")   # texto secundário
T3  = colors.HexColor("#888888")   # texto terciário

W, H = A4
MW = W - 3.6*cm   # usable width

# ── Estilos ─────────────────────────────────────────────────────────────────
def S(name, **kw):
    base = dict(fontName="LS", fontSize=10, leading=14, textColor=PR)
    base.update(kw)
    return ParagraphStyle(name, **base)

ST = {
    "num":   S("num",  fontName="LS",  fontSize=8,  textColor=T3, alignment=TA_RIGHT),
    "h2":    S("h2",   fontName="LSB", fontSize=17, leading=22, textColor=PR, spaceBefore=4, spaceAfter=2),
    "h3":    S("h3",   fontName="LSB", fontSize=11, leading=15, textColor=PR),
    "h3am":  S("h3am", fontName="LSB", fontSize=11, leading=15, textColor=AM),
    "body":  S("body", fontName="LS",  fontSize=9.5, leading=14, textColor=PR),
    "bull":  S("bull", fontName="LS",  fontSize=9.5, leading=14, textColor=PR, leftIndent=10),
    "white": S("wh",   fontName="LS",  fontSize=9,  textColor=BR),
    "wbold": S("wb",   fontName="LSB", fontSize=10, textColor=BR),
    "cap":   S("cap",  fontName="LS",  fontSize=7.5, textColor=T2, alignment=TA_CENTER),
    "tag":   S("tag",  fontName="LSB", fontSize=7,  textColor=AM),
}

def p(txt, s="body"):  return Paragraph(txt, ST[s])
def sp(n=8):           return Spacer(1, n)

# ── Decorações ──────────────────────────────────────────────────────────────
class ColorLine(Flowable):
    def __init__(self, color=AM, thick=2, w=None):
        super().__init__(); self.col=color; self.thick=thick; self._w=w
    def wrap(self, aW, _):
        self.rw = self._w or aW; return self.rw, self.thick+2
    def draw(self):
        self.canv.setStrokeColor(self.col); self.canv.setLineWidth(self.thick)
        self.canv.line(0, 0, self.rw, 0)

def page_header(num, title, tag=""):
    items = [p(f"Slide {num}", "num"), sp(2), ColorLine(AM, 3), sp(6),
             p(title, "h2")]
    if tag:
        items.append(p(f"▸ {tag}", "tag"))
    items.append(sp(4))
    return items

def bullets(items, color=None):
    out = []
    for it in items:
        col = f"<font color='{color or '#F5C000'}'>▪</font>" if True else "▪"
        out.append(Paragraph(f"{col}  {it}", ST["bull"]))
        out.append(sp(3))
    return out

# ═══════════════════════════════════════════════════════════════════════════
# PRIMITIVAS DE DESENHO
# ═══════════════════════════════════════════════════════════════════════════

def shadow_rect(c, x, y, w, h, r=6, shadow_offset=3):
    c.setFillColor(colors.HexColor("#00000025"))
    c.roundRect(x+shadow_offset, y-shadow_offset, w, h, r, fill=1, stroke=0)

def card(c, x, y, w, h, bg=CE, r=6, border=None, shadow=True):
    if shadow:
        shadow_rect(c, x, y, w, h, r)
    c.setFillColor(bg)
    if border:
        c.setStrokeColor(border); c.setLineWidth(1)
        c.roundRect(x, y, w, h, r, fill=1, stroke=1)
    else:
        c.roundRect(x, y, w, h, r, fill=1, stroke=0)

def badge(c, x, y, w, h, text, bg, fg=BR, r=4, font_size=7):
    c.setFillColor(bg)
    c.roundRect(x, y, w, h, r, fill=1, stroke=0)
    c.setFillColor(fg); c.setFont("LSB", font_size)
    c.drawCentredString(x+w/2, y+h/2-font_size*0.35, text)

def pill(c, x, y, w, h, text, bg, fg=BR, font_size=8):
    badge(c, x, y, w, h, text, bg, fg, r=h/2, font_size=font_size)

def ctext(c, x, y, text, font="LS", size=9, color=T1, anchor="middle"):
    c.setFillColor(color); c.setFont(font, size)
    if anchor=="middle":  c.drawCentredString(x, y, text)
    elif anchor=="left":  c.drawString(x, y, text)
    elif anchor=="right": c.drawRightString(x, y, text)

def fill_poly(c, points, color):
    """Fill a polygon using the proper ReportLab path object API."""
    c.setFillColor(color)
    p = c.beginPath()
    p.moveTo(*points[0])
    for pt in points[1:]:
        p.lineTo(*pt)
    p.close()
    c.drawPath(p, fill=1, stroke=0)

def donut(c, cx, cy, ro, ri, segs, cols):
    """Donut chart. segs: list of fractions summing to 1."""
    ang = 90.0
    for frac, col in zip(segs, cols):
        ext = frac * 360
        end = ang - ext
        steps = max(8, int(ext/4))
        outer = [(cx+ro*math.cos(math.radians(ang-ext*i/steps)),
                  cy+ro*math.sin(math.radians(ang-ext*i/steps)))
                 for i in range(steps+1)]
        inner = [(cx+ri*math.cos(math.radians(end+ext*i/steps)),
                  cy+ri*math.sin(math.radians(end+ext*i/steps)))
                 for i in range(steps+1)]
        fill_poly(c, outer + inner[::-1], col)
        ang = end
    c.setFillColor(CE); c.circle(cx, cy, ri-1, fill=1, stroke=0)

def bar_h(c, x, y, w, h, frac, col, bg=CM):
    """Horizontal bar."""
    c.setFillColor(bg); c.roundRect(x, y, w, h, h/2, fill=1, stroke=0)
    if frac > 0:
        c.setFillColor(col); c.roundRect(x, y, w*frac, h, h/2, fill=1, stroke=0)

def progress_bar(c, x, y, w, h, frac, col=AM, bg=CM):
    bar_h(c, x, y, w, h, frac, col, bg)

# ── Browser frame ───────────────────────────────────────────────────────────
class BrowserFrame(Flowable):
    """Wraps a draw callback in a macOS browser window."""
    def __init__(self, fw, fh, draw_fn, bg=CE):
        super().__init__()
        self.fw=fw; self.fh=fh; self.draw_fn=draw_fn; self.bg=bg
        self.ch=24  # chrome height

    def wrap(self, *_): return self.fw, self.fh

    def draw(self):
        c=self.canv; fw=self.fw; fh=self.fh; ch=self.ch
        # Shadow
        c.setFillColor(colors.HexColor("#00000030"))
        c.roundRect(3,-3,fw,fh,8,fill=1,stroke=0)
        # Window bg
        c.setFillColor(self.bg)
        c.roundRect(0,0,fw,fh,8,fill=1,stroke=0)
        # Chrome
        c.setFillColor(colors.HexColor("#252525"))
        c.roundRect(0,fh-ch,fw,ch,8,fill=1,stroke=0)
        c.rect(0,fh-ch,fw,ch//2,fill=1,stroke=0)
        # Dots
        for i,col in enumerate(["#FF5F56","#FFBD2E","#27C93F"]):
            c.setFillColor(colors.HexColor(col)); c.circle(9+i*13,fh-ch/2,4,fill=1,stroke=0)
        # URL bar
        uw=fw*0.38; ux=(fw-uw)/2
        c.setFillColor(colors.HexColor("#1A1A1A"))
        c.roundRect(ux,fh-ch+4,uw,15,7,fill=1,stroke=0)
        ctext(c,fw/2,fh-ch+9,"app.rjnet.com.br","LS",6.5,T3)
        # Content
        c.saveState(); c.translate(0,0)
        self.draw_fn(c,fw,fh-ch)
        c.restoreState()

# ── Phone frame ──────────────────────────────────────────────────────────────
class PhoneFrame(Flowable):
    def __init__(self, pw, ph, draw_fn, label=""):
        super().__init__()
        self.pw=pw; self.ph=ph; self.draw_fn=draw_fn; self.label=label
        self.bw=14  # bezel width

    def wrap(self, *_):
        return self.pw, self.ph+(20 if self.label else 0)

    def draw(self):
        c=self.canv; pw=self.pw; ph=self.ph; bw=self.bw
        # Shadow
        c.setFillColor(colors.HexColor("#00000030"))
        c.roundRect(3,-3,pw,ph,20,fill=1,stroke=0)
        # Body
        c.setFillColor(colors.HexColor("#111111"))
        c.roundRect(0,0,pw,ph,20,fill=1,stroke=1)
        c.setStrokeColor(colors.HexColor("#444444")); c.setLineWidth(1)
        c.roundRect(0,0,pw,ph,20,fill=0,stroke=1)
        # Screen
        sw=pw-2*bw; sh=ph-bw*2-20
        c.setFillColor(CE)
        c.roundRect(bw,bw+10,sw,sh,10,fill=1,stroke=0)
        # Status bar
        c.setFillColor(colors.HexColor("#0D0D0D"))
        c.rect(bw,bw+10+sh-14,sw,14,fill=1,stroke=0)
        ctext(c,bw+sw/2,bw+10+sh-7,"9:41","LSB",6.5,T2)
        # Notch
        c.setFillColor(colors.HexColor("#111111"))
        c.roundRect(pw/2-18,ph-bw-4,36,8,4,fill=1,stroke=0)
        # Home indicator
        c.setFillColor(colors.HexColor("#444444"))
        c.roundRect(pw/2-20,6,40,4,2,fill=1,stroke=0)
        # Content draw
        c.saveState()
        c.translate(bw, bw+10)
        self.draw_fn(c, sw, sh-14)
        c.restoreState()
        # Label
        if self.label:
            ctext(c,pw/2,-14,self.label,"LSB",8,colors.HexColor("#555555"))

# ── State flow ───────────────────────────────────────────────────────────────
class StateFlow(Flowable):
    def __init__(self, states, w, active=-1):
        """states: [(label, color, sub), ...]"""
        super().__init__(); self.states=states; self.fw=w; self.active=active
        self.h=60

    def wrap(self,*_): return self.fw, self.h

    def draw(self):
        c=self.canv; n=len(self.states); fw=self.fw
        bw=fw/(n*1.6); gap=(fw-n*bw)/(n-1) if n>1 else 0
        x=0
        for i,(lbl,col,sub) in enumerate(self.states):
            is_act = (i==self.active) or self.active==-1
            alpha_bg = col if is_act else colors.HexColor("#F0F0F0")
            alpha_tx = BR if is_act else T3
            # Arrow
            if i>0:
                ax=x-gap
                c.setFillColor(AM if is_act else T3)
                # Triangle arrow
                fill_poly(c,[(ax+2,self.h/2+5),(ax+gap-4,self.h/2),(ax+2,self.h/2-5)],AM if is_act else T3)
            card(c,x,5,bw,self.h-10,bg=alpha_bg,r=8,shadow=False)
            if is_act:
                c.setStrokeColor(col); c.setLineWidth(1.5)
                c.roundRect(x,5,bw,self.h-10,8,fill=0,stroke=1)
            ctext(c,x+bw/2,5+(self.h-10)/2+3,lbl,"LSB",8,alpha_tx)
            if sub: ctext(c,x+bw/2,5+(self.h-10)/2-7,sub,"LS",6.5,
                          T2 if is_act else T3)
            x+=bw+gap

# ═══════════════════════════════════════════════════════════════════════════
# RODAPÉ
# ═══════════════════════════════════════════════════════════════════════════
def footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("LS",7.5); canvas_obj.setFillColor(T3)
    canvas_obj.drawRightString(W-1.5*cm,0.85*cm,f"Página {doc.page}")
    canvas_obj.drawString(1.5*cm,0.85*cm,"RJNET — GESTÃO DE EVENTOS   Documento Confidencial")
    canvas_obj.setStrokeColor(colors.HexColor("#EEEEEE"))
    canvas_obj.setLineWidth(0.4)
    canvas_obj.line(1.5*cm,1.1*cm,W-1.5*cm,1.1*cm)
    canvas_obj.restoreState()

# ═══════════════════════════════════════════════════════════════════════════
# FUNÇÕES DE CONTEÚDO DOS MOCKUPS
# ═══════════════════════════════════════════════════════════════════════════

def draw_app_topbar(c, fw, y_top, title="", tabs=None):
    """RJNET top navigation bar."""
    c.setFillColor(colors.HexColor("#0D0D0D"))
    c.rect(0, y_top-28, fw, 28, fill=1, stroke=0)
    ctext(c,10,y_top-19,"RJNET","LSB",9,AM,"left")
    if title:
        ctext(c,fw/2,y_top-19,title,"LSB",8,T1)
    if tabs:
        step=fw/len(tabs);
        for i,t in enumerate(tabs):
            active=(t==title)
            tx=step*i+step/2
            ctext(c,tx,y_top-19,t,"LSB" if active else "LS",7.5,
                  AM if active else T3)
            if active:
                c.setFillColor(AM)
                c.roundRect(tx-18,y_top-28,36,2,1,fill=1,stroke=0)

def draw_kpi_mini(c, x, y, w, h, value, label, color=AM):
    card(c,x,y,w,h,bg=CE,r=6)
    ctext(c,x+w/2,y+h-20,str(value),"LSB",16,color)
    ctext(c,x+w/2,y+8,label,"LS",6.5,T2)

# ─── DASHBOARD ──────────────────────────────────────────────────────────────
def draw_dashboard(c, fw, fh):
    draw_app_topbar(c,fw,fh, tabs=["Dashboard","Eventos","Estoque","Leads","Equipe"])
    y=fh-30
    # KPI row
    kw=(fw-30)/4; kh=52; ky=y-kh-8
    kpis=[("3",   "Eventos Ativos", AM),
          ("247", "Total de Leads", VE),
          ("0",   "Mat. Críticos",  VM),
          ("8",   "Vendedores",     AZ)]
    for i,(v,l,col) in enumerate(kpis):
        draw_kpi_mini(c,8+i*(kw+4),ky,kw,kh,v,l,col)
    # Donut chart
    cy2=ky-95; cx2=65
    donut(c,cx2,cy2,42,26,
          [0.45,0.30,0.15,0.10],
          [AM,VE,AZ,T3])
    ctext(c,cx2,cy2+2,"247","LSB",9,T1)
    ctext(c,cx2,cy2-8,"leads","LS",6,T2)
    # Legend
    legs=[("Fibra Res.",AM,0.45),("Fibra Emp.",VE,0.30),
          ("RJNET Móvel",AZ,0.15),("Outro",T3,0.10)]
    lx=115; ly=cy2+30
    for lb,col,pct in legs:
        c.setFillColor(col); c.roundRect(lx,ly,7,7,1,fill=1,stroke=0)
        ctext(c,lx+10,ly+1.5,f"{lb}  {int(pct*100)}%","LS",6.5,T2,"left")
        ly-=13
    # Upcoming events
    ex=fw/2+10; ey=ky-15
    ctext(c,ex,ey,"Próximos Eventos","LSB",7.5,T2,"left")
    evts=[("Ação Centro — Jun",  "Ativo",   VE),
          ("Shoping Sul — Jun",  "Planejado",AM),
          ("Terminal Norte",     "Planejado",AM)]
    for ev,st,col in evts:
        ey-=22
        card(c,ex,ey-4,fw-ex-8,18,bg=CM,r=4,shadow=False)
        ctext(c,ex+6,ey+2,ev,"LS",6.5,T1,"left")
        badge(c,fw-ex-30,ey,52,14,st,col,BR,r=3,font_size=5.5)

# ─── EVENTOS ────────────────────────────────────────────────────────────────
def draw_event_list(c, fw, fh):
    draw_app_topbar(c,fw,fh,tabs=["Dashboard","Eventos","Estoque","Leads","Equipe"])
    y=fh-34
    # Filter bar
    c.setFillColor(CM); c.roundRect(8,y-18,fw-16,16,4,fill=1,stroke=0)
    for i,f in enumerate(["Todos","Ativo","Planejado","Encerrado"]):
        fx=16+i*60
        if i==0:
            c.setFillColor(AM); c.roundRect(fx-4,y-16,42,12,3,fill=1,stroke=0)
            ctext(c,fx+17,y-11,f,"LSB",6,PR)
        else:
            ctext(c,fx+17,y-11,f,"LS",6,T3)
    y-=26
    # Event cards
    cards=[
        ("Ação Centro — Junho","Av. Central, 1200","15 Jun → 18 Jun","Presença Comercial","Ativo",VE,34),
        ("Shopping Sul","Av. Sul, 450","22 Jun → 23 Jun","Sinalização","Planejado",AM,12),
        ("Terminal Norte","Rua Norte, 88","28 Jun → 29 Jun","Ativação Especial","Planejado",AM,0),
    ]
    for nome,local,datas,tipo,status,scol,leads in cards:
        ch=52; cw=fw-16
        card(c,8,y-ch,cw,ch,bg=CE,r=6)
        # Status badge
        badge(c,cw-38,y-9,46,13,status,scol,BR,r=3,font_size=5.5)
        ctext(c,14,y-12,nome,"LSB",7.5,T1,"left")
        ctext(c,14,y-22,f"📍 {local}","LS",6,T2,"left")
        ctext(c,14,y-31,f"📅 {datas}","LS",6,T2,"left")
        badge(c,14,y-44,70,11,tipo,CM,T2,r=3,font_size=5.5)
        if leads:
            ctext(c,cw-16,y-38,f"{leads} leads","LS",6,VE,"right")
        y-=ch+6

# ─── LEAD FORM MOBILE ───────────────────────────────────────────────────────
def draw_lead_form(c, sw, sh):
    """Content inside phone screen."""
    c.setFillColor(colors.HexColor("#0D0D0D"))
    c.rect(0,0,sw,sh,fill=1,stroke=0)
    # Header
    c.setFillColor(CE); c.rect(0,sh-26,sw,26,fill=1,stroke=0)
    ctext(c,sw/2,sh-16,"Registrar Lead","LSB",8,AM)
    # Meta bar
    y=sh-40
    ctext(c,6,y,"12 / 15 leads","LS",6.5,T2,"left")
    ctext(c,sw-6,y,"80%","LSB",6.5,VE,"right")
    progress_bar(c,6,y-12,sw-12,5,0.80,VE)
    y-=22
    # Fields
    fields=[("Nome completo *","João da Silva"),
            ("Telefone *","(21) 98765-4321"),
            ("CPF","123.456.789-00")]
    for lbl,val in fields:
        ctext(c,6,y,lbl,"LS",5.5,T2,"left"); y-=12
        c.setFillColor(CM); c.roundRect(6,y-10,sw-12,14,3,fill=1,stroke=0)
        ctext(c,10,y-5,val,"LS",6.5,T1,"left"); y-=20
    # Serviço
    ctext(c,6,y,"Serviço de interesse *","LS",5.5,T2,"left"); y-=12
    svcs=[("Fibra Res.",AM,True),("Fibra Emp.",AZ,False),
          ("Móvel",VE,False),("Outro",T3,False)]
    bw2=(sw-12)/4
    for i,(sv,col,act) in enumerate(svcs):
        bx=6+i*bw2
        c.setFillColor(col if act else CM)
        c.roundRect(bx,y-12,bw2-2,14,3,fill=1,stroke=0)
        ctext(c,bx+bw2/2-1,y-6,sv,"LSB" if act else "LS",5.5,PR if act else T3)
    y-=22
    # Temperatura
    ctext(c,6,y,"Temperatura *","LS",5.5,T2,"left"); y-=12
    temps=[("Frio",AZ),("Morno",LA),("Quente",VM),("Convertido",VE)]
    tw=(sw-12)/4
    for i,(t,col) in enumerate(temps):
        tx=6+i*tw
        c.setFillColor(col); c.roundRect(tx,y-12,tw-2,14,3,fill=1,stroke=0)
        ctext(c,tx+tw/2-1,y-6,t,"LSB",5,BR)
    y-=24
    # Submit
    c.setFillColor(AM); c.roundRect(6,y-16,sw-12,18,5,fill=1,stroke=0)
    ctext(c,sw/2,y-8,"Registrar Lead","LSB",7.5,PR)
    y-=28
    # Bottom nav
    c.setFillColor(CE); c.rect(0,0,sw,24,fill=1,stroke=0)
    tabs=[("Registrar",True),("Leads",False),("Evento",False),("Pacotes",False)]
    ntw=sw/4
    for i,(t,act) in enumerate(tabs):
        nx=i*ntw
        ctext(c,nx+ntw/2,8,t,"LSB" if act else "LS",5.5,AM if act else T3)
        if act:
            c.setFillColor(AM)
            c.roundRect(nx+ntw/2-12,22,24,2,1,fill=1,stroke=0)

# ─── CHECKIN STATES ──────────────────────────────────────────────────────────
def draw_checkin_state(c, sw, sh, state):
    """state: 'typing'|'notfound'|'found'"""
    c.setFillColor(colors.HexColor("#0D0D0D"))
    c.rect(0,0,sw,sh,fill=1,stroke=0)
    c.setFillColor(CE); c.rect(0,sh-26,sw,26,fill=1,stroke=0)
    ctext(c,sw/2,sh-16,"Check-in","LSB",8,AM)
    y=sh-42
    # Evento selector
    c.setFillColor(CM); c.roundRect(6,y-14,sw-12,16,3,fill=1,stroke=0)
    ctext(c,10,y-8,"Ação Centro — Junho","LS",6.5,T1,"left"); y-=26
    # CPF input
    ctext(c,6,y,"Buscar por CPF","LS",5.5,T2,"left"); y-=12
    bord = AM if state=="typing" else (VM if state=="notfound" else VE)
    c.setStrokeColor(bord); c.setLineWidth(1.5)
    c.setFillColor(CM)
    c.roundRect(6,y-18,sw-12,20,4,fill=1,stroke=1)
    cpf_val="123.456.78" if state=="typing" else "123.456.789-00"
    ctext(c,10,y-10,cpf_val,"LSB",7,T1,"left")
    y-=32
    # Result
    if state=="typing":
        c.setFillColor(colors.HexColor("#F5C00020"))
        c.roundRect(6,y-40,sw-12,44,6,fill=1,stroke=0)
        ctext(c,sw/2,y-18,"Digite o CPF...","LSI",7,T3)
    elif state=="notfound":
        c.setFillColor(colors.HexColor("#EF444420"))
        c.setStrokeColor(VM); c.setLineWidth(0.8)
        c.roundRect(6,y-48,sw-12,52,6,fill=1,stroke=1)
        ctext(c,sw/2,y-16,"✗","LSB",18,VM)
        ctext(c,sw/2,y-32,"Não encontrado","LSB",7,VM)
        ctext(c,sw/2,y-42,"CPF não cadastrado","LS",6,T3)
    elif state=="found":
        c.setFillColor(colors.HexColor("#22C55E20"))
        c.setStrokeColor(VE); c.setLineWidth(0.8)
        c.roundRect(6,y-68,sw-12,72,6,fill=1,stroke=1)
        ctext(c,sw/2,y-14,"✓","LSB",14,VE)
        ctext(c,sw/2,y-26,"Lead Confirmado","LSB",7,VE)
        for j,(k,v) in enumerate([("Nome","João da Silva"),
                                   ("CPF","123.456.789-00"),
                                   ("Serviço","Fibra Res."),
                                   ("Temp.","Quente")]):
            yy=y-38-j*10
            ctext(c,10,yy,f"{k}:","LSB",5.5,T3,"left")
            ctext(c,sw-10,yy,v,"LS",5.5,T1,"right")

# ─── ESTOQUE STATES ──────────────────────────────────────────────────────────
def draw_stock_panel(c, fw, fh):
    draw_app_topbar(c,fw,fh,tabs=["Dashboard","Eventos","Estoque","Leads","Equipe"])
    y=fh-34
    # Summary KPIs
    kw=(fw-24)/3; ky=y-44
    for i,(v,l,col) in enumerate([("12","Total Tipos",AM),("340","Total Itens",AZ),("28","Em Campo",LA)]):
        draw_kpi_mini(c,8+i*(kw+4),ky,kw,40,v,l,col)
    y=ky-12
    # Material list grouped
    groups=[
        ("CRÍTICO", VM, [("Banner 3x2",0,12),("Flyer A4",0,8)]),
        ("ATENÇÃO",  LA, [("Brinde Kit",2,20),("Camiseta M",3,15)]),
        ("OK",       VE, [("Totem",8,10),("Caderno",15,20)]),
    ]
    for grp_label,col,mats in groups:
        if y < 30: break
        # Group header
        c.setFillColor(col); c.roundRect(8,y-14,8,12,2,fill=1,stroke=0)
        ctext(c,20,y-9,grp_label,"LSB",7,col,"left")
        y-=20
        for (nome,disp,total) in mats:
            if y < 20: break
            card(c,8,y-22,fw-16,20,bg=CE,r=4,shadow=False)
            ctext(c,14,y-13,nome,"LS",7,T1,"left")
            frac=disp/total if total>0 else 0
            bar_h(c,fw-90,y-13,72,6,frac,col,CM)
            ctext(c,fw-14,y-13,f"{disp}/{total}","LSB",6.5,col,"right")
            y-=26

# ─── ANALYTICS ──────────────────────────────────────────────────────────────
def draw_analytics(c, fw, fh):
    draw_app_topbar(c,fw,fh,tabs=["Dashboard","Eventos","Estoque","Leads","Equipe"])
    y=fh-36
    # Bar chart: leads por evento
    ctext(c,10,y,"Leads por Evento","LSB",8,T2,"left")
    y-=14
    eventos=[("Ação Centro",89,AM),("Shopping Sul",62,AM),
             ("Terminal Norte",47,AM),("Feira TI",35,AM),("Mercado",14,AM)]
    max_v=100; bh=12; gap=5; bstart=90
    for nome,val,col in eventos:
        frac=val/max_v
        ctext(c,88,y-bh/2,nome,"LS",6,T2,"right")
        bar_h(c,bstart,y-bh,fw-bstart-30,bh,frac,col,CM)
        ctext(c,bstart+int((fw-bstart-30)*frac)+4,y-bh/2,
              str(val),"LSB",6,AM,"left")
        y-=bh+gap
    y-=10
    # Donut + ranking side by side
    half=fw/2
    # Donut
    ctext(c,10,y,"Por Serviço","LSB",8,T2,"left"); y-=10
    dcx=50; dcy=y-50
    donut(c,dcx,dcy,36,22,[0.45,0.30,0.15,0.10],[AM,VE,AZ,T3])
    ctext(c,dcx,dcy+2,"247","LSB",8,T1)
    lx=92; ly=dcy+25
    for lb,col in [("Fibra Res.",AM),("Fibra Emp.",VE),
                   ("Móvel",AZ),("Outro",T3)]:
        c.setFillColor(col); c.roundRect(lx,ly,6,6,1,fill=1,stroke=0)
        ctext(c,lx+9,ly+0.5,lb,"LS",6,T2,"left"); ly-=12
    # Ranking
    ctext(c,half+8,y,"Ranking da Equipe","LSB",8,T2,"left")
    ry=y-16
    rank=[("Ana Lima",34,"#FFD700"),("Carlos",28,"#C0C0C0"),
          ("Patrícia",22,"#CD7F32"),("Marcos",18,None),("Juliana",15,None)]
    for i,(nm,pts,col) in enumerate(rank):
        rc = colors.HexColor(col) if col else T3
        ctext(c,half+14,ry,f"{i+1}º  {nm}","LSB" if i<3 else "LS",6.5,rc,"left")
        bar_h(c,half+85,ry-2,fw-half-94,6,pts/40,rc if i<3 else CM,CM)
        ctext(c,fw-10,ry,str(pts),"LSB",6.5,AM,"right")
        ry-=14

# ─── SYNC STATES ────────────────────────────────────────────────────────────
def draw_sync_state(c, sw, sh, state):
    """state: 'online'|'offline'|'syncing'"""
    c.setFillColor(colors.HexColor("#0D0D0D")); c.rect(0,0,sw,sh,fill=1,stroke=0)
    c.setFillColor(CE); c.rect(0,sh-26,sw,26,fill=1,stroke=0)
    ctext(c,sw/2,sh-16,"RJNET","LSB",8,AM)
    # Status indicator
    col  = VE if state=="online" else (VM if state=="offline" else AM)
    icon = "●  Online" if state=="online" else ("✕  Sem conexão" if state=="offline" else "↺  Sincronizando...")
    y=sh-44
    c.setFillColor(col); c.roundRect((sw-90)/2,y-10,90,14,7,fill=1,stroke=0)
    ctext(c,sw/2,y-5,icon,"LSB",6.5,BR)
    y-=30
    # Cards representing leads
    if state=="online":
        for i in range(3):
            card(c,6,y-18,sw-12,16,bg=CE,r=4,shadow=False)
            ctext(c,10,y-10,f"Lead #{i+1}","LS",6.5,T1,"left")
            c.setFillColor(VE); c.circle(sw-12,y-9,4,fill=1,stroke=0)
            y-=22
        ctext(c,sw/2,y-10,"Dados sincronizados","LS",6.5,VE)
    elif state=="offline":
        for i in range(3):
            card(c,6,y-18,sw-12,16,bg=CE,r=4,shadow=False)
            ctext(c,10,y-10,f"Lead #{i+1}","LS",6.5,T1,"left")
            badge(c,sw-44,y-14,36,12,"Pendente",LA,BR,r=3,font_size=5.5)
            y-=22
        ctext(c,sw/2,y-10,"3 leads aguardando envio","LS",6.5,LA)
    else:
        for i in range(3):
            card(c,6,y-18,sw-12,16,bg=CE,r=4,shadow=False)
            ctext(c,10,y-10,f"Lead #{i+1}","LS",6.5,T1,"left")
            badge(c,sw-44,y-14,36,12,"Enviado",VE,BR,r=3,font_size=5.5)
            y-=22
        ctext(c,sw/2,y-10,"Sincronizado!","LSB",7,VE)
        bar_h(c,6,y-24,sw-12,6,1.0,VE,CM)

# ── App mobile — 4 tabs ────────────────────────────────────────────────────
def draw_app_registrar(c,sw,sh): draw_lead_form(c,sw,sh)

def draw_app_meus_leads(c,sw,sh):
    c.setFillColor(colors.HexColor("#0D0D0D")); c.rect(0,0,sw,sh,fill=1,stroke=0)
    c.setFillColor(CE); c.rect(0,sh-26,sw,26,fill=1,stroke=0)
    ctext(c,sw/2,sh-16,"Meus Leads","LSB",8,AM)
    y=sh-38
    leads_m=[("João da Silva","(21) 98765-4321","Fibra Res.",VM,"Quente"),
             ("Ana Costa","(21) 91234-5678","Fibra Emp.",LA,"Morno"),
             ("Marcos Lima","(21) 99876-5432","Móvel",AZ,"Frio")]
    for nm,tel,svc,tcol,temp in leads_m:
        card(c,6,y-44,sw-12,42,bg=CE,r=6,shadow=False)
        ctext(c,10,y-10,nm,"LSB",7,T1,"left")
        badge(c,sw-52,y-14,46,12,temp,tcol,BR,r=6,font_size=5.5)
        ctext(c,10,y-22,tel,"LS",6,T2,"left")
        ctext(c,10,y-31,svc,"LS",6,T2,"left")
        c.setFillColor(AZ); c.roundRect(6,y-44,26,14,3,fill=1,stroke=0)
        ctext(c,6+13,y-38,"Ligar","LSB",5.5,BR)
        c.setFillColor(VE); c.roundRect(36,y-44,30,14,3,fill=1,stroke=0)
        ctext(c,36+15,y-38,"Whats","LSB",5.5,BR)
        y-=50
    c.setFillColor(CE); c.rect(0,0,sw,24,fill=1,stroke=0)
    tabs=[("Registrar",False),("Leads",True),("Evento",False),("Pacotes",False)]
    ntw=sw/4
    for i,(t,act) in enumerate(tabs):
        ctext(c,i*ntw+ntw/2,8,t,"LSB" if act else "LS",5.5,AM if act else T3)
        if act:
            c.setFillColor(AM); c.roundRect(i*ntw+ntw/2-12,22,24,2,1,fill=1,stroke=0)

def draw_app_evento(c,sw,sh):
    c.setFillColor(colors.HexColor("#0D0D0D")); c.rect(0,0,sw,sh,fill=1,stroke=0)
    c.setFillColor(CE); c.rect(0,sh-26,sw,26,fill=1,stroke=0)
    ctext(c,sw/2,sh-16,"Evento","LSB",8,AM)
    y=sh-40
    card(c,6,y-52,sw-12,50,bg=CE,r=6)
    ctext(c,sw/2,y-12,"Ação Centro — Junho","LSB",7.5,AM)
    ctext(c,10,y-24,"📍 Av. Central, 1200","LS",6,T2,"left")
    ctext(c,10,y-34,"📅 15 Jun → 18 Jun","LS",6,T2,"left")
    badge(c,10,y-48,60,11,"Presença Comercial",CM,T2,r=3,font_size=5.5)
    badge(c,sw-58,y-48,50,11,"ATIVO",VE,BR,r=3,font_size=5.5)
    y-=62
    ctext(c,sw/2,y,"Placar da Equipe","LSB",7.5,T2)
    y-=14
    rank_m=[("Ana Lima",34,"#FFD700",1),("Você",28,"#C0C0C0",2),("Carlos",22,"#CD7F32",3)]
    for nm,pts,col,pos in rank_m:
        c.setFillColor(colors.HexColor(col))
        c.roundRect(6,y-14,18,14,3,fill=1,stroke=0)
        ctext(c,6+9,y-8,f"{pos}º","LSB",6.5,PR)
        ctext(c,28,y-8,nm,"LSB",6.5,colors.HexColor(col),"left")
        bar_h(c,sw-50,y-10,40,6,pts/40,colors.HexColor(col),CM)
        ctext(c,sw-6,y-8,str(pts),"LSB",6,AM,"right")
        y-=20
    c.setFillColor(CE); c.rect(0,0,sw,24,fill=1,stroke=0)
    tabs=[("Registrar",False),("Leads",False),("Evento",True),("Pacotes",False)]
    ntw=sw/4
    for i,(t,act) in enumerate(tabs):
        ctext(c,i*ntw+ntw/2,8,t,"LSB" if act else "LS",5.5,AM if act else T3)
        if act:
            c.setFillColor(AM); c.roundRect(i*ntw+ntw/2-12,22,24,2,1,fill=1,stroke=0)

def draw_app_pacotes(c,sw,sh):
    c.setFillColor(colors.HexColor("#0D0D0D")); c.rect(0,0,sw,sh,fill=1,stroke=0)
    c.setFillColor(CE); c.rect(0,sh-26,sw,26,fill=1,stroke=0)
    ctext(c,sw/2,sh-16,"Pacotes","LSB",8,AM)
    y=sh-40
    ctext(c,10,y,"📶 Internet Fibra","LSB",7.5,AM,"left"); y-=14
    planos=[("60 Mega","R$ 49,90"),("120 Mega","R$ 79,90"),
            ("420 Mega ⭐","R$ 99,90"),("680 Mega","R$ 119,90")]
    for pl,val in planos:
        card(c,6,y-14,sw-12,12,bg=CE if "⭐" not in pl else colors.HexColor("#1E1A00"),
             r=3,shadow=False)
        if "⭐" in pl: c.setStrokeColor(AM); c.setLineWidth(0.5)
        ctext(c,10,y-9,pl,"LSB" if "⭐" in pl else "LS",6.5,AM if "⭐" in pl else T1,"left")
        ctext(c,sw-10,y-9,val,"LSB",6.5,AM,"right")
        y-=16
    y-=6
    ctext(c,10,y,"📺 TV","LSB",7.5,AM,"left"); y-=14
    for pl,ch,val in [("Start","27 can.","R$ 29,90"),("Multi+","88 can.","R$ 89,90")]:
        card(c,6,y-14,sw-12,12,bg=CE,r=3,shadow=False)
        ctext(c,10,y-9,pl,"LS",6.5,T1,"left")
        ctext(c,sw/2,y-9,ch,"LS",6,T3)
        ctext(c,sw-10,y-9,val,"LSB",6.5,AM,"right")
        y-=16
    c.setFillColor(CE); c.rect(0,0,sw,24,fill=1,stroke=0)
    tabs=[("Registrar",False),("Leads",False),("Evento",False),("Pacotes",True)]
    ntw=sw/4
    for i,(t,act) in enumerate(tabs):
        ctext(c,i*ntw+ntw/2,8,t,"LSB" if act else "LS",5.5,AM if act else T3)
        if act:
            c.setFillColor(AM); c.roundRect(i*ntw+ntw/2-12,22,24,2,1,fill=1,stroke=0)

SHOTS = "/home/user/rjnet-gestao-eventos/screenshots"

def shot_path(name):
    return os.path.join(SHOTS, name)

class DesktopShot(Flowable):
    """Embeds a real desktop screenshot inside a macOS browser chrome."""
    def __init__(self, img_path, w, add_chrome=True, max_h=None):
        super().__init__()
        self._img_path = img_path
        self._w = w
        self._add_chrome = add_chrome
        self._ch = 22  # chrome bar height
        # Compute height preserving aspect ratio
        ir = ImageReader(img_path)
        iw, ih = ir.getSize()
        ratio = ih / iw
        self._img_h = w * ratio
        if max_h is not None:
            self._img_h = min(self._img_h, max_h)
        self._total_h = self._img_h + (self._ch if add_chrome else 0) + 6  # +6 shadow

    def wrap(self, *_): return self._w, self._total_h

    def draw(self):
        c = self.canv; w = self._w; ch = self._ch
        total_h = self._total_h; img_h = self._img_h
        # Shadow
        c.setFillColor(colors.HexColor("#00000030"))
        c.roundRect(3, -3, w, total_h - 3, 8, fill=1, stroke=0)
        # Browser chrome
        if self._add_chrome:
            c.setFillColor(colors.HexColor("#252525"))
            c.roundRect(0, img_h, w, ch + 3, 8, fill=1, stroke=0)
            c.rect(0, img_h, w, ch // 2, fill=1, stroke=0)
            # Traffic lights
            for i, col in enumerate(["#FF5F56", "#FFBD2E", "#27C93F"]):
                c.setFillColor(colors.HexColor(col))
                c.circle(9 + i * 13, img_h + ch / 2, 3.5, fill=1, stroke=0)
            # URL bar
            uw = w * 0.38; ux = (w - uw) / 2
            c.setFillColor(colors.HexColor("#1A1A1A"))
            c.roundRect(ux, img_h + 4, uw, 14, 6, fill=1, stroke=0)
            ctext(c, w / 2, img_h + 8, "app.rjnet.com.br", "LS", 6, T3)
        # Image
        c.drawImage(self._img_path, 0, 0, width=w, height=img_h,
                    preserveAspectRatio=True, mask="auto")
        # Top border
        c.setStrokeColor(colors.HexColor("#444444")); c.setLineWidth(0.5)
        if self._add_chrome:
            c.roundRect(0, 0, w, total_h - 3, 8, fill=0, stroke=1)

class MobileShot(Flowable):
    """Embeds a real mobile screenshot inside an iPhone-style phone frame."""
    def __init__(self, img_path, ph, label=""):
        super().__init__()
        self._img_path = img_path
        self._ph = ph
        self._label = label
        self._bw = 10  # bezel
        ir = ImageReader(img_path)
        iw, ih = ir.getSize()
        ratio = iw / ih
        self._pw = ph * ratio + 2 * self._bw
        self._label_h = 18 if label else 0

    def wrap(self, *_): return self._pw, self._ph + self._label_h

    def draw(self):
        c = self.canv; pw = self._pw; ph = self._ph; bw = self._bw
        # Shadow
        c.setFillColor(colors.HexColor("#00000030"))
        c.roundRect(3, self._label_h - 3, pw, ph, 16, fill=1, stroke=0)
        # Body
        c.setFillColor(colors.HexColor("#1A1A1A"))
        c.roundRect(0, self._label_h, pw, ph, 16, fill=1, stroke=0)
        c.setStrokeColor(colors.HexColor("#444444")); c.setLineWidth(0.8)
        c.roundRect(0, self._label_h, pw, ph, 16, fill=0, stroke=1)
        # Screen image
        sw = pw - 2 * bw; sh = ph - 2 * bw - 14
        c.drawImage(self._img_path, bw, self._label_h + bw + 7,
                    width=sw, height=sh, preserveAspectRatio=True, mask="auto")
        # Notch
        c.setFillColor(colors.HexColor("#1A1A1A"))
        c.roundRect(pw / 2 - 14, self._label_h + ph - bw - 6, 28, 7, 3, fill=1, stroke=0)
        # Home indicator
        c.setFillColor(colors.HexColor("#555555"))
        c.roundRect(pw / 2 - 16, self._label_h + 5, 32, 3, 1, fill=1, stroke=0)
        # Label
        if self._label:
            ctext(c, pw / 2, 4, self._label, "LSB", 7, T3)

class PhoneRow4(Flowable):
    """Four mobile screenshots side by side."""
    def __init__(self, paths, labels, aW, ph=250):
        super().__init__(); self._paths=paths; self._labels=labels
        self._aW=aW; self._ph=ph
        # calculate widths
        self._frames = []
        for p_, lbl in zip(paths, labels):
            ir = ImageReader(p_); iw, ih = ir.getSize()
            pw = ph * (iw / ih) + 20
            self._frames.append((p_, lbl, pw))
        total = sum(f[2] for f in self._frames)
        scale = aW / total if total > aW else 1.0
        self._frames = [(p_, lbl, pw * scale) for p_, lbl, pw in self._frames]
        self._total_h = ph + 20

    def wrap(self, *_): return self._aW, self._total_h

    def draw(self):
        c = self.canv; x = 0
        for p_, lbl, pw in self._frames:
            mf = MobileShot(p_, self._ph, lbl)
            mf.canv = c; mf.drawOn(c, x, 0)
            x += pw

class PhoneRow3(Flowable):
    """Three mobile screenshots side by side."""
    def __init__(self, paths, labels, aW, ph=260):
        super().__init__(); self._paths=paths; self._labels=labels
        self._aW=aW; self._ph=ph
        self._frames = []
        for p_, lbl in zip(paths, labels):
            ir = ImageReader(p_); iw, ih = ir.getSize()
            pw = ph * (iw / ih) + 20
            self._frames.append((p_, lbl, pw))
        total = sum(f[2] for f in self._frames)
        scale = aW / total if total > aW else 1.0
        self._frames = [(p_, lbl, pw * scale) for p_, lbl, pw in self._frames]
        self._total_h = ph + 20

    def wrap(self, *_): return self._aW, self._total_h

    def draw(self):
        c = self.canv; x = 0
        for p_, lbl, pw in self._frames:
            mf = MobileShot(p_, self._ph, lbl)
            mf.canv = c; mf.drawOn(c, x, 0)
            x += pw

# ═══════════════════════════════════════════════════════════════════════════
# SLIDES
# ═══════════════════════════════════════════════════════════════════════════

def build_pdf():
    path = "/home/user/rjnet-gestao-eventos/RJNET_Gestao_Eventos_Apresentacao_Executiva.pdf"
    doc = SimpleDocTemplate(path, pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=1.5*cm, bottomMargin=2*cm,
        title="RJNET — GESTÃO DE EVENTOS — Apresentação Executiva",
        author="RJNET")
    story = []

    # ─── CAPA ──────────────────────────────────────────────────────────────
    class Cover(Flowable):
        def wrap(self,aW,aH): return aW,aH
        def draw(self):
            c=self.canv
            # Black background
            c.setFillColor(colors.HexColor("#0A0A0A")); c.rect(0,0,W,H,fill=1,stroke=0)
            # Yellow left bar
            c.setFillColor(AM); c.rect(0,0,8,H,fill=1,stroke=0)
            # Yellow top bar
            c.setFillColor(AM); c.rect(0,H-5,W,5,fill=1,stroke=0)
            # RJNET title in yellow
            c.setFillColor(AM); c.setFont("LSB",52)
            c.drawString(2.2*cm, H-4.8*cm, "RJNET")
            # Divider line yellow
            c.setStrokeColor(AM); c.setLineWidth(1.5)
            c.line(2.2*cm,H-5.6*cm,W-2*cm,H-5.6*cm)
            # Subtitle in white
            c.setFillColor(BR); c.setFont("LSB",20)
            c.drawString(2.2*cm,H-6.8*cm,"GESTÃO DE EVENTOS")
            # Sub-subtitle in white (not gray)
            c.setFillColor(BR); c.setFont("LS",11)
            c.drawString(2.2*cm,H-7.8*cm,"Plataforma de Operações Comerciais em Campo")
            # Versão
            c.setFillColor(AM); c.setFont("LSB",9)
            hoje=datetime.date.today().strftime("%B de %Y").capitalize()
            c.drawString(2.2*cm,H-8.8*cm,f"Versão {hoje}  •  Documento Confidencial")
            # Stats hero boxes: dark bg, yellow border, value in yellow, label in white
            for i,(v,l) in enumerate([("247+","Leads Captados"),("12","Eventos"),("8","Vendedores")]):
                bx=2.2*cm+i*5.5*cm; by=H-12*cm
                c.setFillColor(colors.HexColor("#1A1A1A")); c.roundRect(bx,by,4.5*cm,3.2*cm,8,fill=1,stroke=0)
                c.setStrokeColor(AM); c.setLineWidth(1)
                c.roundRect(bx,by,4.5*cm,3.2*cm,8,fill=0,stroke=1)
                c.setFillColor(AM); c.setFont("LSB",28)
                c.drawCentredString(bx+2.25*cm,by+1.8*cm,v)
                c.setFillColor(BR); c.setFont("LS",9)
                c.drawCentredString(bx+2.25*cm,by+0.8*cm,l)
            # Módulos line: white text
            c.setFillColor(BR); c.setFont("LS",9)
            c.drawString(2.2*cm,H-15.5*cm,"Módulos incluídos nesta apresentação:")
            mods=["Dashboard  •  Eventos  •  Leads  •  Check-in  •  Estoque  •  App Mobile  •  Analytics  •  Sincronização"]
            c.setFillColor(BR); c.setFont("LS",9)
            c.drawString(2.2*cm,H-16.4*cm,mods[0])
            # Rodapé capa
            c.setFillColor(AM); c.setFont("LSB",14)
            c.drawString(2.2*cm,2.8*cm,"RJNET")
            c.setFillColor(colors.HexColor("#AAAAAA")); c.setFont("LS",8)
            c.drawString(2.2*cm,2*cm,"Material exclusivo para diretoria e sócios  •  Não distribuir")

    story.append(Cover())
    story.append(PageBreak())

    # ─── SLIDE 01: VISÃO GERAL ──────────────────────────────────────────────
    story += page_header("01","Visao Geral","Sistema de Operacoes Comerciais em Campo")

    # 4 pilares como tabela simples
    def pill_cell(icon, title, desc, col_hex):
        return [
            Paragraph(f'<font color="{col_hex}"><b>{icon}  {title}</b></font>', ST["h3"]),
            sp(4),
            Paragraph(desc, ST["body"]),
        ]

    tdata = [[
        pill_cell("📅","Eventos","Planejamento e controle de acoes comerciais","#F5C000"),
        pill_cell("👥","Leads","Captacao e qualificacao em tempo real","#22C55E"),
        pill_cell("📦","Estoque","Materiais com rastreamento automatico","#60A5FA"),
        pill_cell("📊","Analytics","Relatorios e rankings instantaneos","#FB923C"),
    ]]
    tbl_pillars = Table(
        [[cell[0] for cell in tdata[0]]],
        colWidths=[MW/4]*4,
        style=TableStyle([
            ("BACKGROUND",  (0,0),(-1,-1), colors.white),
            ("ROWBACKGROUNDS",(0,0),(-1,-1),[colors.white]),
            ("TOPPADDING",  (0,0),(-1,-1), 14),
            ("BOTTOMPADDING",(0,0),(-1,-1), 14),
            ("LEFTPADDING", (0,0),(-1,-1), 10),
            ("RIGHTPADDING",(0,0),(-1,-1), 10),
            ("ROUNDEDCORNERS",(0,0),(-1,-1),6),
            ("GRID",        (0,0),(-1,-1), 0.5, colors.HexColor("#E0E0E0")),
            ("VALIGN",      (0,0),(-1,-1), "MIDDLE"),
        ])
    )
    # Subtitles row
    subtitles = [
        Paragraph("Planejamento e controle de acoes comerciais", ST["body"]),
        Paragraph("Captacao e qualificacao em tempo real", ST["body"]),
        Paragraph("Materiais com rastreamento automatico", ST["body"]),
        Paragraph("Relatorios e rankings instantaneos", ST["body"]),
    ]
    tbl_subs = Table([subtitles], colWidths=[MW/4]*4,
        style=TableStyle([
            ("TOPPADDING",(0,0),(-1,-1),6), ("BOTTOMPADDING",(0,0),(-1,-1),6),
            ("LEFTPADDING",(0,0),(-1,-1),10), ("RIGHTPADDING",(0,0),(-1,-1),10),
        ])
    )

    # Simpler: just a 2-row table with bold title + description
    rows_pillars = [
        [Paragraph(f'<font color="{c}"><b>{i}  {t}</b></font>', ST["h3"])
         for i,t,c in [("📅","Eventos","#F5C000"),("👥","Leads","#22C55E"),("📦","Estoque","#60A5FA"),("📊","Analytics","#FB923C")]],
        [Paragraph(d, ST["body"])
         for d in ["Planejamento e controle de acoes","Captacao e qualificacao em tempo real","Materiais com rastreamento","Relatorios e rankings"]],
    ]
    tbl = Table(rows_pillars, colWidths=[MW/4]*4,
        style=TableStyle([
            ("BACKGROUND", (0,0),(-1,-1), colors.white),
            ("BACKGROUND", (0,0),(-1,0), AM),
            ("TOPPADDING", (0,0),(-1,-1), 12), ("BOTTOMPADDING",(0,0),(-1,-1),12),
            ("LEFTPADDING",(0,0),(-1,-1), 10), ("RIGHTPADDING", (0,0),(-1,-1),10),
            ("GRID",       (0,0),(-1,-1), 0.5, colors.HexColor("#E0E0E0")),
            ("VALIGN",     (0,0),(-1,-1), "TOP"),
        ])
    )
    story.append(tbl)
    story.append(sp(14))

    # Perfis de acesso como tabela 2 colunas
    roles = [
        [Paragraph('<font color="#F5C000"><b>👤  MARKETING</b></font>', ST["h3"]),
         Paragraph('<font color="#60A5FA"><b>📱  VENDEDOR</b></font>', ST["h3"])],
        [Paragraph("Gestao completa da plataforma<br/>Eventos · Estoque · Equipe · Analytics", ST["body"]),
         Paragraph("Interface mobile para o campo<br/>Leads · Ranking · Evento · Pacotes", ST["body"])],
    ]
    tbl_roles = Table(roles, colWidths=[MW/2, MW/2],
        style=TableStyle([
            ("BACKGROUND", (0,0),(-1,-1), colors.white),
            ("BACKGROUND", (0,0),(0,0), AM),
            ("BACKGROUND", (1,0),(1,0), PR),
            ("TOPPADDING", (0,0),(-1,-1), 12), ("BOTTOMPADDING",(0,0),(-1,-1),12),
            ("LEFTPADDING",(0,0),(-1,-1), 16), ("RIGHTPADDING", (0,0),(-1,-1),16),
            ("GRID",       (0,0),(-1,-1), 0.5, colors.HexColor("#E0E0E0")),
            ("VALIGN",     (0,0),(-1,-1), "MIDDLE"),
        ])
    )
    story.append(tbl_roles)
    story.append(PageBreak())

    # ─── SLIDE 02: FLUXO OPERACIONAL ─────────────────────────────────────
    story += page_header("02","Fluxo Operacional","Do planejamento a conversao em 6 etapas")

    steps_data = [
        ("1","PLANEJAMENTO","Evento criado com local, datas e materiais","#F5C000"),
        ("2","PREPARACAO",  "Estoque alocado e equipe escalada",          "#60A5FA"),
        ("3","EM CAMPO",    "Vendedores registram leads no mobile",        "#22C55E"),
        ("4","ACOMPANHAMENTO","Dashboard em tempo real para marketing",    "#FB923C"),
        ("5","ENCERRAMENTO","Materiais devolvidos, evento finalizado",     "#A855F7"),
        ("6","ANALISE",     "Leads exportados, resultados apurados",       "#EF4444"),
    ]
    flow_rows = [
        [Paragraph(f'<font color="{c}"><b>{n}. {t}</b></font>', ST["h3"]) for n,t,_,c in steps_data],
        [Paragraph(d, ST["body"]) for _,_,d,_ in steps_data],
    ]
    cw6 = MW / 6
    _flow_style = [
        ("BACKGROUND", (0,0),(-1,-1), colors.white),
        ("TOPPADDING", (0,0),(-1,-1), 12), ("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1), 8),  ("RIGHTPADDING", (0,0),(-1,-1),8),
        ("GRID",       (0,0),(-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ("VALIGN",     (0,0),(-1,-1), "TOP"),
    ]
    for _si, (_,_t,_d,_c) in enumerate(steps_data):
        _flow_style.append(("BACKGROUND", (_si,0), (_si,0), colors.HexColor(_c)))
        _flow_style.append(("TEXTCOLOR", (_si,0), (_si,0), PR))
    tbl_flow = Table(flow_rows, colWidths=[cw6]*6, style=TableStyle(_flow_style))
    story.append(tbl_flow)
    story.append(sp(14))
    story.append(DesktopShot(shot_path("01_dashboard.png"), MW, max_h=220))
    story.append(sp(8))
    story += bullets([
        "Cada etapa e registrada e rastreada pelo sistema em tempo real",
        "Marketing acompanha o funil completo sem sair da plataforma",
        "Dados de todos os eventos ficam preservados para analise historica",
    ])
    story.append(PageBreak())

    # ─── SLIDE 03: DASHBOARD PRINCIPAL ──────────────────────────────────
    story += page_header("03","Dashboard Principal","Visão executiva em tempo real")

    story.append(DesktopShot(shot_path("01_dashboard.png"), MW))
    story.append(sp(10))
    story += bullets([
        "<b>KPIs</b> em tempo real: eventos ativos, leads captados, materiais e vendedores",
        "<b>Gráfico de rosca</b> mostra distribuição de leads por tipo de servico instantaneamente",
        "<b>Agenda</b> dos proximos eventos visivel sem navegar",
    ])
    story.append(PageBreak())

    # ─── SLIDE 04: GESTÃO DE EVENTOS ─────────────────────────────────────
    story += page_header("04","Gestao de Eventos","Ciclo completo do evento em uma tela")

    story.append(StateFlow([
        ("PLANEJADO","Evento criado",AM,"Aguardando inicio"),
        ("ATIVO",    "Em andamento",VE,"Recebe leads"),
        ("ENCERRADO","Finalizado",  T3,"Dados preservados"),
    ], MW, active=-1))
    story.append(sp(8))
    story.append(DesktopShot(shot_path("02_eventos_lista.png"), MW, max_h=230))
    story.append(sp(8))
    story += bullets([
        "Cards com status colorido: Ativo (verde), Planejado (amarelo), Encerrado (cinza)",
        "Cada evento exibe leads captados, vendedores envolvidos e materiais alocados",
        "Evento encerrado trava novos registros e libera materiais ao estoque",
    ])
    story.append(PageBreak())

    # ─── SLIDE 05: CAPTAÇÃO DE LEADS ────────────────────────────────────
    story += page_header("05","Captacao de Leads","Registro rapido e qualificacao instantanea")

    story.append(StateFlow([
        ("FRIO",       "Pouco interesse",      AZ,  "Contato inicial"),
        ("MORNO",      "Interesse moderado",   LA,  "Quer informacoes"),
        ("QUENTE",     "Alto interesse",       VM,  "Pronto p/ venda"),
        ("CONVERTIDO", "Fechou negocio",       VE,  "Contrato ativo"),
    ], MW, active=-1))
    story.append(sp(8))
    story.append(DesktopShot(shot_path("05_leads.png"), MW, max_h=230))
    story.append(sp(8))
    story += bullets([
        "Visualizacao completa de todos os leads com filtros por evento, vendedor e temperatura",
        "Exportacao CSV com 1 clique para importacao em CRM ou planilha",
        "Cada lead registrado pelo vendedor no campo aparece aqui em tempo real",
    ])
    story.append(PageBreak())

    # ─── SLIDE 06: CHECK-IN ──────────────────────────────────────────────
    story += page_header("06","Check-in por CPF","Verificacao instantanea em 3 estados")

    story.append(sp(8))
    # Show three check-in states side by side
    story.append(PhoneRow3(
        [shot_path("06_checkin_vazio.png"),
         shot_path("06_checkin_encontrado.png"),
         shot_path("06_checkin_nao_encontrado.png")],
        ["Aguardando busca", "Lead encontrado", "Nao cadastrado"],
        MW, ph=220
    ))
    story.append(sp(8))
    story += bullets([
        "Busca por CPF retorna dados exatos do lead: nome, servico, temperatura",
        "Resultado 'nao encontrado' em vermelho evita confusao com leads nao cadastrados",
        "Elimina listas impressas e duplicidades de registro no evento",
    ])
    story.append(PageBreak())

    # ─── SLIDE 07: ESTOQUE ───────────────────────────────────────────────
    story += page_header("07","Controle de Estoque","Disponibilidade em tempo real com alertas automaticos")

    story.append(StateFlow([
        ("OK",      "Estoque adequado",    VE, "4+ unidades disponiveis"),
        ("ATENCAO", "Estoque baixo",       LA, "1 a 3 disponiveis"),
        ("CRITICO", "Sem disponibilidade", VM, "0 unidades livres"),
    ], MW, active=-1))
    story.append(sp(8))
    story.append(DesktopShot(shot_path("04_estoque.png"), MW, max_h=220))
    story.append(sp(8))
    story += bullets([
        "Classificacao automatica em 3 niveis: sistema calcula disponibilidade descontando itens em campo",
        "Devolucao confirmada pelo marketing libera o material ao estoque imediatamente",
        "Alertas de estoque critico aparecem no Dashboard sem necessidade de navegar",
    ])
    story.append(PageBreak())

    # ─── SLIDE 08: APLICATIVO MOBILE ────────────────────────────────────
    story += page_header("08","Aplicativo do Vendedor","4 abas — tudo que o time precisa no campo")

    story.append(PhoneRow4(
        [shot_path("08_app_registrar.png"),
         shot_path("09_app_meus_leads.png"),
         shot_path("10_app_evento.png"),
         shot_path("11_app_pacotes.png")],
        ["Registrar", "Meus Leads", "Evento", "Pacotes"],
        MW, ph=260
    ))
    story.append(sp(8))
    story += bullets([
        "<b>Registrar:</b> formulario otimizado para captura rapida de leads no campo",
        "<b>Meus Leads:</b> lista pessoal com acesso direto a ligar ou abrir WhatsApp do cliente",
        "<b>Evento + Pacotes:</b> informacoes do local, ranking da equipe e tabela de precos para consulta",
    ])
    story.append(PageBreak())

    # ─── SLIDE 09: ANALYTICS ─────────────────────────────────────────────
    story += page_header("09","Analytics e Equipe","Dados para decisao em todos os niveis")

    story.append(DesktopShot(shot_path("07_equipe.png"), MW, max_h=250))
    story.append(sp(8))
    story += bullets([
        "Gestao da equipe com desempenho individual e controle de acesso por perfil",
        "Ranking da equipe atualizado em tempo real — visivel no Dashboard e no app do vendedor",
        "Exportacao CSV com 1 clique — dados prontos para CRM ou planilha",
    ])
    story.append(PageBreak())

    # ─── SLIDE 10: SINCRONIZAÇÃO ─────────────────────────────────────────
    story += page_header("10","Sincronizacao Online e Offline","Operacao garantida mesmo sem internet")

    story.append(StateFlow([
        ("ONLINE",        "Conectado",   VE, "Sync em tempo real"),
        ("OFFLINE",       "Sem conexao", VM, "Salva localmente"),
        ("SINCRONIZANDO", "Reconectado", AM, "Envio automatico"),
    ], MW, active=-1))
    story.append(sp(14))

    # Three-column table describing each state
    sync_rows = [
        [Paragraph('<font color="#22C55E"><b>ONLINE</b></font>', ST["h3"]),
         Paragraph('<font color="#EF4444"><b>OFFLINE</b></font>', ST["h3"]),
         Paragraph('<font color="#F5C000"><b>SINCRONIZANDO</b></font>', ST["h3"])],
        [Paragraph("Dados gravados imediatamente no servidor. Ranking atualizado a cada 60 segundos entre dispositivos.", ST["body"]),
         Paragraph("Leads salvos localmente no aparelho. Nenhum dado e perdido, mesmo sem sinal de internet.", ST["body"]),
         Paragraph("Ao reconectar, envio automatico de todos os leads pendentes. Nenhuma acao necessaria do vendedor.", ST["body"])],
    ]
    tbl_sync = Table(sync_rows, colWidths=[MW/3]*3,
        style=TableStyle([
            ("BACKGROUND", (0,0),(-1,-1), colors.white),
            ("TOPPADDING", (0,0),(-1,-1), 14), ("BOTTOMPADDING",(0,0),(-1,-1),14),
            ("LEFTPADDING",(0,0),(-1,-1), 12), ("RIGHTPADDING", (0,0),(-1,-1),12),
            ("GRID",       (0,0),(-1,-1), 0.5, colors.HexColor("#E0E0E0")),
            ("VALIGN",     (0,0),(-1,-1), "TOP"),
        ])
    )
    story.append(tbl_sync)
    story.append(sp(14))
    story.append(PhoneRow3(
        [shot_path("08_app_registrar.png"),
         shot_path("09_app_meus_leads.png"),
         shot_path("10_app_evento.png")],
        ["App com conexao", "Lista de leads", "Info do evento"],
        MW, ph=200
    ))
    story.append(sp(8))
    story += bullets([
        "Leads registrados offline ficam em fila local — enviados automaticamente ao reconectar",
        "Zero perda de dados — o app funciona normalmente em areas sem sinal",
    ])
    story.append(PageBreak())

    # ─── SLIDE 11: BENEFÍCIOS ────────────────────────────────────────────
    story += page_header("11","Beneficios para o Negocio","Impacto direto nas areas da empresa")

    benefit_rows = [
        [Paragraph(f'<font color="{c}"><b>{i}  {t}</b></font>', ST["h3"])
         for i,t,c in [("📢","Marketing","#F5C000"),("💼","Comercial","#22C55E"),
                       ("🏢","Diretoria","#60A5FA"),("⚙","Operacao","#FB923C")]],
        [Paragraph(d, ST["body"]) for d in [
            "Planejamento centralizado<br/>Relatorios automaticos<br/>Estoque sem planilhas",
            "Leads padronizados<br/>Classificacao por temperatura<br/>Exportacao instantanea",
            "KPIs em tempo real<br/>Historico completo<br/>Rastreabilidade total",
            "Elimina processos manuais<br/>Funciona sem internet<br/>Check-in por CPF",
        ]],
    ]
    tbl_benefit = Table(benefit_rows, colWidths=[MW/4]*4,
        style=TableStyle([
            ("BACKGROUND", (0,0),(-1,-1), colors.white),
            ("TOPPADDING", (0,0),(-1,-1), 14), ("BOTTOMPADDING",(0,0),(-1,-1),14),
            ("LEFTPADDING",(0,0),(-1,-1), 12), ("RIGHTPADDING", (0,0),(-1,-1),12),
            ("GRID",       (0,0),(-1,-1), 0.5, colors.HexColor("#E0E0E0")),
            ("VALIGN",     (0,0),(-1,-1), "TOP"),
        ])
    )
    story.append(tbl_benefit)
    story.append(sp(14))
    # Show a composite: login + dashboard side by side as reference
    story.append(DesktopShot(shot_path("03_evento_detalhe.png"), MW, max_h=200))
    story.append(sp(8))
    story += bullets([
        "Um unico sistema substitui planilhas, relatorios manuais e apps descoordenados",
        "Dados rastreaveis do evento ao lead, do lead a conversao",
    ])
    story.append(PageBreak())

    # ─── SLIDE 12: RESUMO EXECUTIVO ──────────────────────────────────────
    story += page_header("12","Resumo Executivo","O que o RJNET Gestao de Eventos entrega hoje")

    # Antes vs. Depois como tabela simples
    before_after = [
        [Paragraph('<font color="#EF4444"><b>ANTES</b></font>', ST["h3"]),
         Paragraph('<font color="#22C55E"><b>COM RJNET</b></font>', ST["h3"])],
        [Paragraph(
            '<font color="#EF4444">✗</font>  Planilhas manuais dispersas<br/>'
            '<font color="#EF4444">✗</font>  Sem controle de materiais<br/>'
            '<font color="#EF4444">✗</font>  Relatorios apenas pos-evento<br/>'
            '<font color="#EF4444">✗</font>  Leads em papel e WhatsApp<br/>'
            '<font color="#EF4444">✗</font>  Ranking apurado manualmente', ST["body"]),
         Paragraph(
            '<font color="#22C55E">✓</font>  Plataforma unica integrada<br/>'
            '<font color="#22C55E">✓</font>  Estoque com alertas automaticos<br/>'
            '<font color="#22C55E">✓</font>  Dashboard em tempo real<br/>'
            '<font color="#22C55E">✓</font>  App mobile para vendedores<br/>'
            '<font color="#22C55E">✓</font>  Ranking atualizado ao vivo', ST["body"])],
    ]
    tbl_ba = Table(before_after, colWidths=[MW/2, MW/2],
        style=TableStyle([
            ("BACKGROUND", (0,0),(0,-1), colors.HexColor("#FFF5F5")),
            ("BACKGROUND", (1,0),(1,-1), colors.HexColor("#F5FFF5")),
            ("TOPPADDING", (0,0),(-1,-1), 14), ("BOTTOMPADDING",(0,0),(-1,-1),14),
            ("LEFTPADDING",(0,0),(-1,-1), 14), ("RIGHTPADDING", (0,0),(-1,-1),14),
            ("GRID",       (0,0),(-1,-1), 0.5, colors.HexColor("#E0E0E0")),
            ("VALIGN",     (0,0),(-1,-1), "TOP"),
        ])
    )
    story.append(tbl_ba)
    story.append(sp(14))

    # Metricas chave como tabela
    metrics_rows = [
        [Paragraph(f'<font color="{c}"><b>{v}</b></font>', S("mv", fontName="LSB", fontSize=22, textColor=colors.HexColor(c), alignment=TA_CENTER))
         for v,l,c in [("6","Modulos integrados","#F5C000"),("2","Perfis de acesso","#60A5FA"),
                       ("15","Meta leads por vendedor","#22C55E"),("60s","Sync entre dispositivos","#FB923C")]],
        [Paragraph(l, S("ml", fontName="LS", fontSize=8, textColor=colors.HexColor("#999999"), alignment=TA_CENTER))
         for _,l,_ in [("6","Modulos integrados","#F5C000"),("2","Perfis de acesso","#60A5FA"),
                       ("15","Meta leads por vendedor","#22C55E"),("60s","Sync entre dispositivos","#FB923C")]],
    ]
    tbl_metrics = Table(metrics_rows, colWidths=[MW/4]*4,
        style=TableStyle([
            ("BACKGROUND", (0,0),(-1,-1), colors.white),
            ("TOPPADDING", (0,0),(-1,-1), 12), ("BOTTOMPADDING",(0,0),(-1,-1),12),
            ("GRID",       (0,0),(-1,-1), 0.5, colors.HexColor("#E0E0E0")),
            ("VALIGN",     (0,0),(-1,-1), "MIDDLE"),
        ])
    )
    story.append(tbl_metrics)
    story.append(sp(14))

    tagline = Table(
        [[Paragraph('<b>RJNET — Gestao de Eventos</b><br/>Do planejamento a conversao — tudo em uma unica plataforma',
                    S("tag2", fontName="LSB", fontSize=12, textColor=PR, alignment=TA_CENTER, leading=18))]],
        colWidths=[MW],
        style=TableStyle([
            ("BACKGROUND", (0,0),(-1,-1), colors.HexColor("#F5C000")),
            ("TOPPADDING", (0,0),(-1,-1), 16), ("BOTTOMPADDING",(0,0),(-1,-1),16),
            ("ROUNDEDCORNERS",(0,0),(-1,-1),6),
        ])
    )
    story.append(tagline)

    doc.build(story, onFirstPage=lambda c,d:None, onLaterPages=footer)
    print(f"PDF gerado: {path}")

# ── StateFlow atualizado com sublabel ──────────────────────────────────────
class StateFlow(Flowable):
    def __init__(self, states, w, active=-1):
        """states: list of (label, sublabel, color, sublabel2)  OR  (label, color, sublabel)"""
        super().__init__()
        self.states=states; self.fw=w; self.active=active; self.h=64
    def wrap(self,*_): return self.fw, self.h
    def draw(self):
        c=self.canv; n=len(self.states); fw=self.fw
        bw=fw/(n*1.55); gap=(fw-n*bw)/(n-1) if n>1 else 0
        x=0
        for i,item in enumerate(self.states):
            # Support both (lbl, sub, col, sub2) and (lbl, col, sub)
            if len(item)==4:
                lbl, sub, col, sub2 = item
            else:
                lbl, col, sub = item; sub2=""
            is_act=(i==self.active) or self.active==-1
            bg2=col if is_act else colors.HexColor("#F0F0F0")
            fg2=BR if is_act else T3
            if i>0:
                ax=x-gap+2; ay=self.h/2
                fill_poly(c,[(ax,ay+5),(ax+gap-4,ay),(ax,ay-5)],AM if is_act else T3)
            card(c,x,6,bw,self.h-12,bg=bg2,r=8,shadow=False)
            if is_act:
                c.setStrokeColor(col); c.setLineWidth(1.5)
                c.roundRect(x,6,bw,self.h-12,8,fill=0,stroke=1)
            cy_box = 6+(self.h-12)/2
            ctext(c,x+bw/2,cy_box+7, lbl,"LSB",8, fg2)
            if sub:  ctext(c,x+bw/2,cy_box-4,  sub, "LS",6.5,T2 if is_act else T3)
            if sub2: ctext(c,x+bw/2,cy_box-14, sub2,"LS",6,  T3)
            x+=bw+gap

if __name__=="__main__":
    build_pdf()
