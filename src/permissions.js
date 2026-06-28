const ROLE_PERMISSIONS = {
  client: ['case:own:read','case:own:create','case:own:submit_review','case:own:approve','document:own:download','referral:own:read'],
  community_partner: ['case:own:read','case:own:create','referral:own:read','referral:own:flyer'],
  human_tax_specialist: ['staff:dashboard','case:read','case:note','review:queue','document:case:download','referral:verify'],
  professional: ['staff:dashboard','case:read','case:note','review:queue','review:signoff','document:case:download','professional:own:update'],
  staff: ['staff:dashboard','case:read','case:note','case:assign','review:queue','document:case:download','referral:verify','export:limited'],
  admin: ['*'],
  owner: ['*']
};

function normalizedRole(user = {}) {
  return String(user.role || 'client').toLowerCase();
}

function permissionsForRole(role = 'client') {
  return ROLE_PERMISSIONS[String(role || 'client').toLowerCase()] || ROLE_PERMISSIONS.client;
}

function hasPermission(user = {}, permission = '') {
  const perms = permissionsForRole(normalizedRole(user));
  return perms.includes('*') || perms.includes(permission);
}

function publicPermissions(user = {}) {
  return permissionsForRole(normalizedRole(user)).filter((p) => p !== '*');
}

module.exports = { ROLE_PERMISSIONS, normalizedRole, permissionsForRole, hasPermission, publicPermissions };
