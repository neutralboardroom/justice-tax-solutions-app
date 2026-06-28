const MONEY_RE = /\$?\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/g;
const DATE_RE = /\b(?:\d{1,2}[\/-]\d{1,2}[\/-](?:20)?\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2})\b/gi;
const YEAR_RE = /\b(20\d{2})\b/g;
const EIN_RE = /\b\d{2}-\d{7}\b/g;

function cleanText(value = '') {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function maskSensitiveText(value = '') {
  return cleanText(value)
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****')
    .replace(/\b\d{9}\b/g, (match) => `*****${match.slice(-4)}`)
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email masked]')
    .slice(0, 6000);
}

function printableRatio(text = '') {
  if (!text) return 0;
  const printable = (text.match(/[\x09\x0A\x0D\x20-\x7E]/g) || []).length;
  return printable / Math.max(1, text.length);
}

function decodePdfLiteral(value = '') {
  return value
    .replace(/\\\)/g, ')')
    .replace(/\\\(/g, '(')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\/g, '');
}

function extractPdfTextHeuristic(buffer) {
  const latin = buffer.toString('latin1');
  const pieces = [];
  const literalRe = /\((?:\\.|[^\\()]){2,}\)\s*(?:Tj|'|")/g;
  let match;
  while ((match = literalRe.exec(latin)) && pieces.length < 3500) {
    const raw = match[0].replace(/\)\s*(?:Tj|'|")\s*$/, '').slice(1);
    const decoded = decodePdfLiteral(raw);
    if (/[A-Za-z0-9$]/.test(decoded)) pieces.push(decoded);
  }
  const arrayRe = /\[((?:\s*\((?:\\.|[^\\()])*\)\s*-?\d*\.?\d*){2,})\]\s*TJ/g;
  while ((match = arrayRe.exec(latin)) && pieces.length < 4500) {
    const inside = match[1];
    const inner = [];
    inside.replace(/\((?:\\.|[^\\()])*\)/g, (m) => { inner.push(decodePdfLiteral(m.slice(1, -1))); return m; });
    const joined = inner.join('');
    if (/[A-Za-z0-9$]/.test(joined)) pieces.push(joined);
  }
  let text = cleanText(pieces.join('\n'));
  if (text.length < 80) {
    const rawAscii = cleanText(latin.replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, ' '));
    const taxish = rawAscii.match(/.{0,40}(?:Internal Revenue Service|Department of the Treasury|New York State|W-2|1099|1040|CP\d{2,4}|Letter\s+\d{2,5}|amount due|balance due|tax year).{0,80}/gi) || [];
    text = cleanText(taxish.join('\n')) || text;
  }
  return text;
}

function extractLikelyTextFromBuffer(file = {}) {
  const buffer = file.buffer || Buffer.alloc(0);
  const mime = String(file.mimetype || '').toLowerCase();
  const name = String(file.originalname || '').toLowerCase();
  const result = {
    provider: 'local-starter-extractor',
    extraction_status: 'not_attempted',
    extraction_method: 'none',
    text: '',
    preview: '',
    warnings: [],
    ocr_required: false
  };
  if (!buffer.length) {
    result.extraction_status = 'failed';
    result.warnings.push('The uploaded file was empty.');
    return result;
  }
  if (mime.includes('text') || mime.includes('csv') || mime.includes('json') || /\.(txt|csv|json|log)$/i.test(name)) {
    const text = cleanText(buffer.toString('utf8'));
    result.extraction_status = text ? 'extracted' : 'failed';
    result.extraction_method = 'plain-text-buffer';
    result.text = text;
  } else if (mime.includes('pdf') || name.endsWith('.pdf') || buffer.subarray(0, 5).toString() === '%PDF-') {
    const text = extractPdfTextHeuristic(buffer);
    result.extraction_status = text ? 'extracted_partial' : 'needs_ocr';
    result.extraction_method = 'pdf-text-heuristic';
    result.text = text;
    if (!text || text.length < 120) {
      result.ocr_required = true;
      result.warnings.push('PDF text was limited or image-based. Route to OCR provider or human review before field fill.');
    }
  } else {
    const utf8 = buffer.toString('utf8');
    if (printableRatio(utf8) > 0.75) {
      result.extraction_status = 'extracted_partial';
      result.extraction_method = 'generic-printable-buffer';
      result.text = cleanText(utf8);
      result.warnings.push('Generic text extraction used because the document type was not recognized.');
    } else {
      result.extraction_status = 'needs_ocr';
      result.extraction_method = 'binary-file-needs-ocr';
      result.ocr_required = true;
      result.warnings.push('Image or binary document. Configure OCR before automated field extraction.');
    }
  }
  result.preview = maskSensitiveText(result.text).slice(0, 2500);
  return result;
}

function firstMatch(text, regex) {
  const m = String(text || '').match(regex);
  return m ? (m[1] || m[0]).trim() : '';
}

function moneyCandidates(text = '') {
  const found = [];
  let m;
  while ((m = MONEY_RE.exec(text)) && found.length < 20) found.push(m[0].replace(/\s+/g, ''));
  return Array.from(new Set(found));
}

function dateCandidates(text = '') {
  return Array.from(new Set((String(text || '').match(DATE_RE) || []).slice(0, 12)));
}

function yearCandidates(text = '') {
  const years = [];
  let m;
  while ((m = YEAR_RE.exec(text)) && years.length < 10) years.push(m[1]);
  return Array.from(new Set(years));
}

function inferAgency(text = '') {
  const t = text.toLowerCase();
  if (t.includes('internal revenue service') || t.includes('department of the treasury') || /\birs\b/i.test(text)) return 'IRS';
  if (t.includes('new york state') || t.includes('department of taxation') || t.includes('nys')) return 'New York State';
  if (t.includes('nyc department of finance') || t.includes('department of finance') || t.includes('new york city')) return 'NYC Department of Finance';
  return '';
}

function confidenceLabel(score = 0) {
  if (score >= 85) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 35) return 'low';
  return 'needs_ocr_or_manual_review';
}

