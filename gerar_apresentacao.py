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
import datetime, math

# ── Fontes ─────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont("LS",  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("LSB", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("LSI", "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"))

# ── Paleta ──────────────────────────────────────────────────────────────────
AM  = colors.HexColor("#F5C000")   # amarelo / accent
PR  = colors.HexColor("#0D0D0D")   # preto
CE  = colors.HexColor("#1A1A1A")   # cinza escuro (card bg)
CM  = colors.HexColor("#2E2E2E")   # cinza médio (borda)
CL  = colors.HexColor("#F4F4F4")   # cinza claro (bg slide)
BR  = colors.white
VE  = colors.HexColor("#22C55E")   # verde
VM  = colors.HexColor("#EF4444")   # vermelho
AZ  = colors.HexColor("#60A5FA")   # azul
LA  = colors.HexColor("#FB923C")   # laranja
T1  = colors.HexColor("#FFFFFF")   # texto primário (em dark)
T2  = colors.HexColor("#B0B0B0")   # texto secundário
T3  = colors.HexColor("#666666")   # texto terciário

W, H = A4
MW = W - 3.6*cm   # usable width

# ── Estilos ─────────────────────────────────────────────────────────────────
def S(name, **kw):
    base = dict(fontName="LS", fontSize=10, leading=14, textColor=PR)
    base.update(kw)
    return ParagraphStyle(name, **base)

