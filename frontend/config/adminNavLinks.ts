export interface NavLink {
  label: string;
  href: string;
}

export const adminNavLinks: NavLink[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Events', href: '/events' },
  { label: 'Members', href: '/members' },
  { label: 'Donations', href: '/donations' },
  { label: 'Edit Pages', href: '/editpages' },
];