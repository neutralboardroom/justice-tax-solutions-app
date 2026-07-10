#!/usr/bin/env python3
import json, os, re, hashlib, subprocess, tempfile, shutil
from pathlib import Path
from pypdf import PdfReader, PdfWriter
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/official-forms/irs-tax-debt-resolution'
inv=json.loads((BASE/'field-inventory.json').read_text())

def label(field):
    alt=(field.get('alternateName') or '').strip()
    if alt: return alt
    n=field.get('name','').split('.')[-1]
    n=re.sub(r'\[\d+\]','',n)
    n=re.sub(r'[_-]+',' ',n)
    n=re.sub(r'(?<=[a-z])(?=[A-Z])',' ',n)
    return n.strip() or field.get('name','')

def sample_value(f):
    t=f.get('fieldType')
    lab=label(f).lower()
    if t=='checkbox': return '/Yes'
    if t!='text': return None
    if 'date' in lab: return '01/15/2026'
    if any(x in lab for x in ['ssn','social security','tin','ein','taxpayer identification']): return 'XXX-XX-1234'
    if 'phone' in lab: return '(212) 555-0100'
    if 'email' in lab: return 'sample@example.test'
    if 'zip' in lab: return '10001'
    if 'state' in lab: return 'NY'
    if 'city' in lab: return 'New York'
    if 'address' in lab or 'street' in lab: return '123 Sample Street'
    if 'name' in lab: return 'Sample Taxpayer'
    if any(x in lab for x in ['amount','balance','payment','income','expense','value']): return '1000.00'
    if 'year' in lab or 'period' in lab: return '2025'
    return 'SAMPLE'

maps=[]; qa=[]
for form, docs in inv.get('forms',{}).items():
  for doc in docs:
    pdf=ROOT/doc['relativePath']
    fields=[]
    for i,f in enumerate(doc.get('fields',[])):
      fields.append({
        'fieldName':f.get('name'), 'fieldType':f.get('fieldType'), 'alternateName':f.get('alternateName'),
        'semanticKey':f"{form}.{doc.get('language','en')}.field_{i+1}", 'plainEnglishLabel':label(f),
        'mappingMethod':'automated_from_official_acroform_metadata',
        'humanVerificationRequired':True,
        'sampleValue':sample_value(f)
      })
    maps.append({'formNumber':form,'language':doc.get('language'),'filename':doc.get('filename'),'sha256':doc.get('sha256'),'fieldCount':len(fields),'coveragePercent':100 if fields else 0,'semanticMappings':fields,'humanVerified':False})
    sample_rel=''; sample_sha=''; fill_status='not_attempted'; fill_error=''
    if pdf.exists() and fields:
      try:
        r=PdfReader(str(pdf)); w=PdfWriter(); w.clone_document_from_reader(r)
        vals={f['fieldName']:f['sampleValue'] for f in fields if f['sampleValue'] is not None and f['fieldType'] in ('text','checkbox')}
        for p in w.pages:
          try: w.update_page_form_field_values(p, vals, auto_regenerate=False)
          except Exception: pass
        out=BASE/'generated-samples'/f"{form}-{doc.get('language','en')}-sample.pdf"
        with open(out,'wb') as fh:w.write(fh)
        sample_rel=str(out.relative_to(ROOT)); sample_sha=hashlib.sha256(out.read_bytes()).hexdigest(); fill_status='generated'
      except Exception as e:
        fill_status='failed'; fill_error=str(e)[:500]
    render_ok=False; rendered_pages=0; render_error=''
    target=(ROOT/sample_rel) if sample_rel else pdf
    if target.exists():
      td=tempfile.mkdtemp(prefix='jtsqa_')
      try:
        p=subprocess.run(['pdftoppm','-png','-r','72',str(target),os.path.join(td,'page')],capture_output=True,text=True,timeout=120)
        imgs=list(Path(td).glob('page-*.png')); rendered_pages=len(imgs); render_ok=p.returncode==0 and rendered_pages==doc.get('pageCount',rendered_pages)
        if p.returncode!=0: render_error=p.stderr[:500]
      except Exception as e: render_error=str(e)[:500]
      finally: shutil.rmtree(td,ignore_errors=True)
    qa.append({'formNumber':form,'language':doc.get('language'),'filename':doc.get('filename'),'sampleOutput':sample_rel,'sampleSha256':sample_sha,'sampleGenerationStatus':fill_status,'sampleGenerationError':fill_error,'expectedPages':doc.get('pageCount'),'renderedPages':rendered_pages,'pageRenderPassed':render_ok,'visualQaStatus':'automated_render_passed_human_page_review_required' if render_ok else 'render_failed','humanVisualQaApproved':False,'professionalApproved':False,'ownerApproved':False})
(BASE/'semantic-mapping.json').write_text(json.dumps({'version':'0.1.70','generatedAt':'2026-07-10','mappingType':'automated technical semantic mapping; human verification required','forms':maps},indent=2))
(BASE/'qa'/'sample-visual-qa.json').write_text(json.dumps({'version':'0.1.70','generatedAt':'2026-07-10','records':qa},indent=2))
print(json.dumps({'mappingDocuments':len(maps),'mappedFields':sum(x['fieldCount'] for x in maps),'samplesGenerated':sum(x['sampleGenerationStatus']=='generated' for x in qa),'pageRenderPassed':sum(x['pageRenderPassed'] for x in qa),'records':len(qa)},indent=2))
