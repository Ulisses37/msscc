export interface NavLink {
  label: string;
  href: string;
}

export const adminNavLinks: NavLink[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Events', href: '/dashboard/events' },
  { label: 'Members', href: '/dashboard/memberships' },
  { label: 'Donations', href: '/dashboard/donations' },
  { label: 'Edit Pages', href: '/dashboard/editpages' },
  { label: 'Permissions Pages', href: '/dashboard/permissions' },
];