const crypto = require('crypto');

const CALENDAR_INTEGRATION_POLICY = {
  positioning: 'Justice Tax Solutions should support live online and phone/in-person professional sessions without forcing every professional to abandon their existing calendar workflow.',
  firstBuildApproach: 'Provider-agnostic scheduling layer with manual staff-entered links first; API integrations can be added later for Google Calendar, Calendly, Outlook/Microsoft 365, Teams, Zoom, and other scheduling tools.',
  manualFallback: 'During pilot, staff can paste a Calendly booking page, Google Meet link, Zoom link, Microsoft Teams link, phone-call instructions, or in-person location into the professional-session request.',
  privacyRule: 'Do not expose private professional calendar details to customers. Customers should see only available booking options, confirmed appointment details, meeting method, meeting link when confirmed, and reschedule/cancel instructions.',
  complianceRule: 'Do not claim real-time availability, calendar sync, automatic meeting generation, or reminders unless the integration is actually configured and tested.'
};

const CALENDAR_PROVIDERS = [
  {
    key: 'manual_staff_entry',
    label: 'Manual staff scheduling',
    currentStatus: 'available_now',
    useCase: 'Staff chooses time outside the app and pastes a meeting link or phone/in-person instruction.',
    setup: ['No API required', 'Staff enters appointment details', 'Staff confirms quote/payment gates first'],
    customerVisible: 'Confirmed date, time, mode, meeting instructions, and reschedule/cancel contact instructions.'
  },
  {
    key: 'calendly',
    label: 'Calendly',
    currentStatus: 'planned_adapter',
    useCase: 'Professionals keep their existing Calendly booking page and staff/customer can use the approved link.',
    setup: ['CALENDLY_API_KEY or OAuth later', 'CALENDLY_WEBHOOK_SECRET later', 'professional calendlyLink/bookingPageUrl'],
    customerVisible: 'Booking page or approved booking link only; no private calendar data.'
  },
  {
    key: 'google_calendar',
    label: 'Google Calendar / Google Meet',
    currentStatus: 'planned_adapter',
    useCase: 'Read availability or create events/Meet links once Google OAuth and permission design are ready.',
    setup: ['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_REDIRECT_URI', 'professionalCalendarEmail'],
    customerVisible: 'Available slots or confirmed Google Meet link after authorization.'
  },
  {
    key: 'microsoft_365',
    label: 'Microsoft Outlook / Microsoft 365 Calendar / Teams',
    currentStatus: 'planned_adapter',
    useCase: 'Read professional availability or create Teams appointments via Microsoft Graph once configured.',
    setup: ['MICROSOFT_GRAPH_CLIENT_ID', 'MICROSOFT_GRAPH_CLIENT_SECRET', 'MICROSOFT_GRAPH_TENANT_ID'],
    customerVisible: 'Available slots or confirmed Teams link after authorization.'
  },
  {
    key: 'zoom',
    label: 'Zoom',
    currentStatus: 'planned_adapter_or_manual_link',
    useCase: 'Use staff-pasted Zoom links now; add Zoom meeting generation later if useful.',
    setup: ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_ACCOUNT_ID or OAuth later'],
    customerVisible: 'Approved Zoom link only after confirmation.'
  },
  {
    key: 'phone',
    label: 'Phone call',
    currentStatus: 'available_now',
    useCase: 'Professional calls the client or client calls a staffed line at the scheduled time.',
    setup: ['Staff enters call instructions', 'Confirm number collection policy', 'Avoid sensitive details in reminders'],
    customerVisible: 'Call window, who calls whom, and no-sensitive-details reminder.'
  },
  {
    key: 'in_person',
    label: 'In-person appointment',
    currentStatus: 'manual_or_location_limited',
    useCase: 'Available only by location/partner/professional availability; not promised nationally.',
    setup: ['appointmentLocation', 'availability by city/professional', 'staff confirmation'],
    customerVisible: 'Address or location instruction only after appointment is confirmed.'
  }
];

