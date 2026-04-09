#!/usr/bin/env python3
"""
Generate a beautiful institutional PDF ficha for PGR Angola - Arguido em Prisao Preventiva.
Usage: python generate_ficha.py <output_path> '<json_data>'
  json_data must contain the arguido fields as JSON string.
"""
import sys
import os
import json
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image, KeepTogether, PageBreak
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.graphics.shapes import Drawing, Rect, Line
from reportlab.graphics import renderPDF

# ===================== FONT REGISTRATION =====================
pdfmetrics.registerFont(TTFont('TimesNewRoman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('Calibri', '/usr/share/fonts/truetype/english/calibri-regular.ttf'))
pdfmetrics.registerFont(TTFont('CalibriBold', '/usr/share/fonts/truetype/english/calibri-bold.ttf'))
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('TimesNewRoman', normal='TimesNewRoman', bold='TimesNewRoman')
registerFontFamily('Calibri', normal='Calibri', bold='CalibriBold')
registerFontFamily('CalibriBold', normal='CalibriBold', bold='CalibriBold')
registerFontFamily('SimHei', normal='SimHei', bold='SimHei')

# ===================== COLOR PALETTE =====================
PGR_ORANGE = colors.HexColor('#D35400')
PGR_ORANGE_LIGHT = colors.HexColor('#E67E22')
PGR_ORANGE_DARK = colors.HexColor('#BA4A00')
PGR_GOLD = colors.HexColor('#FFD700')
PGR_GOLD_DARK = colors.HexColor('#D4AF37')
PGR_RED = colors.HexColor('#DC3545')
DARK_TEXT = colors.HexColor('#1a1a1a')
GRAY_TEXT = colors.HexColor('#555555')
LIGHT_GRAY = colors.HexColor('#F5F5F5')
MEDIUM_GRAY = colors.HexColor('#E0E0E0')
TABLE_HEADER_BG = colors.HexColor('#D35400')
TABLE_ROW_ODD = colors.HexColor('#FFF8F0')
TABLE_ROW_EVEN = colors.white
STATUS_ATIVO = colors.HexColor('#28A745')
STATUS_VENCIDO = colors.HexColor('#DC3545')
STATUS_ENCERRADO = colors.HexColor('#6C757D')

# ===================== STYLES =====================
def create_styles():
    s = {}

    # Cover / Header
    s['cover_title'] = ParagraphStyle(
        name='CoverTitle', fontName='CalibriBold', fontSize=26, leading=32,
        alignment=TA_CENTER, textColor=PGR_ORANGE_DARK, spaceAfter=4,
    )
    s['cover_subtitle'] = ParagraphStyle(
        name='CoverSubtitle', fontName='Calibri', fontSize=13, leading=18,
        alignment=TA_CENTER, textColor=GRAY_TEXT, spaceAfter=6,
    )
    s['cover_id'] = ParagraphStyle(
        name='CoverId', fontName='CalibriBold', fontSize=18, leading=24,
        alignment=TA_CENTER, textColor=DARK_TEXT, spaceAfter=4,
    )

    # Section headers
    s['section_header'] = ParagraphStyle(
        name='SectionHeader', fontName='CalibriBold', fontSize=13, leading=18,
        textColor=PGR_ORANGE_DARK, spaceBefore=14, spaceAfter=6,
        borderPadding=(0, 0, 2, 0),
    )
    s['subsection'] = ParagraphStyle(
        name='SubSection', fontName='CalibriBold', fontSize=11, leading=15,
        textColor=DARK_TEXT, spaceBefore=8, spaceAfter=4,
    )

    # Body
    s['body'] = ParagraphStyle(
        name='Body', fontName='Calibri', fontSize=10, leading=14,
        textColor=DARK_TEXT, alignment=TA_LEFT,
    )
    s['body_sm'] = ParagraphStyle(
        name='BodySm', fontName='Calibri', fontSize=9, leading=12,
        textColor=GRAY_TEXT, alignment=TA_LEFT,
    )
    s['body_bold'] = ParagraphStyle(
        name='BodyBold', fontName='CalibriBold', fontSize=10, leading=14,
        textColor=DARK_TEXT,
    )
    s['body_right'] = ParagraphStyle(
        name='BodyRight', fontName='Calibri', fontSize=10, leading=14,
        textColor=DARK_TEXT, alignment=TA_RIGHT,
    )

    # Table cell styles
    s['th'] = ParagraphStyle(
        name='TH', fontName='CalibriBold', fontSize=9.5, leading=13,
        textColor=colors.white, alignment=TA_LEFT,
    )
    s['th_center'] = ParagraphStyle(
        name='THCenter', fontName='CalibriBold', fontSize=9.5, leading=13,
        textColor=colors.white, alignment=TA_CENTER,
    )
    s['td'] = ParagraphStyle(
        name='TD', fontName='Calibri', fontSize=9.5, leading=13,
        textColor=DARK_TEXT, alignment=TA_LEFT,
    )
    s['td_center'] = ParagraphStyle(
        name='TDCenter', fontName='Calibri', fontSize=9.5, leading=13,
        textColor=DARK_TEXT, alignment=TA_CENTER,
    )
    s['td_bold'] = ParagraphStyle(
        name='TDBold', fontName='CalibriBold', fontSize=9.5, leading=13,
        textColor=colors.HexColor('#333333'), alignment=TA_LEFT,
    )

    # Status badge
    s['status_ativo'] = ParagraphStyle(
        name='StatusAtivo', fontName='CalibriBold', fontSize=9, leading=12,
        textColor=STATUS_ATIVO, alignment=TA_CENTER,
    )
    s['status_vencido'] = ParagraphStyle(
        name='StatusVencido', fontName='CalibriBold', fontSize=9, leading=12,
        textColor=STATUS_VENCIDO, alignment=TA_CENTER,
    )
    s['status_encerrado'] = ParagraphStyle(
        name='StatusEncerrado', fontName='CalibriBold', fontSize=9, leading=12,
        textColor=STATUS_ENCERRADO, alignment=TA_CENTER,
    )

    # Footer
    s['footer'] = ParagraphStyle(
        name='Footer', fontName='Calibri', fontSize=8, leading=10,
        textColor=GRAY_TEXT, alignment=TA_CENTER,
    )

    return s


# ===================== HELPERS =====================
def fmt_date(date_str):
    """Format ISO date to DD/MM/YYYY or return '---'."""
    if not date_str:
        return '---'
    try:
        d = datetime.strptime(date_str[:10], '%Y-%m-%d')
        return d.strftime('%d/%m/%Y')
    except (ValueError, TypeError):
        return '---'

def fmt_status(status):
    """Return display status string."""
    mapping = {
        'ativo': 'ATIVO',
        'vencido': 'VENCIDO',
        'encerrado': 'ENCERRADO',
    }
    return mapping.get(status, status.upper())

def get_status_style(status, styles):
    """Return appropriate status paragraph style."""
    if status == 'ativo':
        return styles['status_ativo']
    elif status == 'vencido':
        return styles['status_vencido']
    else:
        return styles['status_encerrado']

def get_days_remaining_str(date_str):
    """Calculate days remaining and return label."""
    if not date_str:
        return ('---', None)
    try:
        target = datetime.strptime(date_str[:10], '%Y-%m-%d')
        now = datetime.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        target_day = target.replace(hour=0, minute=0, second=0, microsecond=0)
        diff = (target_day - today).days
        if diff < 0:
            return (f'Vencido ha {abs(diff)} dia(s)', 'red')
        elif diff == 0:
            return ('Vence hoje!', 'red')
        elif diff <= 3:
            return (f'{diff} dia(s) restante(s)', 'orange')
        elif diff <= 7:
            return (f'{diff} dia(s) restante(s)', 'amber')
        else:
            return (f'{diff} dia(s) restante(s)', 'green')
    except (ValueError, TypeError):
        return ('---', None)


# ===================== HEADER BANNER =====================
def create_header_banner(data, styles):
    """Create the PGR institutional header."""
    elements = []

    # Orange top bar
    d = Drawing(470, 4)
    d.add(Rect(0, 0, 470, 4, fillColor=PGR_ORANGE, strokeColor=None))
    elements.append(d)
    elements.append(Spacer(1, 12))

    # Title block
    elements.append(Paragraph('<b>REPUBLICA DE ANGOLA</b>', ParagraphStyle(
        name='RepTitle', fontName='CalibriBold', fontSize=14, leading=18,
        alignment=TA_CENTER, textColor=DARK_TEXT, spaceAfter=2,
    )))
    elements.append(Paragraph('PROCURADORIA-GERAL DA REPUBLICA', ParagraphStyle(
        name='PGRTitle', fontName='CalibriBold', fontSize=12, leading=16,
        alignment=TA_CENTER, textColor=PGR_ORANGE_DARK, spaceAfter=2,
    )))
    elements.append(Paragraph('Sistema de Controlo dos Arguidos em Prisao Preventiva', ParagraphStyle(
        name='SysTitle', fontName='Calibri', fontSize=9, leading=12,
        alignment=TA_CENTER, textColor=GRAY_TEXT, spaceAfter=8,
    )))

    # Gold divider
    d2 = Drawing(470, 2)
    d2.add(Rect(100, 0, 270, 2, fillColor=PGR_GOLD_DARK, strokeColor=None))
    elements.append(d2)
    elements.append(Spacer(1, 10))

    # Document title
    elements.append(Paragraph('<b>FICHA INDIVIDUAL DO ARGUIDO</b>', styles['cover_title']))
    elements.append(Paragraph('Mapa de Controlo - Prisao Preventiva', styles['cover_subtitle']))
    elements.append(Spacer(1, 6))

    # ID badge
    id_text = data.get('numero_id', data.get('numeroId', '---'))
    elements.append(Paragraph(
        f'<b>Registo N.: {id_text}</b>',
        styles['cover_id']
    ))

    # Status badge area
    status = data.get('status', 'ativo')
    status_label = fmt_status(status)
    st_style = get_status_style(status, styles)

    elements.append(Spacer(1, 4))
    status_table = Table(
        [[Paragraph(f'<b>{status_label}</b>', st_style)]],
        colWidths=[160],
        rowHeights=[22],
    )
    status_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    # Center the status table
    outer = Table([[status_table]], colWidths=[470])
    outer.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    elements.append(outer)

    # Bottom orange bar
    elements.append(Spacer(1, 10))
    d3 = Drawing(470, 2)
    d3.add(Rect(0, 0, 470, 2, fillColor=PGR_ORANGE, strokeColor=None))
    elements.append(d3)
    elements.append(Spacer(1, 14))

    return elements


# ===================== INFO SECTIONS =====================
def create_info_table(data, styles):
    """Create the main information table with all fields."""
    rows = []

    # === DADOS PESSOAIS E PROCESSUAIS ===
    rows.append([
        Paragraph('<b>DADOS PESSOAIS E PROCESSUAIS</b>', ParagraphStyle(
            name='SectionTH', fontName='CalibriBold', fontSize=10, leading=14,
            textColor=colors.white, alignment=TA_LEFT,
        )),
        '',
        '',
        '',
    ])

    fields_personal = [
        ('Nome do Arguido', data.get('nome_arguido', data.get('nomeArguido', '---')), ''),
        ('N. do Processo', data.get('numero_processo', data.get('numeroProcesso', '---')), 'Crime', data.get('crime', '---')),
        ('Data de Detencao', fmt_date(data.get('data_detencao', data.get('dataDetencao'))), 'Magistrado', data.get('magistrado', '---')),
    ]

    for f in fields_personal:
        if len(f) == 3:
            rows.append([
                Paragraph(f[0], styles['td_bold']),
                Paragraph(f[1], styles['td']),
                '', '',
            ])
        else:
            rows.append([
                Paragraph(f[0], styles['td_bold']),
                Paragraph(f[1], styles['td']),
                Paragraph(f[2], styles['td_bold']),
                Paragraph(f[3], styles['td']),
            ])

    # === DATAS E PRAZOS PROCESSUAIS ===
    rows.append([
        Paragraph('<b>DATAS E PRAZOS PROCESSUAIS</b>', ParagraphStyle(
            name='SectionTH2', fontName='CalibriBold', fontSize=10, leading=14,
            textColor=colors.white, alignment=TA_LEFT,
        )),
        '',
        '',
        '',
    ])

    medidas = data.get('medidas_aplicadas', data.get('medidasAplicadas', '---'))
    data_med = data.get('data_medidas_aplicadas', data.get('dataMedidasAplicadas'))
    fim_p1 = data.get('fim_primeiro_prazo', data.get('fimPrimeiroPrazo'))
    dias_p1, cor_p1 = get_days_remaining_str(fim_p1)

    data_remes_jg = data.get('data_remessa_jg', data.get('dataRemessaJg'))
    data_regresso = data.get('data_regresso', data.get('dataRegresso'))
    data_remes_sic = data.get('data_remessa_sic', data.get('dataRemessaSic'))

    fields_prazos = [
        ('Medidas Aplicadas', medidas),
        ('Data das Medidas', fmt_date(data_med)),
        ('Fim 1. Prazo', f'{fmt_date(fim_p1)}  ({dias_p1})' if fim_p1 else '---'),
        ('Data Remessa ao JG', fmt_date(data_remes_jg)),
        ('Data de Regresso', fmt_date(data_regresso)),
        ('Data Remessa ao SIC', fmt_date(data_remes_sic)),
    ]

    for f in fields_prazos:
        rows.append([
            Paragraph(f[0], styles['td_bold']),
            Paragraph(f[1], styles['td']),
            '', '',
        ])

    # === PRORROGACAO (2. PRAZO) ===
    rows.append([
        Paragraph('<b>PRORROGACAO (2. PRAZO)</b>', ParagraphStyle(
            name='SectionTH3', fontName='CalibriBold', fontSize=10, leading=14,
            textColor=colors.white, alignment=TA_LEFT,
        )),
        '',
        '',
        '',
    ])

    data_prorr = data.get('data_prorrogacao', data.get('dataProrrogacao'))
    dur_prorr = data.get('duracao_prorrogacao', data.get('duracaoProrrogacao', 0))
    fim_p2 = data.get('fim_segundo_prazo', data.get('fimSegundoPrazo'))
    dias_p2, cor_p2 = get_days_remaining_str(fim_p2)

    fields_prorr = [
        ('Data de Prorrogacao', fmt_date(data_prorr)),
        ('Duracao da Prorrogacao', f'{dur_prorr} mes(es)' if dur_prorr else '---'),
        ('Fim 2. Prazo', f'{fmt_date(fim_p2)}  ({dias_p2})' if fim_p2 else '---'),
        ('Remessa JG (Alteracao)', data.get('remessa_jg_alteracao', data.get('remessaJgAlteracao', '---'))),
    ]

    for f in fields_prorr:
        rows.append([
            Paragraph(f[0], styles['td_bold']),
            Paragraph(f[1], styles['td']),
            '', '',
        ])

    # === OBSERVACOES ===
    obs1 = data.get('obs1', '')
    obs2 = data.get('obs2', '')
    if obs1 or obs2:
        rows.append([
            Paragraph('<b>OBSERVACOES</b>', ParagraphStyle(
                name='SectionTH4', fontName='CalibriBold', fontSize=10, leading=14,
                textColor=colors.white, alignment=TA_LEFT,
            )),
            '',
            '',
            '',
        ])
        if obs1:
            rows.append([
                Paragraph('Observacao 1', styles['td_bold']),
                Paragraph(str(obs1), styles['td']),
                '', '',
            ])
        if obs2:
            rows.append([
                Paragraph('Observacao 2', styles['td_bold']),
                Paragraph(str(obs2), styles['td']),
                '', '',
            ])

    # Build table
    col_widths = [130, 190, 80, 80]
    table = Table(rows, colWidths=col_widths)

    style_cmds = [
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]

    # Style section header rows (span across all columns)
    row_idx = 0
    for i, row in enumerate(rows):
        if row[0].text and ('DADOS PESSOAIS' in row[0].text or 'DATAS E PRAZOS' in row[0].text or 'PRORROGACAO' in row[0].text or 'OBSERVACOES' in row[0].text):
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_HEADER_BG))
            style_cmds.append(('SPAN', (0, i), (-1, i)))
        else:
            bg = TABLE_ROW_ODD if (row_idx % 2 == 0) else TABLE_ROW_EVEN
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
            row_idx += 1

    table.setStyle(TableStyle(style_cmds))
    return table


