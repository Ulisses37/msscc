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
  { label: 'Documentation Pages', href: '/admin/documentation' },
  { label: 'Help Pages', href: '/admin/help' },
  { label: 'Board of Directors', href: '/admin/board-of-directors'},
  { label: 'Partners', href: '/admin/partners'},
];

export const adminSubLinks: NavLink[] = [ // For non-navbar pages.
  // Label must match a category in permissionCategories from
  // frontend\components\admin\AdminPermssionHandler.tsx
  // feel free to update Pages: list of a category or just use an existing one.
  // i,e, /admin/volunteer can fall under new category Volunteer or existing category Events
  { label: 'Volunteer', href: '/admin/volunteer/'},
]