const SCHEDULING_STATUSES = [
  'requested',
  'needs_quote',
  'quote_sent',
  'customer_approved',
  'awaiting_scheduling',
  'scheduling_link_sent',
  'scheduled',
  'reschedule_requested',
  'canceled',
  'completed',
  'no_show',
  'blocked'
];

const ENVIRONMENT_PLACEHOLDERS = [
  'DEFAULT_CALENDAR_PROVIDER',
  'GOOGLE_CALENDAR_CLIENT_ID',
  'GOOGLE_CALENDAR_CLIENT_SECRET',
  'GOOGLE_CALENDAR_REDIRECT_URI',
  'CALENDLY_API_KEY',
  'CALENDLY_WEBHOOK_SECRET',
  'MICROSOFT_GRAPH_CLIENT_ID',
  'MICROSOFT_GRAPH_CLIENT_SECRET',
  'MICROSOFT_GRAPH_TENANT_ID',
  'ZOOM_CLIENT_ID',
  'ZOOM_CLIENT_SECRET',
  'ZOOM_ACCOUNT_ID',
  'DEFAULT_MEETING_PROVIDER',
  'APPOINTMENT_TIMEZONE',
  'STAFF_MEETING_LINK_FALLBACK'
];

function clean(value = '', max = 500) {
  return String(value || '').trim().slice(0, max);
}

function providerKeys() {
  return new Set(CALENDAR_PROVIDERS.map((p) => p.key));
}

function normalizeProvider(provider = '') {
  const key = clean(provider, 80).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!key) return 'manual_staff_entry';
  if (['google','google_meet','google_calendar','gcal'].includes(key)) return 'google_calendar';
  if (['microsoft','microsoft_teams','teams','outlook','outlook_calendar','microsoft_365'].includes(key)) return 'microsoft_365';
  if (['calendar_link','booking_link','manual','manual_staff_entry'].includes(key)) return 'manual_staff_entry';
  if (['calendly'].includes(key)) return 'calendly';
  if (['zoom'].includes(key)) return 'zoom';
  if (['phone','phone_call'].includes(key)) return 'phone';
  if (['in_person','office','onsite'].includes(key)) return 'in_person';
  return providerKeys().has(key) ? key : 'manual_staff_entry';
}

function normalizeStatus(status = '') {
  const key = clean(status, 80).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return SCHEDULING_STATUSES.includes(key) ? key : 'requested';
}

function buildCalendarIntegrationGuide() {
  const configured = {
    defaultCalendarProvider: process.env.DEFAULT_CALENDAR_PROVIDER || 'manual_staff_entry',
    defaultMeetingProvider: process.env.DEFAULT_MEETING_PROVIDER || 'manual_staff_entry',
    appointmentTimezone: process.env.APPOINTMENT_TIMEZONE || 'America/New_York',
    googleCalendarConfigured: Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
    calendlyConfigured: Boolean(process.env.CALENDLY_API_KEY),
    microsoftGraphConfigured: Boolean(process.env.MICROSOFT_GRAPH_CLIENT_ID && process.env.MICROSOFT_GRAPH_CLIENT_SECRET),
    zoomConfigured: Boolean(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET),
    staffFallbackConfigured: Boolean(process.env.STAFF_MEETING_LINK_FALLBACK)
  };
  return {
    policy: CALENDAR_INTEGRATION_POLICY,
    providers: CALENDAR_PROVIDERS,
    statuses: SCHEDULING_STATUSES,
    environmentPlaceholders: ENVIRONMENT_PLACEHOLDERS,
    configured,
    recommendedFirstImplementation: [
      'Use manual staff-entered scheduling and meeting links for the pilot.',
      'Let each professional store their preferred calendar provider, booking page, calendar email, and meeting provider.',
      'Support Calendly links immediately as pasted booking URLs without API dependence.',
      'Add API sync only after privacy, OAuth, webhook, reminder, and audit-log requirements are clear.',
      'Show customers only confirmed appointment details and approved booking/reschedule links.'
    ]
  };
}

