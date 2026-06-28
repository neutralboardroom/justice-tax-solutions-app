const DEFAULT_VENDOR_ORDER = (process.env.AI_VENDOR_ORDER || 'openai,gemini,anthropic,xai')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

function configuredVendors() {
  const vendors = [];
  if (process.env.OPENAI_API_KEY) vendors.push('openai');
  if (process.env.GEMINI_API_KEY) vendors.push('gemini');
  if (process.env.ANTHROPIC_API_KEY) vendors.push('anthropic');
  if (process.env.XAI_API_KEY) vendors.push('xai');
  return DEFAULT_VENDOR_ORDER.filter((vendor) => vendors.includes(vendor));
}

function systemPrompt() {
  return [
    'You are the Justice Tax Solutions Navigator.',
    'You help organize tax concerns, explain tax notices in plain English, and identify missing information.',
    'You do not promise refunds, do not guarantee tax debt reduction, and do not provide legal advice.',
    'For paid filing or final positions, route to a PTIN preparer, CPA, EA, accountant, or tax attorney as appropriate.',
    'Use cautious, compliance-forward language for IRS, New York State, and New York City tax issues.'
  ].join('\n');
}

function buildUserPrompt(taxCase) {
  return JSON.stringify({
    task: 'Create a concise tax concern summary, missing document list, risk flags, and recommended next step.',
    tax_case: taxCase
  }, null, 2);
}

async function callOpenAI(taxCase) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: buildUserPrompt(taxCase) }
      ]
    })
  });
  if (!response.ok) throw new Error(`OpenAI error ${response.status}`);
  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

async function callGemini(taxCase) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt()}\n\n${buildUserPrompt(taxCase)}` }] }],
      generationConfig: { temperature: 0.2 }
    })
  });
  if (!response.ok) throw new Error(`Gemini error ${response.status}`);
  const json = await response.json();
  return json.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n') || '';
}

async function callAnthropic(taxCase) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 1000,
      temperature: 0.2,
      system: systemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(taxCase) }]
    })
  });
  if (!response.ok) throw new Error(`Anthropic error ${response.status}`);
  const json = await response.json();
  return json.content?.map((part) => part.text).join('\n') || '';
}

async function callXai(taxCase) {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL || 'grok-3-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: buildUserPrompt(taxCase) }
      ]
    })
  });
  if (!response.ok) throw new Error(`xAI error ${response.status}`);
  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

async function runAiSummary(taxCase) {
  const vendors = configuredVendors();
  const errors = [];
  for (const vendor of vendors) {
    try {
      let content = '';
      if (vendor === 'openai') content = await callOpenAI(taxCase);
      if (vendor === 'gemini') content = await callGemini(taxCase);
      if (vendor === 'anthropic') content = await callAnthropic(taxCase);
      if (vendor === 'xai') content = await callXai(taxCase);
      if (content) return { vendor, content, mode: 'live_ai' };
    } catch (error) {
      errors.push({ vendor, message: error.message });
    }
  }

  return {
    vendor: 'rule-based',
    mode: 'safe_fallback',
    errors,
    content: [
      `Risk level: ${taxCase.risk_level.toUpperCase()}`,
      `Agency: ${taxCase.agency}`,
      `Flags: ${(taxCase.flags || []).map((flag) => flag.label).join(', ') || 'Needs review after documents are uploaded.'}`,
      `Missing items: ${(taxCase.missing_items || []).join(' ')}`,
      `Recommended next step: ${(taxCase.recommended_next_steps || []).join(' ')}`
    ].join('\n')
  };
}

module.exports = {
  configuredVendors,
  runAiSummary
};
