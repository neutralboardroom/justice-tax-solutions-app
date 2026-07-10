const SPANISH_UX_POLICY = {
  version_goal: 'v0.1.56 Spanish-language UX parity and safety polish',
  principle: 'Spanish copy should match the calm, tax-problem-first English experience without promising live bilingual staff, e-file, refund products, professional representation, official form output, or sensitive uploads before those gates are complete.',
  public_language_rule: 'Use plain Spanish, avoid slang and scare tactics, and repeat the same safety boundaries shown in English.',
  staff_rule: 'Staff should treat Spanish intake as a language preference and confirm whether bilingual support, interpretation, or professional Spanish-language review is actually available before promising it.'
};

const SPANISH_GLOBAL_COPY = {
  brand_positioning: 'Ayuda con impuestos para personas que necesitan más que un programa de software.',
  calming_line: 'No entre en pánico, pero tampoco ignore una carta o aviso de impuestos.',
  safe_start: 'Puede comenzar sin subir archivos o con una copia de muestra/redactada. No suba documentos reales sin redactar todavía.',
  independence: 'Justice Tax Solutions es independiente. No somos el IRS, el Estado de Nueva York, la Ciudad de Nueva York ni una firma legal.',
  no_guarantee: 'No garantizamos reembolsos, reducción de impuestos, planes de pago, eliminación de multas, ofertas de transacción, resultados de auditoría ni ningún resultado gubernamental.',
  review_boundary: 'La IA puede organizar y resumir. La revisión humana, PTIN, EA, CPA o de abogado de impuestos es un nivel separado cuando esté disponible, asignado y pagado.',
  cost_boundary: 'Los honorarios de la plataforma/profesional no incluyen impuestos, multas, intereses, pagos al gobierno, cargos oficiales ni pagos a agencias.',
  filing_boundary: 'La presentación final, e-file, envío a agencias, débito directo, productos bancarios de reembolso y formularios oficiales finales no están activos hasta que se configuren, revisen y aprueben.'
};

const SPANISH_PUBLIC_PATHS = [
  {
    key: 'notice_help',
    english_path: 'I got a tax notice',
    spanish_label: 'Recibí una carta o aviso de impuestos',
    user_message: 'Busque la agencia, número de aviso, año fiscal, fecha, fecha límite y cantidad. Empiece con un resumen seguro antes de pagar, llamar o responder.',
    safe_next_step: 'Usar el Centro de Acción o la revisión de urgencia sin subir documentos privados.'
  },
  {
    key: 'tax_debt',
    english_path: 'I owe or cannot pay',
    spanish_label: 'Debo impuestos o no puedo pagar',
    user_message: 'Organice la deuda, años fiscales, agencia, cartas recibidas, ingresos aproximados y señales de cobro como gravámenes, embargos o amenazas de cobro.',
    safe_next_step: 'Comenzar con una evaluación de próximos pasos; las opciones de pago o alivio requieren revisión y no están garantizadas.'
  },
  {
    key: 'unfiled_returns',
    english_path: 'Back taxes or unfiled returns',
    spanish_label: 'Declaraciones atrasadas o años sin presentar',
    user_message: 'Identifique los años faltantes, tipos de ingresos, W-2/1099 disponibles y cualquier carta recibida. No pegue SSNs ni suba formularios completos todavía.',
    safe_next_step: 'Preparar una lista de años, documentos faltantes y posible nivel de revisión.'
  },
  {
    key: 'amended_returns',
    english_path: 'Amended return help',
    spanish_label: 'Necesito corregir una declaración',
    user_message: 'Explique qué cambió, qué declaración fue presentada y si recibió una carta. Las declaraciones corregidas requieren verificación cuidadosa.',
    safe_next_step: 'Crear un resumen de cambios y documentos de soporte antes de preparar cualquier formulario final.'
  },
  {
    key: 'gig_worker',
    english_path: 'Self-employed or gig-worker tax help',
    spanish_label: 'Trabajo por cuenta propia, 1099 o gig work',
    user_message: 'Organice ingresos, gastos, millas, plataformas, estimados pagados y estados de cuenta. Evite subir detalles bancarios completos.',
    safe_next_step: 'Usar el resumen seguro y solicitar revisión CPA/EA/PTIN cuando el caso sea complejo.'
  },
  {
    key: 'official_forms',
    english_path: 'Official IRS form organizers',
    spanish_label: 'Organizadores de formularios del IRS',
    user_message: 'Los formularios 9465, 433-F, 2848/8821 y 843/9423/12153 están en modo organizador/mapeo/QA, no salida oficial final.',
    safe_next_step: 'Completar organizadores solo para revisión controlada; no firmar ni enviar sin aprobación.'
  }
];