function professionalCalendarRecord(body = {}, user = {}) {
  const provider = normalizeProvider(body.professionalCalendarProvider || body.calendar_provider || body.provider);
  const meetingProvider = normalizeProvider(body.meetingProvider || body.meeting_provider || provider);
  return {
    id: body.id || `cal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    professional_id: clean(body.professionalId || body.professional_id || '', 120),
    professional_name: clean(body.professionalName || body.professional_name || '', 160),
    professional_role: clean(body.professionalRole || body.professional_role || '', 160),
    professional_calendar_provider: provider,
    professional_calendar_email: clean(body.professionalCalendarEmail || body.professional_calendar_email || '', 180),
    external_calendar_id: clean(body.externalCalendarId || body.external_calendar_id || '', 180),
    calendly_link: clean(body.calendlyLink || body.calendly_link || '', 500),
    booking_page_url: clean(body.bookingPageUrl || body.booking_page_url || body.bookingUrl || '', 500),
    meeting_provider: meetingProvider,
    default_meeting_link: clean(body.defaultMeetingLink || body.default_meeting_link || '', 500),
    default_phone_instruction: clean(body.defaultPhoneInstruction || body.default_phone_instruction || '', 500),
    default_in_person_location: clean(body.defaultInPersonLocation || body.default_in_person_location || '', 500),
    appointment_timezone: clean(body.appointmentTimezone || body.appointment_timezone || process.env.APPOINTMENT_TIMEZONE || 'America/New_York', 80),
    calendar_sync_status: 'manual_or_not_connected',
    last_calendar_sync_at: '',
    status: clean(body.status || 'active', 80),
    staff_notes: clean(body.staffNotes || body.staff_notes || '', 1200),
    updated_by: user.id || user.email || 'system'
  };
}

function listProfessionalCalendarConfigs(store) {
  const configs = store.list('professional_calendar_configs', (c) => !c.deleted_at).slice(0, 500);
  const professionals = store.list('professionals', (p) => !p.deleted_at).slice(0, 500);
  const configuredIds = new Set(configs.map((c) => c.professional_id).filter(Boolean));
  const missing = professionals.filter((p) => !configuredIds.has(p.id)).map((p) => ({
    professional_id: p.id,
    professional_name: p.name,
    professional_role: p.role_label || p.role_key || p.role || '',
    recommendation: 'Add calendar provider, booking link, meeting preference, and appointment timezone before confirming live sessions.'
  }));
  return {
    summary: {
      configs: configs.length,
      professionalsMissingCalendarConfig: missing.length,
      manualFallbackAvailable: true,
      liveApiSyncConfigured: Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.CALENDLY_API_KEY || process.env.MICROSOFT_GRAPH_CLIENT_ID || process.env.ZOOM_CLIENT_ID)
    },
    configs,
    missingProfessionalConfigs: missing,
    policy: CALENDAR_INTEGRATION_POLICY
  };
}

function buildSchedulingReadiness({ caseData = {}, sessionRequest = {}, calendarConfig = {} } = {}) {
  const missing = [];
  if (!caseData.id && !sessionRequest.case_id) missing.push('Case must exist before appointment scheduling.');
  if (!sessionRequest.id && !caseData.professional_session_requested) missing.push('Professional-session request should be created before scheduling.');
  if (!sessionRequest.quote_status || /needed|required/.test(String(sessionRequest.quote_status))) missing.push('Quote or upgrade approval should be shown before confirming paid professional time.');
  if (!sessionRequest.final_level && !caseData.professional_session_level) missing.push('Professional level must be selected or routed before scheduling.');
  if (!calendarConfig.professional_calendar_provider && !sessionRequest.meeting_provider) missing.push('Professional calendar/meeting provider or manual fallback should be selected.');
  if (!sessionRequest.meeting_link && !calendarConfig.calendly_link && !calendarConfig.booking_page_url && !calendarConfig.default_meeting_link && !sessionRequest.phone_instruction && !sessionRequest.appointment_location) missing.push('Staff must provide a booking link, meeting link, phone instruction, or in-person location before confirmation.');
  const score = Math.max(0, 100 - missing.length * 16);
  return {
    score,
    stage: score >= 85 ? 'ready_to_schedule_or_confirm' : score >= 55 ? 'needs_staff_scheduling_cleanup' : 'not_ready_for_scheduling',
    missing,
    safeNextStep: missing.length ? 'Staff should resolve missing scheduling items before confirming the appointment.' : 'Staff can send/confirm the appointment details and keep private calendar data hidden from the customer.'
  };
}

function buildAppointmentOptions({ caseData = {}, sessionRequest = {} } = {}) {
  return {
    availableModes: ['online video', 'online voice', 'phone', 'in person if available', 'no preference'],
    defaultTimezone: process.env.APPOINTMENT_TIMEZONE || 'America/New_York',
    customerPreference: sessionRequest.appointment_mode || caseData.appointment_mode || caseData.preferred_help_mode || 'no preference',
    providerOptions: CALENDAR_PROVIDERS.map((p) => ({ key: p.key, label: p.label, currentStatus: p.currentStatus, useCase: p.useCase })),
    customerVisibleRule: CALENDAR_INTEGRATION_POLICY.privacyRule,
    noApiRequiredForPilot: true
  };
}

function createAppointmentSchedulingRequest(store, c = {}, user = {}, body = {}) {
  const provider = normalizeProvider(body.professionalCalendarProvider || body.calendar_provider || body.meetingProvider || body.provider);
  const status = normalizeStatus(body.appointmentStatus || body.appointment_status || 'requested');
  const record = store.insert('appointment_scheduling_events', {
    id: `appt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    case_id: c.id || clean(body.case_id || '', 120),
    user_id: user.id || '',
    email: c.email || user.email || clean(body.email || '', 180),
    professional_session_request_id: clean(body.professionalSessionRequestId || body.professional_session_request_id || '', 160),
    professional_id: clean(body.professionalId || body.professional_id || '', 160),
    professional_name: clean(body.professionalName || body.professional_name || '', 160),
    professional_role: clean(body.professionalRole || body.professional_role || c.professional_session_level || '', 120),
    requested_help_mode: clean(body.requestedHelpMode || body.requested_help_mode || body.appointmentMode || body.appointment_mode || 'no preference', 80),
    customer_timezone: clean(body.customerTimezone || body.customer_timezone || '', 80),
    appointment_timezone: clean(body.appointmentTimezone || body.appointment_timezone || process.env.APPOINTMENT_TIMEZONE || 'America/New_York', 80),
    preferred_times: clean(body.preferredTimes || body.preferred_times || c.preferred_times || '', 1000),
    professional_calendar_provider: provider,
    meeting_provider: normalizeProvider(body.meetingProvider || body.meeting_provider || provider),
    meeting_link: clean(body.meetingLink || body.meeting_link || '', 500),
    booking_page_url: clean(body.bookingPageUrl || body.booking_page_url || body.calendlyLink || '', 500),
    appointment_start: clean(body.appointmentStart || body.appointment_start || '', 80),
    appointment_end: clean(body.appointmentEnd || body.appointment_end || '', 80),
    appointment_location: clean(body.appointmentLocation || body.appointment_location || '', 500),
    phone_instruction: clean(body.phoneInstruction || body.phone_instruction || '', 500),
    reschedule_link: clean(body.rescheduleLink || body.reschedule_link || '', 500),
    cancellation_link: clean(body.cancellationLink || body.cancellation_link || '', 500),
    appointment_status: status,
    calendar_sync_status: 'manual_or_not_connected',
    staff_notes: clean(body.staffNotes || body.staff_notes || '', 1200),
    privacy_note: CALENDAR_INTEGRATION_POLICY.privacyRule
  });
  if (c.id) {
    store.update('cases', c.id, {
      appointment_requested: true,
      appointment_requested_at: new Date().toISOString(),
      appointment_mode: record.requested_help_mode,
      appointment_status: record.appointment_status,
      appointment_timezone: record.appointment_timezone,
      meeting_provider: record.meeting_provider,
      meeting_link: record.meeting_link || c.meeting_link || '',
      booking_page_url: record.booking_page_url || c.booking_page_url || ''
    });
  }
  return record;
}