ST = {
    "num":   S("num",  fontName="LS",  fontSize=8,  textColor=colors.HexColor("#999999"), alignment=TA_RIGHT),
    "h2":    S("h2",   fontName="LSB", fontSize=17, leading=22, textColor=PR, spaceBefore=4, spaceAfter=2),
    "h3":    S("h3",   fontName="LSB", fontSize=11, leading=15, textColor=PR),
    "h3am":  S("h3am", fontName="LSB", fontSize=11, leading=15, textColor=AM),
    "body":  S("body", fontName="LS",  fontSize=9.5, leading=14, textColor=colors.HexColor("#333333")),
    "bull":  S("bull", fontName="LS",  fontSize=9.5, leading=14, textColor=colors.HexColor("#333333"), leftIndent=10),
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
            alpha_bg = col if is_act else colors.HexColor("#2A2A2A")
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
            # Fundo gradiente visual (dois retangulos)
            c.setFillColor(colors.HexColor("#0A0A0A")); c.rect(0,0,W,H,fill=1,stroke=0)
            c.setFillColor(colors.HexColor("#F5C00008")); c.circle(W*0.8,H*0.7,220,fill=1,stroke=0)
            c.setFillColor(colors.HexColor("#F5C00005")); c.circle(W*0.2,H*0.3,150,fill=1,stroke=0)
            # Barra lateral amarela
            c.setFillColor(AM); c.rect(0,0,8,H,fill=1,stroke=0)
            # Linha topo
            c.setFillColor(AM); c.rect(0,H-5,W,5,fill=1,stroke=0)
            # Nome da empresa
            c.setFillColor(AM); c.setFont("LSB",52)
            c.drawString(2.2*cm, H-4.8*cm, "RJNET")
            # Linha decorativa
            c.setStrokeColor(AM); c.setLineWidth(1.5)
            c.line(2.2*cm,H-5.6*cm,W-2*cm,H-5.6*cm)
            # Subtítulo
            c.setFillColor(BR); c.setFont("LSB",20)
            c.drawString(2.2*cm,H-6.8*cm,"GESTÃO DE EVENTOS")
            c.setFillColor(T2); c.setFont("LS",12)
            c.drawString(2.2*cm,H-7.8*cm,"Plataforma de Operações Comerciais em Campo")
            # Versão
            c.setFillColor(AM); c.setFont("LSB",9)
            hoje=datetime.date.today().strftime("%B de %Y").capitalize()
            c.drawString(2.2*cm,H-8.8*cm,f"Versão {hoje}  •  Documento Confidencial")
            # Stats hero
            for i,(v,l) in enumerate([("247+","Leads Captados"),("12","Eventos"),("8","Vendedores")]):
                bx=2.2*cm+i*5.5*cm; by=H-12*cm
                c.setFillColor(CE); c.roundRect(bx,by,4.5*cm,3.2*cm,8,fill=1,stroke=0)
                c.setStrokeColor(AM); c.setLineWidth(1)
                c.roundRect(bx,by,4.5*cm,3.2*cm,8,fill=0,stroke=1)
                c.setFillColor(AM); c.setFont("LSB",28)
                c.drawCentredString(bx+2.25*cm,by+1.8*cm,v)
                c.setFillColor(T2); c.setFont("LS",9)
                c.drawCentredString(bx+2.25*cm,by+0.8*cm,l)
            # Módulos
            c.setFillColor(T3); c.setFont("LS",9)
            c.drawString(2.2*cm,H-15.5*cm,"Módulos incluídos nesta apresentação:")
            mods=["Dashboard  •  Eventos  •  Leads  •  Check-in  •  Estoque  •  App Mobile  •  Analytics  •  Sincronização"]
            c.setFillColor(T2); c.setFont("LS",9)
            c.drawString(2.2*cm,H-16.4*cm,mods[0])
            # Rodapé capa
            c.setFillColor(AM); c.setFont("LSB",14)
            c.drawString(2.2*cm,2.8*cm,"RJNET")
            c.setFillColor(T3); c.setFont("LS",8)
            c.drawString(2.2*cm,2*cm,"Material exclusivo para diretoria e sócios  •  Não distribuir")

    story.append(Cover())
    story.append(PageBreak())

    # ─── SLIDE 01: VISÃO GERAL ──────────────────────────────────────────────
    story += page_header("01","Visão Geral","Sistema de Operações Comerciais em Campo")

    # Hero: 4 pilares visuais
    class PillarGrid(Flowable):
        def wrap(self,aW,_): self.fw=aW; return aW, 140
        def draw(self):
            c=self.canv; fw=self.fw
            pillars=[
                ("📅","Eventos","Planejamento e controle de ações comerciais",AM),
                ("👥","Leads","Captação e qualificação em tempo real",VE),
                ("📦","Estoque","Materiais com rastreamento automático",AZ),
                ("📊","Analytics","Relatórios e rankings instantâneos",LA),
            ]
            pw=(fw-24)/4
            for i,(ic,tit,sub,col) in enumerate(pillars):
                px=i*(pw+8); py=0
                card(c,px,py,pw,130,bg=CE,r=8)
                c.setFillColor(col); c.roundRect(px+10,py+95,pw-20,26,5,fill=1,stroke=0)
                ctext(c,px+pw/2,py+105,ic,"LS",14,BR)
                ctext(c,px+pw/2,py+80,tit,"LSB",9.5,col)
                # Multi-line sub
                words=sub.split(); line=""; lines_=[]
                for w_ in words:
                    if len(line+" "+w_)*4.5>pw-10: lines_.append(line); line=w_
                    else: line=(line+" "+w_).strip()
                if line: lines_.append(line)
                yy=py+66
                for ln in lines_[:3]:
                    ctext(c,px+pw/2,yy,ln,"LS",6.5,T2); yy-=10

    story.append(PillarGrid())
    story.append(sp(10))

    # Linha de usuários
    class UserRoles(Flowable):
        def wrap(self,aW,_): self.fw=aW; return aW,70
        def draw(self):
            c=self.canv; fw=self.fw
            half=fw/2-8
            # Marketing
            card(c,0,0,half,64,bg=CE,r=8)
            c.setFillColor(AM); c.roundRect(10,44,half-20,16,4,fill=1,stroke=0)
            ctext(c,half/2,50,"👤  MARKETING","LSB",8,PR)
            ctext(c,half/2,32,"Gestão completa da plataforma","LS",7.5,T2)
            ctext(c,half/2,20,"Eventos · Estoque · Equipe · Analytics","LS",7,T3)
            # Vendedor
            card(c,half+16,0,half,64,bg=CE,r=8)
            c.setFillColor(AZ); c.roundRect(half+26,44,half-20,16,4,fill=1,stroke=0)
            ctext(c,half+16+half/2,50,"📱  VENDEDOR","LSB",8,BR)
            ctext(c,half+16+half/2,32,"Interface mobile para o campo","LS",7.5,T2)
            ctext(c,half+16+half/2,20,"Leads · Ranking · Evento · Pacotes","LS",7,T3)

    story.append(UserRoles())
    story.append(PageBreak())

    # ─── SLIDE 02: FLUXO OPERACIONAL ─────────────────────────────────────
    story += page_header("02","Fluxo Operacional","Do planejamento à conversão em 6 etapas")

    class OperationalFlow(Flowable):
        def wrap(self,aW,_): self.fw=aW; return aW, 200
        def draw(self):
            c=self.canv; fw=self.fw
            steps=[
                ("1","PLANEJAMENTO","Evento criado com local, datas e materiais",AM),
                ("2","PREPARAÇÃO","Estoque alocado e equipe escalada",AZ),
                ("3","EM CAMPO","Vendedores registram leads no mobile",VE),
                ("4","ACOMPANHAMENTO","Dashboard em tempo real para marketing",LA),
                ("5","ENCERRAMENTO","Materiais devolvidos, evento finalizado",colors.HexColor("#A855F7")),
                ("6","ANÁLISE","Leads exportados, resultados apurados",VM),
            ]
            sw=(fw-10)/3; sh=82; gap=10
            for i,(num,tit,sub,col) in enumerate(steps):
                col_=i%3; row_=i//3
                sx=col_*(sw+gap); sy=200-row_*(sh+gap)-sh
                card(c,sx,sy,sw,sh,bg=CE,r=8)
                # Color top bar
                c.setFillColor(col); c.roundRect(sx,sy+sh-10,sw,10,8,fill=1,stroke=0)
                c.rect(sx,sy+sh-16,sw,6,fill=1,stroke=0)
                # Number circle
                c.setFillColor(col); c.circle(sx+18,sy+sh-20,9,fill=1,stroke=0)
                ctext(c,sx+18,sy+sh-23,num,"LSB",8,PR)
                ctext(c,sx+32,sy+sh-22,tit,"LSB",8,col,"left")
                # Description
                words=sub.split(); line=""; lines_=[]
                for w_ in words:
                    if len(line+" "+w_)*4.2>sw-16: lines_.append(line); line=w_
                    else: line=(line+" "+w_).strip()
                if line: lines_.append(line)
                yy=sy+sh-42
                for ln in lines_[:3]:
                    ctext(c,sx+10,yy,ln,"LS",7,T2,"left"); yy-=11
                # Row connector arrow
                if col_<2:
                    ax=sx+sw+2; ay=sy+sh/2
                    fill_poly(c,[(ax,ay+4),(ax+gap-2,ay),(ax,ay-4)],T3)

    story.append(OperationalFlow())
    story.append(sp(8))
    story += bullets([
        "Cada etapa é registrada e rastreada pelo sistema em tempo real",
        "Marketing acompanha o funil completo sem sair da plataforma",
        "Dados de todos os eventos ficam preservados para análise histórica",
    ])
    story.append(PageBreak())

    # ─── SLIDE 03: DASHBOARD PRINCIPAL ──────────────────────────────────
    story += page_header("03","Dashboard Principal","Visão executiva em tempo real")

    story.append(BrowserFrame(MW, 320, draw_dashboard))
    story.append(sp(10))
    story += bullets([
        "<b>4 KPIs</b> em tempo real: eventos ativos, leads captados, materiais críticos e vendedores",
        "<b>Gráfico de rosca</b> mostra distribuição de leads por tipo de serviço instantaneamente",
        "<b>Agenda</b> dos próximos eventos visível sem navegar",
    ])
    story.append(PageBreak())

    # ─── SLIDE 04: GESTÃO DE EVENTOS ─────────────────────────────────────
    story += page_header("04","Gestão de Eventos","Ciclo completo do evento em uma tela")

    story.append(StateFlow([
        ("PLANEJADO","Evento criado",AM,"Aguardando início"),
        ("ATIVO",    "Em andamento",VE,"Recebe leads"),
        ("ENCERRADO","Finalizado",  T3,"Dados preservados"),
    ], MW, active=-1))
    story.append(sp(10))
    story.append(BrowserFrame(MW, 270, draw_event_list))
    story.append(sp(8))
    story += bullets([
        "Visualização em cards com status colorido — Ativo (verde), Planejado (amarelo), Encerrado (cinza)",
        "Cada evento exibe leads captados, vendedores envolvidos e materiais alocados",
        "Evento encerrado trava novos registros e libera materiais ao estoque automaticamente",
    ])
    story.append(PageBreak())

    # ─── SLIDE 05: CAPTAÇÃO DE LEADS ────────────────────────────────────
    story += page_header("05","Captação de Leads","Registro rápido e qualificação instantânea")

    # Temperatura flow
    story.append(StateFlow([
        ("FRIO",       "Pouco\ninteresse",     AZ,  "Contato inicial"),
        ("MORNO",      "Interesse\nmoderdo",   LA,  "Quer info"),
        ("QUENTE",     "Alto\ninteresse",      VM,  "Pronto p/ venda"),
        ("CONVERTIDO", "Fechou\nnegócio",      VE,  "Contrato ativo"),
    ], MW, active=-1))
    story.append(sp(10))

    # Phone mockup centered
    class PhoneRow(Flowable):
        def wrap(self,aW,_): self.fw=aW; return aW, 300
        def draw(self):
            c=self.canv; fw=self.fw
            pw=110; ph=270
            # Center the phone
            px=(fw-pw)/2; py=15
            pf=PhoneFrame(pw,ph,draw_lead_form,"App do Vendedor")
            pf.canv=c; pf.drawOn(c,px,py)
            # Left callout
            lx=px-130; ly=py+200
            card(c,lx,ly,118,42,bg=CE,r=6)
            ctext(c,lx+8,ly+30,"Modo Rápido","LSB",8,AM,"left")
            ctext(c,lx+8,ly+18,"Apenas campos","LS",6.5,T2,"left")
            ctext(c,lx+8,ly+8,"essenciais visíveis","LS",6.5,T2,"left")
            # Arrow
            fill_poly(c,[(lx+118,ly+21),(px-4,py+190),(lx+118,ly+14)],AM)
            # Right callout
            rx=px+pw+12; ry=py+150
            card(c,rx,ry,118,42,bg=CE,r=6)
            ctext(c,rx+8,ry+30,"Meta do Dia","LSB",8,VE,"left")
            ctext(c,rx+8,ry+18,"Barra de progresso","LS",6.5,T2,"left")
            ctext(c,rx+8,ry+8,"15 leads por evento","LS",6.5,T2,"left")
            fill_poly(c,[(rx,ry+21),(px+pw+4,py+200),(rx,ry+14)],VE)
            # Right bottom callout
            ry2=py+60
            card(c,rx,ry2,118,52,bg=CE,r=6)
            ctext(c,rx+8,ry2+40,"Temperatura","LSB",8,AM,"left")
            for j,(t,col) in enumerate([("Frio",AZ),("Quente",VM),("Convertido",VE)]):
                c.setFillColor(col); c.roundRect(rx+8+j*36,ry2+22,32,12,3,fill=1,stroke=0)
                ctext(c,rx+8+j*36+16,ry2+27,t,"LSB",5.5,BR)
            ctext(c,rx+8,ry2+8,"Classificação com 1 toque","LS",6,T2,"left")

    story.append(PhoneRow())
    story.append(PageBreak())

    # ─── SLIDE 06: CHECK-IN ──────────────────────────────────────────────
    story += page_header("06","Check-in por CPF","Verificação instantânea em 3 estados")

    class CheckinStates(Flowable):
        def wrap(self,aW,_): self.fw=aW; return aW, 310
        def draw(self):
            c=self.canv; fw=self.fw
            pw=130; ph=280; gap=(fw-3*pw)/2
            configs=[("typing","Digitando CPF...",AM),
                     ("notfound","Não Encontrado",VM),
                     ("found","Lead Confirmado",VE)]
            for i,(state,lbl,col) in enumerate(configs):
                px=i*(pw+gap); py=22
                pf=PhoneFrame(pw,ph,lambda c2,sw,sh,s=state: draw_checkin_state(c2,sw,sh,s),"")
                pf.canv=c; pf.drawOn(c,px,py)
                # State label below
                c.setFillColor(col); c.roundRect(px+pw/2-36,4,72,16,8,fill=1,stroke=0)
                ctext(c,px+pw/2,10,lbl,"LSB",7,BR)
                # Number
                c.setFillColor(col); c.circle(px+pw/2,ph+26,10,fill=1,stroke=0)
                ctext(c,px+pw/2,ph+23,str(i+1),"LSB",8,PR)
            # Connector arrows
            for i in range(2):
                ax=(i+1)*(pw+gap)-gap/2; ay=ph/2+22
                c.setFillColor(AM)
                fill_poly(c,[(ax-6,ay+6),(ax+6,ay),(ax-6,ay-6)],AM)

    story.append(CheckinStates())
    story.append(sp(8))
    story += bullets([
        "Busca por CPF <b>completo</b> retorna dados exatos do lead com todos os detalhes",
        "Busca por CPF <b>parcial</b> lista todos os matches — ideal para localizar contatos rapidamente",
        "Evita duplicidades e confirma participação sem impressão de listas",
    ])
    story.append(PageBreak())

    # ─── SLIDE 07: ESTOQUE ───────────────────────────────────────────────
    story += page_header("07","Controle de Estoque","Disponibilidade em tempo real com alertas automáticos")

    story.append(StateFlow([
        ("OK",      "Estoque\nadequado",     VE, "4+ unid. disponíveis"),
        ("ATENÇÃO", "Estoque\nbaixo",        LA, "1 a 3 disponíveis"),
        ("CRÍTICO", "Sem\ndisponibilidade",  VM, "0 unidades livres"),
    ], MW, active=-1))
    story.append(sp(10))
    story.append(BrowserFrame(MW, 280, draw_stock_panel))
    story.append(sp(8))
    story += bullets([
        "Classificação automática em 3 níveis — sistema calcula disponibilidade descontando itens em campo",
        "Devolução confirmada pelo marketing libera o material ao estoque imediatamente",
        "Alertas de estoque crítico aparecem no Dashboard sem necessidade de navegar",
    ])
    story.append(PageBreak())

    # ─── SLIDE 08: APLICATIVO MOBILE ────────────────────────────────────
    story += page_header("08","Aplicativo do Vendedor","4 abas — tudo que o time precisa no campo")

    class FourPhones(Flowable):
        def wrap(self,aW,_): self.fw=aW; return aW, 290
        def draw(self):
            c=self.canv; fw=self.fw
            pw=98; ph=260; gap=(fw-4*pw)/3
            configs=[
                (draw_app_registrar,"Registrar"),
                (draw_app_meus_leads,"Meus Leads"),
                (draw_app_evento,"Evento"),
                (draw_app_pacotes,"Pacotes"),
            ]
            for i,(fn,lbl) in enumerate(configs):
                px=i*(pw+gap); py=20
                pf=PhoneFrame(pw,ph,fn,lbl)
                pf.canv=c; pf.drawOn(c,px,py)

    story.append(FourPhones())
    story.append(sp(8))
    story += bullets([
        "<b>Registrar:</b> formulário otimizado com modo rápido e meta diária de 15 leads por vendedor",
        "<b>Meus Leads:</b> lista pessoal com acesso direto a ligar ou abrir WhatsApp do cliente",
        "<b>Evento + Pacotes:</b> informações do local, ranking da equipe e tabela de preços para consulta",
    ])
    story.append(PageBreak())

    # ─── SLIDE 09: ANALYTICS ─────────────────────────────────────────────
    story += page_header("09","Analytics e Relatórios","Dados para decisão em todos os níveis")

    story.append(BrowserFrame(MW, 310, draw_analytics))
    story.append(sp(8))
    story += bullets([
        "Gráfico de barras compara performance entre eventos — identifica ações de maior conversão",
        "Ranking da equipe atualizado em tempo real — visível tanto no Dashboard quanto no app do vendedor",
        "Exportação CSV com 1 clique — contém todos os dados para importação em CRM ou planilha",
    ])
    story.append(PageBreak())

    # ─── SLIDE 10: SINCRONIZAÇÃO ─────────────────────────────────────────
    story += page_header("10","Sincronização Online / Offline","Operação garantida mesmo sem internet")

    story.append(StateFlow([
        ("ONLINE",       "Conectado",       VE, "Sync em tempo real"),
        ("OFFLINE",      "Sem conexão",     VM, "Salva localmente"),
        ("SINCRONIZANDO","Reconectado",     AM, "Envio automático"),
    ], MW, active=-1))
    story.append(sp(10))

    class SyncPhones(Flowable):
        def wrap(self,aW,_): self.fw=aW; return aW, 270
        def draw(self):
            c=self.canv; fw=self.fw
            pw=120; ph=250; gap=(fw-3*pw)/2
            configs=[("online","ONLINE",VE),("offline","OFFLINE",VM),("syncing","SINCRONIZANDO",AM)]
            for i,(state,lbl,col) in enumerate(configs):
                px=i*(pw+gap); py=20
                pf=PhoneFrame(pw,ph,lambda c2,sw,sh,s=state: draw_sync_state(c2,sw,sh,s),"")
                pf.canv=c; pf.drawOn(c,px,py)
                c.setFillColor(col); c.roundRect(px+pw/2-30,4,60,15,7,fill=1,stroke=0)
                ctext(c,px+pw/2,9.5,lbl,"LSB",6.5,PR)

    story.append(SyncPhones())
    story.append(sp(8))
    story += bullets([
        "Leads registrados offline ficam em fila local — enviados automaticamente ao reconectar",
        "Ranking atualiza a cada 60 segundos entre dispositivos quando online",
        "Zero perda de dados — sistema descarta apenas registros de eventos já encerrados",
    ])
    story.append(PageBreak())

    # ─── SLIDE 11: BENEFÍCIOS ────────────────────────────────────────────
    story += page_header("11","Benefícios para o Negócio","Impacto direto nas áreas da empresa")

    class BenefitCards(Flowable):
        def wrap(self,aW,_): self.fw=aW; return aW, 280
        def draw(self):
            c=self.canv; fw=self.fw
            areas=[
                ("📢","Marketing",     AM, [
                    "Planejamento centralizado","Relatórios automáticos","Estoque sem planilhas",
                ]),
                ("💼","Comercial",     VE, [
                    "Leads padronizados","Classificação por temperatura","Exportação instantânea",
                ]),
                ("🏢","Diretoria",     AZ, [
                    "KPIs em tempo real","Histórico completo","Rastreabilidade total",
                ]),
                ("⚙","Operação",      LA, [
                    "Elimina processos manuais","Funciona sem internet","Check-in por CPF",
                ]),
            ]
            cw=(fw-18)/4; ch=260
            for i,(ic,tit,col,items) in enumerate(areas):
                cx=i*(cw+6)
                card(c,cx,0,cw,ch,bg=CE,r=8)
                # Header color
                c.setFillColor(col); c.roundRect(cx,ch-48,cw,48,8,fill=1,stroke=0)
                c.rect(cx,ch-48,cw,24,fill=1,stroke=0)
                ctext(c,cx+cw/2,ch-18,ic,"LS",18,BR)
                ctext(c,cx+cw/2,ch-38,tit,"LSB",9,BR)
                # Items
                y=ch-66
                for it in items:
                    c.setFillColor(col); c.roundRect(cx+8,y+1,5,5,1,fill=1,stroke=0)
                    # Word wrap
                    words=it.split(); line=""; lines_=[]
                    for w_ in words:
                        if len(line+" "+w_)*4.2>cw-22: lines_.append(line); line=w_
                        else: line=(line+" "+w_).strip()
                    if line: lines_.append(line)
                    for ln in lines_[:2]:
                        ctext(c,cx+16,y,ln,"LS",7,T2,"left"); y-=10
                    y-=4
                # Bottom divider
                c.setFillColor(col); c.roundRect(cx,0,cw,4,2,fill=1,stroke=0)

    story.append(BenefitCards())
    story.append(sp(10))
    story += bullets([
        "Um único sistema substitui planilhas, relatórios manuais e aplicativos descoordenados",
        "Dados rastreáveis do evento ao lead, do lead à conversão",
    ])
    story.append(PageBreak())

    # ─── SLIDE 12: RESUMO EXECUTIVO ──────────────────────────────────────
    story += page_header("12","Resumo Executivo","O que o RJNET — Gestão de Eventos entrega hoje")

    class ExecutiveSummary(Flowable):
        def wrap(self,aW,_): self.fw=aW; return aW, 350
        def draw(self):
            c=self.canv; fw=self.fw
            # Before/After comparison
            half=fw/2-8
            # ANTES
            card(c,0,180,half,160,bg=colors.HexColor("#1A0A0A"),r=8)
            c.setFillColor(VM); c.roundRect(0,320,half,20,8,fill=1,stroke=0)
            c.rect(0,320,half,10,fill=1,stroke=0)
            ctext(c,half/2,326,"ANTES","LSB",9,BR)
            befores=["Planilhas manuais dispersas","Sem controle de materiais",
                     "Relatórios pós-evento","Leads em papel/WhatsApp","Ranking apurado manualmente"]
            yy=300
            for b in befores:
                ctext(c,12,yy,f"✗  {b}","LS",7.5,colors.HexColor("#FF6B6B"),"left"); yy-=20
            # DEPOIS
            card(c,half+16,180,half,160,bg=colors.HexColor("#0A1A0A"),r=8)
            c.setFillColor(VE); c.roundRect(half+16,320,half,20,8,fill=1,stroke=0)
            c.rect(half+16,320,half,10,fill=1,stroke=0)
            ctext(c,half+16+half/2,326,"COM RJNET","LSB",9,BR)
            afters=["Plataforma única integrada","Estoque com alertas automáticos",
                    "Dashboard em tempo real","App mobile para vendedores","Ranking atualizado ao vivo"]
            yy=300
            for a in afters:
                ctext(c,half+26,yy,f"✓  {a}","LS",7.5,VE,"left"); yy-=20
            # Arrow between
            fill_poly(c,[(half-4,262),(half+20,270),(half-4,278)],AM)
            # Big metrics
            metrics=[("6","Módulos\nintegrados",AM),("2","Perfis de\nacesso",AZ),
                     ("15","Meta leads\npor vendedor",VE),("60s","Sync entre\ndispositivos",LA)]
            mw=(fw-18)/4; mh=70
            for i,(v,l,col) in enumerate(metrics):
                mx=i*(mw+6); my=100
                card(c,mx,my,mw,mh,bg=CE,r=8)
                c.setFillColor(col); c.roundRect(mx,my+mh-8,mw,8,4,fill=1,stroke=0)
                ctext(c,mx+mw/2,my+mh-28,v,"LSB",22,col)
                lines_=l.split("\n")
                for j,ln in enumerate(lines_):
                    ctext(c,mx+mw/2,my+24-j*12,ln,"LS",6.5,T2)
            # Final tagline
            card(c,0,0,fw,88,bg=CE,r=8)
            c.setFillColor(AM); c.roundRect(0,0,fw,88,8,fill=1,stroke=0)
            c.setFillColor(colors.HexColor("#F5C00015")); c.circle(fw-30,44,60,fill=1,stroke=0)
            ctext(c,fw/2,56,"RJNET — Gestão de Eventos","LSB",16,PR)
            ctext(c,fw/2,34,"Do planejamento à conversão — tudo em uma única plataforma","LS",9,colors.HexColor("#3A2A00"))
            ctext(c,fw/2,14,"Documento Confidencial  •  Uso exclusivo para diretoria e sócios","LS",7.5,colors.HexColor("#5A4A00"))

    story.append(ExecutiveSummary())

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
            bg2=col if is_act else colors.HexColor("#2A2A2A")
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