const SPANISH_REVIEW_LEVELS = [
  { key: 'ai_only', label: 'Organización con IA', boundary: 'No es revisión profesional ni consejo legal/fiscal personalizado para presentar o responder.' },
  { key: 'human_specialist', label: 'Revisión humana de organización', boundary: 'Puede revisar claridad, documentos faltantes y señales de riesgo, pero no sustituye una firma profesional cuando se requiere.' },
  { key: 'ptin', label: 'Revisión PTIN/preparador', boundary: 'Depende de credenciales verificadas, alcance permitido y disponibilidad.' },
  { key: 'ea_cpa', label: 'Revisión EA o CPA', boundary: 'Puede ser apropiada para cobros, deudas, negocios, 1099, declaraciones o casos complejos según el alcance.' },
  { key: 'tax_attorney', label: 'Revisión de abogado de impuestos', boundary: 'No está incluida automáticamente. Solo aplica si se compra/asigna y el abogado acepta el asunto.' }
];

const SPANISH_DOCUMENT_SAFETY = {
  allowed_now: [
    'Descripción general sin números completos de identificación.',
    'Fechas límite, nombre de agencia y tipo de carta escritos en sus propias palabras.',
    'Copia de muestra o redactada, si el sitio muestra claramente que el modo de muestra/redacción está permitido.'
  ],
  do_not_share_yet: [
    'SSN completo, EIN completo o números de cuenta tributaria.',
    'Declaraciones completas, W-2, 1099, transcripciones o avisos sin redactar.',
    'Información bancaria, ruta/cuenta, débito directo o datos de tarjeta.',
    'Documentos de identidad, nómina completa, ventas/impuestos de negocio o detalles sensibles no necesarios.'
  ]
};

const SPANISH_STAFF_GUIDANCE = [
  {
    lane: 'Entrada pública en español',
    action: 'Confirmar que el usuario prefiere español y mantener las respuestas públicas en lenguaje sencillo. No pedir SSNs, avisos completos ni datos bancarios por chat, email o formularios no aprobados.'
  },
  {
    lane: 'Disponibilidad de personal bilingüe',
    action: 'No prometer atención profesional en español hasta confirmar quién revisará el caso, idioma disponible, credenciales y alcance.'
  },
  {
    lane: 'Traducción y exactitud',
    action: 'Si un aviso/documento está en inglés, resumir en español como orientación organizativa. Marcar términos legales/fiscales importantes para revisión profesional.'
  },
  {
    lane: 'Límites de formularios',
    action: 'Explicar en español que los formularios oficiales siguen en modo organizador/mapeo/QA y no son formularios finales para firmar, enviar o presentar.'
  },
  {
    lane: 'Pagos y productos de reembolso',
    action: 'No decir que Refund Transfer, adelantos de reembolso, e-file o productos bancarios están activos. Son preparación futura hasta completar EFIN, proveedor, divulgaciones y pruebas.'
  }
];

const SPANISH_PAGE_PARITY_CHECKS = [
  { page: '/', status: 'improved', change: 'Add clear Español entry point and keep the main intake language selector.' },
  { page: '/ayuda-impuestos-espanol.html', status: 'rewritten', change: 'Replace mixed English/Spanish copy with a Spanish-first public help center.' },
  { page: '/pricing.html', status: 'improved', change: 'Add Spanish pricing/review-level expectations and boundaries.' },
  { page: '/dashboard.html', status: 'improved', change: 'Add Spanish client expectation cue for signed-in users.' },
  { page: '/staff.html', status: 'improved', change: 'Add staff Spanish-support lane and no-sensitive-data reminders.' },
  { page: '/staff-cockpit.html', status: 'improved', change: 'Add privacy-safe Spanish analytics/support note.' },
  { page: '/official-forms.html', status: 'improved', change: 'Add Spanish form-status language so organizer/QA mode is clear.' },
  { page: '/taxpayer-action-center.html', status: 'improved', change: 'Add Spanish safe-start routing.' },
  { page: '/document-safety-center.html', status: 'improved', change: 'Add Spanish do-not-upload summary.' },
  { page: '/tax-urgency-triage.html', status: 'improved', change: 'Add Spanish urgency explanation without promising outcomes.' },
  { page: '/safe-tax-summary-builder.html', status: 'improved', change: 'Add Spanish safe-summary explanation.' },
  { page: '/after-you-start.html', status: 'improved', change: 'Add Spanish after-submit expectation language.' }
];

