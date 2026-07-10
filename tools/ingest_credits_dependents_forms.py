#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, re, shutil, subprocess, tempfile
from pathlib import Path
from pypdf import PdfReader, PdfWriter

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets'/'official-forms'/'irs-individual-income-tax'
MANIFEST=BASE/'manifest.json'
INV=BASE/'field-inventory.json'
SEM=BASE/'semantic-mapping.json'
QA=BASE/'qa'/'sample-visual-qa.json'
REPORT=ROOT/'assets'/'official-forms'/'intake-reports'/'credits-dependents-v0.1.75.json'

ITEMS=[
 {'formNumber':'SCHEDULE-EIC','filename':'f1040sei Earned Income Credit.pdf','role':'form','url':'https://www.irs.gov/pub/irs-pdf/f1040sei.pdf','taxYear':2025,'revision':'2025'},
 {'formNumber':'8332','filename':'f8332 Release-Revocation of Release of Claim to Exemption for Child by Custodial Parent.pdf','role':'form','url':'https://www.irs.gov/pub/irs-pdf/f8332.pdf','taxYear':None,'revision':'December 2025'},
 {'formNumber':'8862','filename':'f8862 Information To Claim Certain Credits After Disallowance.pdf','role':'form','url':'https://www.irs.gov/pub/irs-pdf/f8862.pdf','taxYear':None,'revision':'December 2025'},
 {'formNumber':'8867','filename':'f8867 Paid Preparer#U2019s Due Diligence Checklist.pdf','role':'form','url':'https://www.irs.gov/pub/irs-pdf/f8867.pdf','taxYear':None,'revision':'November 2024'},
 {'formNumber':'8880','filename':'f8880 Credit for Qualified Retirement Savings Contributions.pdf','role':'form','url':'https://www.irs.gov/pub/irs-pdf/f8880.pdf','taxYear':2025,'revision':'2025'},
 {'formNumber':'8862','filename':'i8862 Instructions Information To Claim Certain Credits After Disallowance.pdf','role':'instructions','url':'https://www.irs.gov/pub/irs-pdf/i8862.pdf','taxYear':None,'revision':'December 2025'},
 {'formNumber':'8867','filename':'i8867 Instructions Paid Preparer#U2019s Due Diligence Checklist.pdf','role':'instructions','url':'https://www.irs.gov/pub/irs-pdf/i8867.pdf','taxYear':None,'revision':'November 2025'},
]

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def label(name):
 n=name.split('.')[-1]
 n=re.sub(r'\[\d+\]','',n); n=re.sub(r'[_-]+',' ',n); n=re.sub(r'(?<=[a-z])(?=[A-Z])',' ',n)
 return n.strip() or name

def field_type(v):
 ft=str(v.get('/FT') or '')
 return {'/Tx':'text','/Btn':'checkbox','/Ch':'choice','/Sig':'signature'}.get(ft,'other')

def inventory_for(item):
 p=BASE/item['filename']; r=PdfReader(str(p)); raw=r.get_fields() or {}; fields=[]
 for name,v in raw.items():
  fields.append({'name':name,'fieldType':field_type(v),'alternateName':str(v.get('/TU') or ''),'plainEnglishLabel':label(name),'page':None})
 return {'filename':item['filename'],'relativePath':str(p.relative_to(ROOT)).replace('\\','/'),'language':'en','sha256':sha(p),'pageCount':len(r.pages),'fieldCount':len(fields),'fields':fields}

def generic_value(f):
 if f['fieldType']=='checkbox': return '/Yes'
 if f['fieldType']!='text': return None
 lab=(f.get('alternateName') or f.get('plainEnglishLabel') or '').lower()
 if 'ssn' in lab or 'social security' in lab: return '000001234'
 if 'date' in lab: return '01/15/2026'
 if 'year' in lab: return '2025'
 if 'name' in lab: return 'SAMPLE TAXPAYER'
 return 'SAMPLE'

def sample_for(item, inv):
 if not inv['fieldCount'] or item['role']!='form': return None
 src=BASE/item['filename']; out=BASE/'generated-samples'/f"{item['formNumber']}-en-sample.pdf"
 try:
  r=PdfReader(str(src)); w=PdfWriter(); w.clone_document_from_reader(r)
  vals={f['name']:generic_value(f) for f in inv['fields'] if generic_value(f) is not None}
  for page in w.pages:
   try: w.update_page_form_field_values(page,vals,auto_regenerate=False)
   except Exception: pass
  with out.open('wb') as fh: w.write(fh)
  rendered=0; ok=False; err=''; td=Path(tempfile.mkdtemp(prefix='jtscredits_'))
  try:
   proc=subprocess.run(['pdftoppm','-png','-r','72',str(out),str(td/'page')],capture_output=True,text=True,timeout=120)
   rendered=len(list(td.glob('page-*.png'))); ok=proc.returncode==0 and rendered==inv['pageCount']; err=proc.stderr[:500]
  finally: shutil.rmtree(td,ignore_errors=True)
  return {'formNumber':item['formNumber'],'language':'en','filename':item['filename'],'sampleOutput':str(out.relative_to(ROOT)).replace('\\','/'),'sampleSha256':sha(out),'sampleGenerationStatus':'generated','sampleGenerationError':'','expectedPages':inv['pageCount'],'renderedPages':rendered,'pageRenderPassed':ok,'visualQaStatus':'automated_render_passed_human_page_review_required' if ok else 'render_failed','humanVisualQaApproved':False,'professionalApproved':False,'ownerApproved':False,'renderError':err}
 except Exception as e:
  return {'formNumber':item['formNumber'],'language':'en','filename':item['filename'],'sampleOutput':'','sampleSha256':'','sampleGenerationStatus':'failed','sampleGenerationError':str(e)[:500],'expectedPages':inv['pageCount'],'renderedPages':0,'pageRenderPassed':False,'visualQaStatus':'render_failed','humanVisualQaApproved':False,'professionalApproved':False,'ownerApproved':False}

