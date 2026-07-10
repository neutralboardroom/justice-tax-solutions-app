const APP_VERSION = '0.1.67';

function getDashboardExperienceUpgrade() {
  return {
    version: APP_VERSION,
    dashboards: {
      customer: ['Tax journey status', 'Next best action', 'Documents center', 'Consultation center'],
      staff: ['Case pipeline', 'Follow-up queue', 'Consultation requests', 'Missing information tracking'],
      professional: ['Assigned cases', 'Consultation calendar', 'Availability settings', 'Review workspace'],
      owner: ['Platform overview', 'Workload visibility', 'Readiness tracking']
    }
  };
}

module.exports = { getDashboardExperienceUpgrade };
