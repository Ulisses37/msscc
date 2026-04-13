export interface NavLink {
  label: string;
  href: string;
}

export const adminNavLinks: NavLink[] = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Events', href: '/admin/events' },
  { label: 'Members', href: '/admin/memberships' },
  { label: 'Donations', href: '/admin/donations' },
  { label: 'Edit Pages', href: '/admin/editpages' },
  { label: 'Permissions Pages', href: '/admin/permissions' },
];
