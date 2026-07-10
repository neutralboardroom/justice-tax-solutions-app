const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = '0.1.70';
const BASE = path.join(__dirname, '..', 'assets', 'official-forms', 'irs-tax-debt-resolution');
const MAP_PATH = path.join(BASE, 'semantic-mapping.json');
const QA_PATH = path.join(BASE, 'qa', 'sample-visual-qa.json');

const EXTERNAL_CONTROLS = [
  { key:'managed_postgresql', label:'Managed PostgreSQL', evidence:['DATABASE_URL','backup provider configuration','restore test evidence'] },
  { key:'private_object_storage', label:'Private object storage', evidence:['DOCUMENT_STORAGE_PROVIDER','private bucket/container','least-privilege service account','encryption and lifecycle configuration'] },
  { key:'malware_scanning_quarantine', label:'Malware scanning and quarantine', evidence:['scanner provider','quarantine location','clean-release event','malicious-file test'] },
  { key:'production_encryption_secrets', label:'Production encryption secrets', evidence:['JWT_SECRET','DOCUMENT_ENCRYPTION_KEY','AUDIT_HASH_SALT','rotation record'] },
  { key:'staff_mfa', label:'MFA or equivalent staff controls', evidence:['MFA enforcement proof','recovery procedure','role/least-privilege review'] },
  { key:'authenticated_transactional_email', label:'Authenticated transactional email', evidence:['provider configuration','SPF','DKIM','DMARC','delivery test'] },
  { key:'backup_restore_test', label:'Backup and restore testing', evidence:['database restore test','object restore test','RTO/RPO','test date'] },
  { key:'wisp_approval', label:'WISP approval', evidence:['approved document','owner','review date','training record'] },
  { key:'retention_deletion_approval', label:'Retention/deletion policy approval', evidence:['approved policy','legal hold workflow','deletion test'] },
  { key:'incident_response_approval', label:'Incident-response plan approval', evidence:['approved plan','escalation contacts','tabletop date'] },
  { key:'professional_credentials', label:'Verified professional credentials and scopes', evidence:['credential source','status','expiration','authorized scope','reviewer'] },
  { key:'stripe_live_test', label:'Live Stripe checkout and webhook testing', evidence:['live key configured','signed webhook','successful test charge','failed/refund test','reconciliation'] }
];

function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
function mappingSummary(){
  const d=readJson(MAP_PATH); const forms=d.forms||[];
  return { version:VERSION, documents:forms.length, mappedFields:forms.reduce((n,f)=>n+Number(f.fieldCount||0),0), automatedCoverageDocuments:forms.filter(f=>f.coveragePercent===100).length, humanVerifiedDocuments:forms.filter(f=>f.humanVerified).length, warning:'Automated technical semantic coverage is not equivalent to human field-by-field verification.' };
}
function sampleQaSummary(){
  const d=readJson(QA_PATH); const rows=d.records||[];
  return { version:VERSION, records:rows.length, samplesGenerated:rows.filter(r=>r.sampleGenerationStatus==='generated').length, automatedPageRenderPassed:rows.filter(r=>r.pageRenderPassed).length, humanVisualQaApproved:rows.filter(r=>r.humanVisualQaApproved).length, professionalApproved:rows.filter(r=>r.professionalApproved).length, ownerApproved:rows.filter(r=>r.ownerApproved).length, warning:'Automated rendering detects unreadable/corrupt output but does not replace page-by-page human visual review.' };
}
function normalizeEvidence(input={}){
  return { controlKey:String(input.controlKey||'').trim(), status:['pending','in_progress','complete','rejected'].includes(input.status)?input.status:'pending', evidenceReference:String(input.evidenceReference||'').trim().slice(0,1000), approvedBy:String(input.approvedBy||'').trim().slice(0,200), approvedAt:input.approvedAt||new Date().toISOString(), notes:String(input.notes||'').trim().slice(0,3000), evidenceSha256: input.evidenceReference ? crypto.createHash('sha256').update(String(input.evidenceReference)).digest('hex') : '' };
}
function evaluateOperationalLaunch({records=[], env=process.env}={}){
  const latest={}; for(const r of records) if(!latest[r.controlKey]) latest[r.controlKey]=r;
  const controls=EXTERNAL_CONTROLS.map(c=>({ ...c, complete:Boolean(latest[c.key]&&latest[c.key].status==='complete'), record:latest[c.key]||null }));
  const map=mappingSummary(), qa=sampleQaSummary();
  const internal={ automatedSemanticMappingComplete:map.automatedCoverageDocuments===map.documents, humanSemanticMappingComplete:map.humanVerifiedDocuments===map.documents, sampleGenerationComplete:qa.samplesGenerated===qa.records, automatedRenderComplete:qa.automatedPageRenderPassed===qa.records, humanVisualQaComplete:qa.humanVisualQaApproved===qa.records, professionalApprovalComplete:qa.professionalApproved===qa.records, ownerApprovalComplete:qa.ownerApproved===qa.records };
  const externalComplete=controls.every(c=>c.complete);
  const formApprovalComplete=internal.humanSemanticMappingComplete&&internal.humanVisualQaComplete&&internal.professionalApprovalComplete&&internal.ownerApprovalComplete;
  return { version:VERSION, controls, internal, mapping:map, qa, controlledPaidLiveUseAllowed:externalComplete&&formApprovalComplete, liveSensitiveUploadsAllowed:externalComplete&&formApprovalComplete&&String(env.ALLOW_LIVE_SENSITIVE_UPLOADS).toLowerCase()==='true', agencySubmissionAllowed:false, blockers:[...controls.filter(c=>!c.complete).map(c=>c.key), ...Object.entries(internal).filter(([,v])=>!v).map(([k])=>k)], boundary:'The application can record and enforce evidence, but vendor provisioning, legal/policy approval, credential verification, human visual review, and owner/professional approvals must be performed by authorized people in the live environment.' };
}
module.exports={VERSION,EXTERNAL_CONTROLS,mappingSummary,sampleQaSummary,normalizeEvidence,evaluateOperationalLaunch};
