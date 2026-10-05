import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically stamp running footer with page count
    without pushing extra pages into the story.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 7)
        self.setFillColor(colors.HexColor('#64748B'))
        
        # Divider line
        self.setStrokeColor(colors.HexColor('#CBD5E1'))
        self.setLineWidth(0.5)
        self.line(28, 22, 584, 22)
        
        # Left text
        left_txt = "Recipe Master (RM 2019) • Institutional Kitchen Backbone • Scale: Target ÷ Base Yield"
        self.drawString(28, 12, left_txt)
        
        # Right page number
        page_txt = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(584, 12, page_txt)
        self.restoreState()


def generate_recipe_pdf(recipe, target_yield=None):
    """
    Generate a compact, professional kitchen-ready recipe PDF with ReportLab.
    Prevents trailing empty space or overflow pages.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=28,
        leftMargin=28,
        topMargin=26,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'RecipeTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=21,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=2
    )
    
    subtitle_style = ParagraphStyle(
        'RecipeSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569'),
        spaceAfter=8
    )

    badge_style = ParagraphStyle(
        'BadgeStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0F766E'),
        alignment=1
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=8,
        spaceAfter=4
    )

    cell_style = ParagraphStyle(
        'CellRegular',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1E293B')
    )

    cell_bold = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0F172A')
    )

    cell_check = ParagraphStyle(
        'CellCheck',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#64748B'),
        alignment=1
    )

    story = []

    # Title & Category
    title = recipe.get('title', 'Recipe')
    category = recipe.get('category', 'General')
    cuisine = recipe.get('cuisine', '')
    sub_text = f"Category: <b>{category}</b>"
    if cuisine:
        sub_text += f" | Style/Cuisine: <b>{cuisine}</b>"
    
    story.append(Paragraph(title, title_style))
    story.append(Paragraph(sub_text, subtitle_style))

    # Metrics Card (Yield, Scale, Ingredients Count)
    base_yield = float(recipe.get('base_yield', 100.0))
    yield_unit = recipe.get('yield_unit', 'Kg')
    current_yield = float(target_yield) if target_yield is not None else base_yield
    scale_factor = current_yield / base_yield if base_yield > 0 else 1.0

    ingredients = recipe.get('ingredients', [])
    ing_count = len(ingredients)

    metric_data = [
        [
            Paragraph(f"<b>TARGET YIELD</b><br/><font size=11>{current_yield:g} {yield_unit}</font><br/><font size=7 color='#64748B'>Base: {base_yield:g} {yield_unit}</font>", badge_style),
            Paragraph(f"<b>SCALE MULTIPLIER</b><br/><font size=11>{scale_factor:.2f}x</font><br/><font size=7 color='#64748B'>Formula Applied</font>", badge_style),
            Paragraph(f"<b>INGREDIENTS COUNT</b><br/><font size=11>{ing_count} Items</font><br/><font size=7 color='#64748B'>Total Required</font>", badge_style)
        ]
    ]

    metric_table = Table(metric_data, colWidths=[185, 185, 185])
    metric_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F0FDFA')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#99F6E4')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCFBF1')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(metric_table)
    story.append(Spacer(1, 8))

    # Ingredients Table
    story.append(Paragraph(f"Ingredients Breakdown ({ing_count} Items)", section_heading))

    table_data = [
        [
            Paragraph("<b>Prep</b>", cell_bold),
            Paragraph("<b>Stage</b>", cell_bold),
            Paragraph("<b>Ingredient Name</b>", cell_bold),
            Paragraph("<b>Scaled Qty</b>", cell_bold),
            Paragraph("<b>Unit</b>", cell_bold),
            Paragraph("<b>Instructions / Notes</b>", cell_bold)
        ]
    ]

    for ing in ingredients:
        raw_qty = ing.get('quantity', 0.0)
        scaled_qty = raw_qty * scale_factor if raw_qty is not None else 0.0
        
        if scaled_qty >= 100:
            qty_str = f"{scaled_qty:,.1f}"
        elif scaled_qty >= 1:
            qty_str = f"{scaled_qty:.2f}".rstrip('0').rstrip('.')
        elif scaled_qty > 0:
            qty_str = f"{scaled_qty:.3f}".rstrip('0').rstrip('.')
        else:
            qty_str = "-"

        table_data.append([
            Paragraph("[  ]", cell_check),
            Paragraph(ing.get('stage', 'Main'), cell_style),
            Paragraph(f"<b>{ing.get('name', '')}</b>", cell_style),
            Paragraph(qty_str, cell_bold),
            Paragraph(ing.get('unit', ''), cell_style),
            Paragraph(ing.get('notes', ''), cell_style)
        ])

    ing_table = Table(table_data, colWidths=[30, 65, 175, 65, 45, 175], repeatRows=1)
    ing_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(ing_table)

    # Cooking Instructions / Method
    instructions = recipe.get('instructions', [])
    if instructions:
        story.append(Spacer(1, 8))
        story.append(Paragraph("Method & Cooking Instructions", section_heading))
        for idx, step in enumerate(instructions):
            step_clean = step.strip()
            if step_clean:
                p_text = f"<b>{idx+1}.</b> {step_clean}"
                story.append(Paragraph(p_text, cell_style))
                story.append(Spacer(1, 2))

    # Build document with dynamic footer stamped via NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()
