// Role tokens — keep in sync with backend's User.role values. The mobile
// app deliberately does NOT include 'platform_admin' (admin tooling is
// web-only).

export const ROLES = {
  CLIENT: 'client',
  PROFESSIONAL: 'professional',
};

// Friendly labels for the role picker.
export const ROLE_LABEL = {
  [ROLES.CLIENT]: 'Client',
  [ROLES.PROFESSIONAL]: 'Professional',
};