# ===================== DEADLINE SUMMARY BOX =====================
def create_deadline_box(data, styles):
    """Create a visual deadline summary box."""
    elements = []
    elements.append(Spacer(1, 10))

    elements.append(Paragraph('<b>RESUMO DE PRAZOS</b>', styles['section_header']))

    fim_p1 = data.get('fim_primeiro_prazo', data.get('fimPrimeiroPrazo'))
    fim_p2 = data.get('fim_segundo_prazo', data.get('fimSegundoPrazo'))
    dias_p1, cor_p1 = get_days_remaining_str(fim_p1)
    dias_p2, cor_p2 = get_days_remaining_str(fim_p2)

    color_map = {
        'red': colors.HexColor('#FDE8E8'),
        'orange': colors.HexColor('#FFF3E0'),
        'amber': colors.HexColor('#FFF8E1'),
        'green': colors.HexColor('#E8F5E9'),
    }
    accent_map = {
        'red': colors.HexColor('#DC3545'),
        'orange': PGR_ORANGE,
        'amber': colors.HexColor('#FFC107'),
        'green': STATUS_ATIVO,
    }
    days_color_map = {
        'red': colors.HexColor('#DC3545'),
        'orange': PGR_ORANGE_DARK,
        'amber': colors.HexColor('#FFC107'),
        'green': STATUS_ATIVO,
    }

    def make_deadline_card(label, date_str, days_str, color_name):
        bg = color_map.get(color_name, LIGHT_GRAY) if color_name else LIGHT_GRAY
        accent = accent_map.get(color_name, MEDIUM_GRAY) if color_name else MEDIUM_GRAY
        days_color = days_color_map.get(color_name, GRAY_TEXT) if color_name else GRAY_TEXT

        label_style = ParagraphStyle(
            name=f'Label_{color_name or "none"}',
            fontName='Calibri', fontSize=9, leading=12, textColor=GRAY_TEXT,
        )
        date_style = ParagraphStyle(
            name=f'Date_{color_name or "none"}',
            fontName='CalibriBold', fontSize=11, leading=15, textColor=DARK_TEXT,
        )
        days_style = ParagraphStyle(
            name=f'Days_{color_name or "none"}',
            fontName='Calibri', fontSize=8, leading=11, textColor=days_color,
        )

        # Build as table with accent bar
        accent_cell = Table(
            [[Paragraph('', days_style)]],
            colWidths=[5],
            rowHeights=[50],
        )
        accent_cell.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), accent),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))

        content_cell = Table(
            [
                [Paragraph(label, label_style)],
                [Paragraph(date_str, date_style)],
                [Paragraph(days_str, days_style)],
            ],
            colWidths=[200],
        )
        content_cell.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), bg),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (0, 0), 6),
            ('BOTTOMPADDING', (-1, -1), (-1, -1), 6),
            ('TOPPADDING', (0, 1), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -2), 0),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        card = Table([[accent_cell, content_cell]], colWidths=[5, 205])
        card.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        return card

    p1_label = '1. Prazo (Medidas Aplicadas)'
    p2_label = '2. Prazo (Prorrogacao)'

    card1 = make_deadline_card(p1_label, fmt_date(fim_p1), dias_p1, cor_p1)
    card2 = make_deadline_card(p2_label, fmt_date(fim_p2), dias_p2, cor_p2)

    cards_table = Table([[card1, card2]], colWidths=[220, 220])
    cards_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(cards_table)

    return elements