function updateProfessionalSessionSchedule(store, requestId, body = {}, staff = {}) {
  const request = store.find('professional_session_requests', (r) => r.id === requestId && !r.deleted_at);
  if (!request) return null;
  const patch = {
    scheduling_status: normalizeStatus(body.scheduling_status || body.appointment_status || 'scheduled'),
    meeting_provider: normalizeProvider(body.meeting_provider || body.meetingProvider || request.meeting_provider || 'manual_staff_entry'),
    professional_calendar_provider: normalizeProvider(body.professional_calendar_provider || body.professionalCalendarProvider || request.professional_calendar_provider || 'manual_staff_entry'),
    meeting_link: clean(body.meeting_link || body.meetingLink || request.meeting_link || '', 500),
    booking_page_url: clean(body.booking_page_url || body.bookingPageUrl || request.booking_page_url || '', 500),
    appointment_start: clean(body.appointment_start || body.appointmentStart || request.appointment_start || '', 80),
    appointment_end: clean(body.appointment_end || body.appointmentEnd || request.appointment_end || '', 80),
    appointment_timezone: clean(body.appointment_timezone || body.appointmentTimezone || request.appointment_timezone || process.env.APPOINTMENT_TIMEZONE || 'America/New_York', 80),
    appointment_mode: clean(body.appointment_mode || body.appointmentMode || request.appointment_mode || 'online video', 80),
    appointment_location: clean(body.appointment_location || body.appointmentLocation || request.appointment_location || '', 500),
    phone_instruction: clean(body.phone_instruction || body.phoneInstruction || request.phone_instruction || '', 500),
    reschedule_link: clean(body.reschedule_link || body.rescheduleLink || request.reschedule_link || '', 500),
    cancellation_link: clean(body.cancellation_link || body.cancellationLink || request.cancellation_link || '', 500),
    staff_note: clean(body.staff_note || body.staffNotes || request.staff_note || '', 1200),
    calendar_sync_status: 'manual_or_not_connected',
    scheduled_by: staff.id || staff.email || 'staff'
  };
  return store.update('professional_session_requests', request.id, patch);
}

