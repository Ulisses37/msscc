'use client'

import { useEffect, useState } from "react";

type VisitSummary = {
  today: number;
  this_month: number;
  this_year: number;
  all_time: number;
  year: number;
  month: number;
}

export function SiteAnalytics(){
  const [analytics, setAnalytics] = useState<VisitSummary | null>();
  const monthName = analytics
    ? new Date(analytics.year, analytics.month - 1).toLocaleString('en-US', { month: 'long' })
    : '';

  useEffect(() => {
   fetchAnalytics().then(setAnalytics);
  },[])

    return(
      <div className="bg-msscc-pink text-msscc-white py-2">
        <div className="text-center font-body font-bold"> MSSCC Site Visits</div>
        <div className="grid grid-cols-2 sm:flex-1 lg:flex-none">
          <div className="rounded-sm py-2 text-center ">
            <div className="text-3xl font-body">{analytics?.today?.toLocaleString() || '00'}</div>
            <div className="text-eyebrow tracking-label text-msscc-gray-faint">Today</div>
          </div>
          <div className="rounded-sm py-2 text-center">
            <div className="text-3xl font-body">{analytics?.this_month?.toLocaleString() || '00'}</div>
            <div className="text-eyebrow tracking-label text-msscc-gray-faint">{monthName || 'This Month'}</div>
          </div>
          <div className="rounded-sm py-2 text-center ">
            <div className="text-3xl font-body">{analytics?.this_year?.toLocaleString() || '00'}</div>
            <div className="text-eyebrow tracking-label text-msscc-gray-faint">{analytics?.year ?? ''}</div>
          </div>
          <div className="rounded-sm py-2 text-center">
            <div className="text-3xl font-body">{analytics?.all_time?.toLocaleString() || '00'}</div>
            <div className="text-eyebrow tracking-label text-msscc-gray-faint">Total</div>
          </div>
        </div>
      </div>

    )
}

async function fetchAnalytics(): Promise<VisitSummary | null>{
  try{
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/visits/summary/`);
      if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    const data: VisitSummary = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to fetch site analytic summary:", err);
    return null;
  }
}