function addField(fields, key, label, value, confidence, sourceHint, required = false) {
  if (!value && !required) return;
  fields.push({ key, label, value: value || '', confidence_score: confidence, confidence_label: confidenceLabel(confidence), source_hint: sourceHint, status: confidence >= 85 ? 'needs_human_confirmation' : 'needs_manual_entry_or_ocr', required_before_filing: Boolean(required) });
}

function extractFieldsForType(text = '', documentTypeKey = '') {
  const fields = [];
  const clean = cleanText(text);
  const years = yearCandidates(clean);
  const dates = dateCandidates(clean);
  const amounts = moneyCandidates(clean);
  if (['irs_notice','nys_notice','nyc_notice'].includes(documentTypeKey)) {
    addField(fields, 'agency', 'Agency', inferAgency(clean), inferAgency(clean) ? 88 : 30, 'agency header / letterhead', true);
    addField(fields, 'notice_number', 'Notice or letter number', firstMatch(clean, /\b(CP\s?\d{2,4}|LT\s?\d{2,4}|Letter\s+\d{2,5}|DTF[-\s]?\d{2,5}|NYC[-\s]?[A-Z0-9]{2,8})\b/i), 78, 'notice/letter code near header', true);
    addField(fields, 'tax_year', 'Tax year', years[0] || '', years[0] ? 68 : 20, 'first tax year detected', true);
    addField(fields, 'possible_deadline', 'Possible deadline / response date', dates[0] || '', dates[0] ? 55 : 20, 'first date detected; must verify exact deadline', true);
    addField(fields, 'possible_amount_due', 'Possible amount / balance', amounts[0] || '', amounts[0] ? 50 : 20, 'first money amount detected; must verify against notice', true);
    addField(fields, 'taxpayer_id_last4', 'Taxpayer ID last 4 if visible', firstMatch(clean, /(?:SSN|TIN|Taxpayer\s+ID|ID)\D{0,12}(\*{0,5}\d{4}|XXX-XX-\d{4}|\d{4})/i), 45, 'masked taxpayer-id pattern', true);
  } else if (documentTypeKey === 'w2') {
    const eins = clean.match(EIN_RE) || [];
    addField(fields, 'employer_ein', 'Employer EIN', eins[0] || '', eins[0] ? 75 : 20, 'EIN pattern on W-2', true);
    addField(fields, 'wages_box_1', 'Wages, tips, other compensation / Box 1', firstMatch(clean, /(?:box\s*1|wages[,\s]+tips[,\s]+other compensation)\D{0,60}(\$?\s?[0-9][0-9,]*(?:\.[0-9]{2})?)/i), 52, 'Box 1 / wages label', true);
    addField(fields, 'federal_withholding_box_2', 'Federal income tax withheld / Box 2', firstMatch(clean, /(?:box\s*2|federal income tax withheld)\D{0,60}(\$?\s?[0-9][0-9,]*(?:\.[0-9]{2})?)/i), 52, 'Box 2 / withholding label', true);
  } else if (documentTypeKey === '1099_nec') {
    addField(fields, 'payer_tin', 'Payer TIN', firstMatch(clean, /(?:payer'?s? tin|payer tin|payer federal identification)\D{0,30}(\d{2}-\d{7}|\*{0,5}\d{4})/i), 55, 'payer TIN label', true);
    addField(fields, 'nonemployee_compensation_box_1', 'Nonemployee compensation / Box 1', firstMatch(clean, /(?:box\s*1|nonemployee compensation)\D{0,80}(\$?\s?[0-9][0-9,]*(?:\.[0-9]{2})?)/i) || amounts[0] || '', 58, 'Box 1 / nonemployee compensation', true);
  } else if (documentTypeKey === '1099_k') {
    addField(fields, 'gross_payment_amount', 'Gross payment amount', firstMatch(clean, /(?:gross amount|gross payment amount|third party network)\D{0,100}(\$?\s?[0-9][0-9,]*(?:\.[0-9]{2})?)/i) || amounts[0] || '', 55, '1099-K gross payment label', true);
  } else if (documentTypeKey === '1098_t') {
    addField(fields, 'qualified_tuition', 'Qualified tuition and related expenses', firstMatch(clean, /(?:qualified tuition|payments received)\D{0,80}(\$?\s?[0-9][0-9,]*(?:\.[0-9]{2})?)/i) || amounts[0] || '', 50, '1098-T tuition label', true);
  } else if (documentTypeKey === '1095_a') {
    addField(fields, 'marketplace_policy_number', 'Marketplace policy number', firstMatch(clean, /(?:policy number|policy no\.)\D{0,40}([A-Z0-9-]{4,30})/i), 48, 'policy number label', true);
    addField(fields, 'monthly_premium_candidate', 'Monthly premium candidate', amounts[0] || '', amounts[0] ? 40 : 15, 'first amount detected; monthly rows need professional review', true);
  } else if (documentTypeKey === 'prior_return') {
    addField(fields, 'filing_year', 'Return year', years[0] || '', years[0] ? 55 : 20, 'year on prior return', true);
    addField(fields, 'adjusted_gross_income_candidate', 'Possible AGI', firstMatch(clean, /(?:adjusted gross income|AGI)\D{0,60}(\$?\s?[0-9][0-9,]*(?:\.[0-9]{2})?)/i), 40, 'AGI label; verify against filed return', true);
  } else if (documentTypeKey === 'business_records') {
    addField(fields, 'gross_receipts_candidate', 'Possible gross receipts', amounts[0] || '', amounts[0] ? 35 : 15, 'amount detected in business record; categorize manually', false);
    addField(fields, 'mileage_candidate', 'Possible mileage', firstMatch(clean, /(?:miles|mileage)\D{0,30}([0-9][0-9,]*)/i), 35, 'mileage text pattern', false);
  } else if (documentTypeKey === 'financial_statement') {
    addField(fields, 'income_expense_amount_candidate', 'Possible income/expense amount', amounts[0] || '', amounts[0] ? 35 : 15, 'first money amount; needs financial review', false);
  }
  return fields;
}

function extractionConfidenceScore(extraction, classification, fields = []) {
  let score = 10;
  if (extraction.extraction_status === 'extracted') score += 35;
  if (extraction.extraction_status === 'extracted_partial') score += 22;
  if (extraction.extraction_status === 'needs_ocr') score -= 5;
  if (classification && classification.key && classification.key !== 'unknown_tax_document') score += 25;
  if (String(classification && classification.confidence || '').includes('high')) score += 8;
  if (fields.length) score += Math.min(20, fields.length * 4);
  if (extraction.ocr_required) score -= 15;
  return Math.max(0, Math.min(100, score));
}

function buildDocumentExtractionProfile(file = {}, classification = null) {
  const extraction = extractLikelyTextFromBuffer(file);
  const fields = extractFieldsForType(extraction.text, classification && classification.key ? classification.key : '');
  const score = extractionConfidenceScore(extraction, classification, fields);
  const requiredFields = fields.filter((f) => f.required_before_filing);
  return {
    extraction_status: extraction.extraction_status,
    extraction_method: extraction.extraction_method,
    extraction_provider: extraction.provider,
    extracted_text_preview: extraction.preview,
    extracted_text_length: cleanText(extraction.text).length,
    extracted_fields: fields,
    extraction_confidence_score: score,
    extraction_confidence_label: confidenceLabel(score),
    human_verification_required: true,
    ocr_required: extraction.ocr_required,
    warnings: [
      ...(extraction.warnings || []),
      ...(requiredFields.length ? ['Required tax fields remain verification-only until client/professional confirms them.'] : []),
      'Do not file, sign, or send agency responses based only on OCR/extraction.'
    ],
    controls: [
      'Source-linked extracted values must be confirmed before field fill.',
      'SSN/TIN, bank, deadline, tax-year, balance/refund, and signature fields require professional/client verification.',
      'Image-only PDFs require configured OCR or manual entry.'
    ]
  };
}

function buildVerificationQueue(cases = []) {
  const rows = [];
  for (const c of cases || []) {
    for (const doc of c.documents || []) {
      const profile = doc.extraction_profile || {};
      const fields = profile.extracted_fields || doc.extracted_fields || [];
      const needs = fields.filter((f) => !['verified','rejected','professional_override'].includes(String(f.status || ''))).length;
      rows.push({
        case_id: c.id,
        email: c.email || '',
        pathway: c.pathway || '',
        risk_level: c.risk_level || '',
        document_id: doc.id,
        original_name: doc.original_name,
        document_type: doc.classification ? doc.classification.key : 'unknown',
        document_label: doc.classification ? doc.classification.label : 'Unknown',
        extraction_status: profile.extraction_status || doc.extraction_status || 'not_attempted',
        extraction_confidence_score: Number(profile.extraction_confidence_score || doc.extraction_confidence_score || 0),
        extraction_confidence_label: profile.extraction_confidence_label || doc.extraction_confidence_label || 'unknown',
        ocr_required: Boolean(profile.ocr_required || doc.ocr_required),
        fields_needing_verification: needs,
        warnings: profile.warnings || []
      });
    }
  }
  return rows.sort((a, b) => Number(b.ocr_required) - Number(a.ocr_required) || b.fields_needing_verification - a.fields_needing_verification || a.extraction_confidence_score - b.extraction_confidence_score);
}

module.exports = {
  cleanText,
  maskSensitiveText,
  extractLikelyTextFromBuffer,
  extractFieldsForType,
  buildDocumentExtractionProfile,
  buildVerificationQueue,
  confidenceLabel
};