function buildSpanishPublicStartMap() {
  return {
    policy: SPANISH_UX_POLICY,
    global_copy: SPANISH_GLOBAL_COPY,
    paths: SPANISH_PUBLIC_PATHS,
    review_levels: SPANISH_REVIEW_LEVELS,
    document_safety: SPANISH_DOCUMENT_SAFETY,
    recommended_public_page: '/ayuda-impuestos-espanol.html'
  };
}

function buildSpanishStaffGuidance() {
  return {
    policy: SPANISH_UX_POLICY,
    lanes: SPANISH_STAFF_GUIDANCE,
    must_confirm_before_promising: [
      'Spanish-speaking staff availability',
      'Spanish-speaking EA/CPA/tax attorney availability',
      'translator/interpreter workflow',
      'professional scope and fee approval',
      'secure document-upload approval',
      'official form release gate'
    ]
  };
}

function buildSpanishMarketingCopyMatrix() {
  return {
    must_say: [
      SPANISH_GLOBAL_COPY.calming_line,
      SPANISH_GLOBAL_COPY.safe_start,
      SPANISH_GLOBAL_COPY.independence,
      SPANISH_GLOBAL_COPY.no_guarantee,
      SPANISH_GLOBAL_COPY.review_boundary,
      SPANISH_GLOBAL_COPY.cost_boundary,
      SPANISH_GLOBAL_COPY.filing_boundary
    ],
    avoid: [
      'No diga “alivio garantizado” o “reducimos su deuda” como promesa.',
      'No diga que somos el IRS, una agencia, una firma legal o representantes autorizados en todos los casos.',
      'No diga que podemos presentar, firmar, enviar o e-file hasta que esos controles estén activos.',
      'No diga que los adelantos de reembolso o Refund Transfer están activos hasta que estén aprobados y probados.'
    ],
    preferred_terms: [
      ['tax notice', 'aviso o carta de impuestos'],
      ['tax debt', 'deuda de impuestos'],
      ['payment plan', 'plan de pago'],
      ['back taxes', 'impuestos atrasados'],
      ['unfiled returns', 'declaraciones sin presentar'],
      ['amended return', 'declaración corregida/enmendada'],
      ['human review', 'revisión humana'],
      ['professional review', 'revisión profesional'],
      ['safe summary', 'resumen seguro'],
      ['redacted/sample only', 'solo copia redactada o de muestra']
    ]
  };
}

function buildSpanishLanguageAudit({ version = '' } = {}) {
  return {
    ok: true,
    version,
    audit_name: 'Spanish-language UX parity audit',
    summary: {
      headline: 'Spanish public copy should now feel like a real user path, not a partial translation.',
      readiness: 'Ready for controlled Spanish-language public UX testing, with live sensitive uploads, official output, e-file, bank products, and professional-review promises still blocked until separately approved.',
      primary_pages: ['/ayuda-impuestos-espanol.html', '/spanish-language-audit.html']
    },
    policy: SPANISH_UX_POLICY,
    page_parity_checks: SPANISH_PAGE_PARITY_CHECKS,
    public_start_map: buildSpanishPublicStartMap(),
    staff_guidance: buildSpanishStaffGuidance(),
    marketing_copy_matrix: buildSpanishMarketingCopyMatrix(),
    unresolved_before_spanish_scale: [
      'Confirm whether staff/professionals can actually serve Spanish-speaking users in Spanish.',
      'Approve any interpreter/translation workflow and confidentiality rules.',
      'Review Spanish legal/tax disclaimers with appropriate professional input before broad marketing.',
      'Do not collect real sensitive taxpayer documents until the production security gates are complete.',
      'Do not advertise e-file, Refund Transfer, refund advance, or official form submission in Spanish until those integrations are active and tested.'
    ]
  };
}

module.exports = {
  SPANISH_UX_POLICY,
  SPANISH_GLOBAL_COPY,
  SPANISH_PUBLIC_PATHS,
  SPANISH_REVIEW_LEVELS,
  SPANISH_DOCUMENT_SAFETY,
  SPANISH_STAFF_GUIDANCE,
  SPANISH_PAGE_PARITY_CHECKS,
  buildSpanishLanguageAudit,
  buildSpanishPublicStartMap,
  buildSpanishStaffGuidance,
  buildSpanishMarketingCopyMatrix
};