# ===================== FOOTER =====================
def create_footer(styles):
    """Create the institutional footer."""
    elements = []
    elements.append(Spacer(1, 20))

    d = Drawing(470, 1)
    d.add(Rect(0, 0, 470, 1, fillColor=MEDIUM_GRAY, strokeColor=None))
    elements.append(d)
    elements.append(Spacer(1, 6))

    elements.append(Paragraph(
        'Procuradoria-Geral da Republica de Angola',
        styles['footer']
    ))
    elements.append(Paragraph(
        f'Documento gerado em {datetime.now().strftime("%d/%m/%Y as %H:%M")}  |  Sistema de Controlo de Arguidos',
        styles['footer']
    ))
    elements.append(Paragraph(
        'Este documento e de uso interno e exclusivo da PGR.',
        ParagraphStyle(
            name='FooterDisclaimer', fontName='Calibri', fontSize=7, leading=9,
            textColor=colors.HexColor('#999999'), alignment=TA_CENTER,
        )
    ))

    return elements


# ===================== MAIN =====================
def generate_ficha(output_path, json_data_str):
    """Generate the PDF ficha."""
    data = json.loads(json_data_str)
    styles = create_styles()

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2.0 * cm,
        rightMargin=2.0 * cm,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm,
        title=f'Ficha_Arguido_{data.get("numero_id", data.get("numeroId", "0"))}',
        author='Z.ai',
        creator='Z.ai',
        subject='PGR Angola - Ficha Individual do Arguido em Prisao Preventiva',
    )

    story = []

    # Header banner
    story.extend(create_header_banner(data, styles))

    # Main info table
    story.append(create_info_table(data, styles))

    # Deadline summary
    story.extend(create_deadline_box(data, styles))

    # Footer
    story.extend(create_footer(styles))

    doc.build(story)
    print(f"PDF generated: {output_path}")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python generate_ficha.py <output_path> '<json_data>'")
        sys.exit(1)
    output = sys.argv[1]
    json_str = sys.argv[2]
    generate_ficha(output, json_str)