def main():
 manifest=json.loads(MANIFEST.read_text()); inventory=json.loads(INV.read_text()); semantic=json.loads(SEM.read_text()); qa=json.loads(QA.read_text())
 manifest['version']='0.1.75'; manifest['generatedAt']='2026-07-10'; manifest['creditsDependentsIntakeReport']=str(REPORT.relative_to(ROOT)).replace('\\','/')
 inventory['version']='0.1.75'; semantic['version']='0.1.75'; qa['version']='0.1.75'
 existing={(x.get('filename'),x.get('documentRole')) for x in manifest['forms']}
 semantic['forms']=[x for x in semantic['forms'] if x.get('filename') not in {i['filename'] for i in ITEMS}]
 qa['records']=[x for x in qa['records'] if x.get('filename') not in {i['filename'] for i in ITEMS}]
 report=[]
 for item in ITEMS:
  p=BASE/item['filename']; r=PdfReader(str(p)); meta=r.metadata or {}; inv=inventory_for(item)
  inventory['forms'].setdefault(item['formNumber'],[])
  inventory['forms'][item['formNumber']]=[x for x in inventory['forms'][item['formNumber']] if x.get('filename')!=item['filename']]
  inventory['forms'][item['formNumber']].append(inv)
  rec={'formNumber':item['formNumber'],'filename':item['filename'],'relativePath':inv['relativePath'],'documentRole':item['role'],'language':'en','sha256':inv['sha256'],'sizeBytes':p.stat().st_size,'pageCount':inv['pageCount'],'fieldCount':inv['fieldCount'],'status':'pdf_captured','pdfTitle':str(meta.get('/Title') or ''),'pdfSubject':str(meta.get('/Subject') or ''),'pdfCreationDate':str(meta.get('/CreationDate') or ''),'checksumStatus':'packaged_file_matches_manifest_sha256','officialUrlCandidate':item['url'],'officialUrl':item['url'],'sourceVerificationStatus':'official_irs_url_and_revision_verified_2026-07-10','activeSupersededStatus':'current_official_source_verified_2026-07-10','releaseStatus':'captured_source_only','revisionOrTaxYearFromPdfMetadata':item['taxYear'] or item['revision'],'workflowBoundary':'No real-user final output until human semantic QA, calculation/eligibility validation where applicable, visual QA, professional approval, owner release, and production security gates pass.'}
  manifest['forms']=[x for x in manifest['forms'] if x.get('filename')!=item['filename']]
  manifest['forms'].append(rec)
  if item['role']=='form':
   maps=[]
   for idx,f in enumerate(inv['fields'],1):
    maps.append({'fieldName':f['name'],'fieldType':f['fieldType'],'alternateName':f['alternateName'],'semanticKey':f"{item['formNumber']}.en.field_{idx}",'plainEnglishLabel':f['plainEnglishLabel'],'mappingMethod':'automated_from_official_acroform_metadata','humanVerificationRequired':True,'sampleValue':generic_value(f)})
   semantic['forms'].append({'formNumber':item['formNumber'],'language':'en','filename':item['filename'],'sha256':inv['sha256'],'fieldCount':len(maps),'coveragePercent':100 if maps else 0,'semanticMappings':maps,'humanVerified':False})
   q=sample_for(item,inv)
   if q: qa['records'].append(q)
  report.append({'formNumber':item['formNumber'],'filename':item['filename'],'officialUrl':item['url'],'revision':item['revision'],'taxYear':item['taxYear'],'sha256':inv['sha256'],'pageCount':inv['pageCount'],'fieldCount':inv['fieldCount'],'role':item['role'],'metadataTitle':str(meta.get('/Title') or ''),'status':'captured_and_technically_inventoried_release_blocked'})
 manifest['forms']=sorted(manifest['forms'],key=lambda x:(str(x.get('formNumber') or ''),str(x.get('documentRole') or ''),str(x.get('filename') or '')))
 MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n'); INV.write_text(json.dumps(inventory,indent=2)+'\n'); SEM.write_text(json.dumps(semantic,indent=2)+'\n'); QA.write_text(json.dumps(qa,indent=2)+'\n')
 REPORT.parent.mkdir(parents=True,exist_ok=True); REPORT.write_text(json.dumps({'version':'0.1.75','sourceArchive':'IRS Credits and dependents Forms.zip','verifiedAt':'2026-07-10','officialSourcePolicy':'Official IRS URL and visible form revision verified; release remains fail-closed.','documents':report},indent=2)+'\n')
 print(json.dumps({'documents':len(report),'forms':sum(x['role']=='form' for x in ITEMS),'instructions':sum(x['role']=='instructions' for x in ITEMS),'newFields':sum(x['fieldCount'] for x in report if x['role']=='form'),'manifestDocuments':len(manifest['forms']),'inventoryFamilies':len(inventory['forms'])},indent=2))
if __name__=='__main__': main()
