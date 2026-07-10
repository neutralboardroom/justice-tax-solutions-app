const APP_VERSION = '0.1.67';

function getConsultationSchedulingFramework() {
  return {
    version: APP_VERSION,
    status: 'framework_ready_configuration_required',
    consultationTypes: [
      { id: 'video', label: 'Video consultation', providers: ['Google Meet', 'Zoom'] },
      { id: 'phone', label: 'Phone consultation' },
      { id: 'office', label: 'In-person office consultation' }
    ],
    calendarProviders: [
      { id: 'google_calendar', label: 'Google Calendar', status: 'integration_configuration_required' },
      { id: 'calendly', label: 'Calendly', status: 'integration_configuration_required' }
    ],
    rules: [
      'Do not claim live calendar, video, or phone integrations until credentials and testing are complete.',
      'Store consultation requests separately from sensitive taxpayer document content.',
      'Keep customer choice simple: video, phone, or office consultation.'
    ]
  };
}

module.exports = { getConsultationSchedulingFramework };
