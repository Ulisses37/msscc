export interface NavLink {
  label: string;
  href: string;
}

export const adminNavLinks: NavLink[] = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Events', href: '/admin/events' },
  { label: 'Members', href: '/admin/memberships' },
  { label: 'Donations', href: '/admin/donations' },
  { label: 'Directors', href: '/admin/board-of-directors'},
  { label: 'Partners', href: '/admin/partners'},
  { label: 'Edit Pages', href: '/admin/editpages' },
  { label: 'Media', href: '/admin/media-manage' },
  { label: 'Permissions', href: '/admin/permissions' },
  { label: 'Documentation', href: '/admin/documentation' },
];

export const adminSubPages: NavLink[] = [
  // Label must match a category in permissionCategories from
  // frontend\components\admin\AdminPermssionHandler.tsx
  // When adding a new sub-page, the label is the related Permission title and the href is the link
  // feel free to update Pages: list of a category or just use an existing one.
  { label: 'Events', href: '/admin/volunteer/'},
]
