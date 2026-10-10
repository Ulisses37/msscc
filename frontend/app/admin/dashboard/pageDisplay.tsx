'use client'

import { getPageList } from '@/components/admin/AdminPermssionHandler';

export function AvailablePages(
  {
    CategoryTitle
  }:{
    CategoryTitle: string;
}){
  const pageList = getPageList(CategoryTitle);
  console.log(pageList);
  return(
    <div className="flex flex-col">
      {pageList && pageList.map((page) =>(
        page
      ))}
    </div>
  )
}
