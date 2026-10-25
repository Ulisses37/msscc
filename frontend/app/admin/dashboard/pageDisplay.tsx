'use client'

import Link from 'next/link';

import { getPageList } from '@/components/admin/AdminPermssionHandler';
import { adminNavLinks } from '@/config/adminNavLinks';

const pageDescriptions: Record<string, string>={
  Events: "Manage MSSCC events.",
  Volunteers: "Manage event volunteers.",
  Members: "Manage membership data records.",
  Donations: "Manage donation data records.",
  Partners: "Manage MSSCC partner data records.",
  'Edit Pages': "Manage public page text, translation, and images.",
  'Board of Directors': "Manage board member list.",
  'Permissions Pages': "Manage the information and permissions of MSSCC Admins.",
  Media: "Manage media images across the website",
}

export function AvailablePages(
  {
    CategoryTitle
  }:{
    CategoryTitle: string;
}){
  const pageList = getPageList(CategoryTitle);
  return(
    <div className="flex flex-col pl-1">
      {pageList && pageList.map((page) =>(
        <PageCard key={page} PageTitle={page}/>
      ))}
    </div>
  )
}

function PageCard(
  {
    PageTitle,
  } : {
    PageTitle: string;
  }
){
  const link = adminNavLinks.find((l) => l.label === PageTitle);
  const description = pageDescriptions[PageTitle];

  return(
    <div className="my-1">
      {link ? (
        <Link
          href={link.href}
          className="font-heading text-heading-2 text-msscc-teal underline transition-colors hover:text-msscc-pink"
        >
          {PageTitle}
        </Link>
      ) : (
        <div className="font-heading text-heading-2 text-msscc-teal-light">{PageTitle}</div>
      )}
      <div className="pl-4 text-body-sm text-msscc-gray-mid">
        {description}
      </div>
    </div>
  )
}
