import zipfile
import os
import xml.sax.saxutils as saxutils

def escape_xml(text):
    return saxutils.escape(str(text))

def build_docx(filename, sections):
    # XML Components
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""

    root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

    styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="222222"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto" w:after="160"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>"""

    doc_body = []

    for sec in sections:
        sec_type = sec.get("type", "paragraph")
        
        if sec_type == "title":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="360" w:after="120"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:b/>
      <w:sz w:val="48"/>
      <w:color w:val="1E3A8A"/>
    </w:rPr>
    <w:t>{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "subtitle":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="60" w:after="280"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:sz w:val="26"/>
      <w:color w:val="555555"/>
      <w:i/>
    </w:rPr>
    <w:t>{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "heading1":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:spacing w:before="360" w:after="140"/>
    <w:pBdr>
      <w:bottom w:val="single" w:sz="12" w:space="4" w:color="1E3A8A"/>
    </w:pBdr>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:b/>
      <w:sz w:val="34"/>
      <w:color w:val="1E3A8A"/>
    </w:rPr>
    <w:t>{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "heading2":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:spacing w:before="240" w:after="100"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:color w:val="0D9488"/>
    </w:rPr>
    <w:t>{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "heading3":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:spacing w:before="180" w:after="60"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:color w:val="333333"/>
    </w:rPr>
    <w:t>{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "paragraph":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
  </w:pPr>
  <w:r>
    <w:t>{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "bold_paragraph":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:spacing w:after="100"/>
  </w:pPr>
  <w:r>
    <w:rPr><w:b/></w:rPr>
    <w:t>{escape_xml(sec['bold'])}: </w:t>
  </w:r>
  <w:r>
    <w:t>{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "bullet":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:ind w:left="360" w:hanging="240"/>
    <w:spacing w:after="80"/>
  </w:pPr>
  <w:r>
    <w:rPr><w:b/><w:color w:val="1E3A8A"/></w:rPr>
    <w:t>•  </w:t>
  </w:r>
  <w:r>
    <w:rPr><w:b/></w:rPr>
    <w:t>{escape_xml(sec.get('bold', ''))}</w:t>
  </w:r>
  <w:r>
    <w:t>{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "callout":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:pBdr>
      <w:left w:val="single" w:sz="24" w:space="12" w:color="0284C7"/>
    </w:pBdr>
    <w:shd w:val="clear" w:color="auto" w:fill="F0F9FF"/>
    <w:spacing w:before="120" w:after="140"/>
    <w:ind w:left="240" w:right="240"/>
  </w:pPr>
  <w:r>
    <w:rPr><w:b/><w:color w:val="0369A1"/></w:rPr>
    <w:t>{escape_xml(sec.get('title', 'NOTE'))}: </w:t>
  </w:r>
  <w:r>
    <w:rPr><w:color w:val="0C4A6E"/></w:rPr>
    <w:t>{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "code":
            doc_body.append(f"""
<w:p>
  <w:pPr>
    <w:shd w:val="clear" w:color="auto" w:fill="F4F4F5"/>
    <w:spacing w:before="80" w:after="100"/>
    <w:ind w:left="240" w:right="240"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>
      <w:sz w:val="19"/>
      <w:color w:val="18181B"/>
    </w:rPr>
    <w:t xml:space="preserve">{escape_xml(sec['text'])}</w:t>
  </w:r>
</w:p>""")

        elif sec_type == "table":
            headers = sec.get("headers", [])
            rows = sec.get("rows", [])
            tbl_xml = ['<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="D1D5DB"/><w:left w:val="none"/><w:bottom w:val="single" w:sz="8" w:color="9CA3AF"/><w:right w:val="none"/><w:insideH w:val="single" w:sz="4" w:color="E5E7EB"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>']
            
            # Header Row
            tbl_xml.append('<w:tr><w:trPr><w:tblHeader/></w:trPr>')
            for h in headers:
                tbl_xml.append(f"""<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1E3A8A"/><w:tcMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="140"/><w:right w:w="140"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="21"/></w:rPr><w:t>{escape_xml(h)}</w:t></w:r></w:p></w:tc>""")
            tbl_xml.append('</w:tr>')
            
            # Data Rows
            for r_idx, r in enumerate(rows):
                bg = "F9FAFB" if r_idx % 2 == 1 else "FFFFFF"
                tbl_xml.append('<w:tr>')
                for cell in r:
                    tbl_xml.append(f"""<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="{bg}"/><w:tcMar><w:top w:w="100"/><w:bottom w:w="100"/><w:left w:w="140"/><w:right w:w="140"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>{escape_xml(cell)}</w:t></w:r></w:p></w:tc>""")
                tbl_xml.append('</w:tr>')
            tbl_xml.append('</w:tbl>')
            doc_body.append("".join(tbl_xml))

    doc_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {"".join(doc_body)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""

    # Package as .docx
    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
    with zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED) as docx:
        docx.writestr('[Content_Types].xml', content_types)
        docx.writestr('_rels/.rels', root_rels)
        docx.writestr('word/_rels/document.xml.rels', doc_rels)
        docx.writestr('word/styles.xml', styles_xml)
        docx.writestr('word/document.xml', doc_xml)

    print(f"Successfully generated Word document: {filename} ({os.path.getsize(filename):,} bytes)")

if __name__ == "__main__":
    print("Testing builder...")
