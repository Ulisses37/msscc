'use client'

import { useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/services/adminRequestHeaders";

type StorageInfo = {
  used_bytes: number;
  capacity_bytes: number;
  remaining_bytes: number;
  usage_percentage: number;
  object_count: number;
  last_synced_at: string | null;
  sync_state: "ok" | "stale";
  sync_error: string | null;
};

export function ImageStorage(){
  const [usedStorage, setUsedStorage] = useState<StorageInfo | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const usedBytes = usedStorage?.used_bytes ?? 0;
  const remainingBytes = usedStorage?.remaining_bytes ?? 0;
  const usagePercentage = usedStorage?.usage_percentage ?? 0;
  const roundedPercentage = Math.round(usagePercentage);

  useEffect(() => {
    fetchStorage()
      .then(setUsedStorage)
      .catch((error: Error) => setRequestError(error.message));
  },[])

  const formatBytes = (bytes: number) => {
      if (bytes <= 0) return "0 B";
      const units = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
  };
  return(
    <div className="flex flex-col items-center rounded-sm bg-msscc-pink py-4 sm:flex-1 lg:flex-none">
            {requestError && (
              <div className="mb-2 px-3 text-center text-xs text-white" role="alert">
                Storage usage unavailable.
              </div>
            )}
            <div className="mb-3 flex flex-row items-center justify-center gap-3">
              <ProgressBar percent={usagePercentage} />
              <div className="flex flex-col items-center">
                <div className="text-2xl text-msscc-white">
                  {usedStorage ? `${roundedPercentage}%` : "--"}
                </div>
                <div className="text-xs text-gray-200">
                  {usedStorage ? `${formatBytes(remainingBytes)} left` : "Loading…"}
                </div>
              </div>
            </div>
            <div className="text-center text-gray-200">Image Storage Usage</div>
            <div className="mt-1 text-center text-xs text-gray-200">
              {usedStorage
                ? `${formatBytes(usedBytes)} / ${formatBytes(usedStorage.capacity_bytes)}`
                : "--"}
            </div>
            {usedStorage?.sync_state === "stale" && (
              <div className="mt-1 px-3 text-center text-xs text-yellow-100" role="status">
                Usage may be out of date.
              </div>
            )}
          </div>
  )
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div
      className="flex h-16 w-6 flex-col justify-end overflow-hidden rounded-sm bg-msscc-gray-light"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="w-full bg-msscc-teal transition-all duration-500"
        style={{ height: `${clamped}%` }}
      />
    </div>
  );
}

async function fetchStorage(): Promise<StorageInfo> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/total-size/`, {
    headers: getAdminRequestHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}