function buildAppointmentSchedulingBoard(store) {
  const requests = store.list('professional_session_requests', (r) => !r.deleted_at).slice(0, 500);
  const events = store.list('appointment_scheduling_events', (e) => !e.deleted_at).slice(0, 500);
  const configs = listProfessionalCalendarConfigs(store);
  const lanes = {
    needsScheduling: requests.filter((r) => !['scheduled','completed','canceled','cancelled'].includes(String(r.scheduling_status || r.appointment_status || ''))),
    scheduled: requests.filter((r) => ['scheduled','in_progress'].includes(String(r.scheduling_status || r.appointment_status || ''))),
    manualEvents: events.filter((e) => ['requested','awaiting_scheduling','scheduling_link_sent','scheduled'].includes(String(e.appointment_status || ''))),
    needsCalendarConfig: configs.missingProfessionalConfigs
  };
  return {
    summary: Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, v.length])),
    lanes,
    providers: CALENDAR_PROVIDERS,
    policy: CALENDAR_INTEGRATION_POLICY,
    calendarConfigs: configs.summary
  };
}

module.exports = {
  CALENDAR_INTEGRATION_POLICY,
  CALENDAR_PROVIDERS,
  SCHEDULING_STATUSES,
  ENVIRONMENT_PLACEHOLDERS,
  buildCalendarIntegrationGuide,
  buildAppointmentOptions,
  professionalCalendarRecord,
  listProfessionalCalendarConfigs,
  buildSchedulingReadiness,
  createAppointmentSchedulingRequest,
  updateProfessionalSessionSchedule,
  buildAppointmentSchedulingBoard,
  normalizeProvider,
  normalizeStatus
};
