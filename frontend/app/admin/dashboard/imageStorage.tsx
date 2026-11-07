'use client'

import { useEffect, useState } from "react";

type StorageInfo = {
  total_size_bytes: number;
  file_count: number;
  files_with_size: number;
};

export function ImageStorage(){
  const [usedStorage, setUsedStorage] = useState<StorageInfo | null>();

  const STORAGE_CAPACITY_BYTES = 10 * 1024 ** 3; // 10 GB, change to your actual limit
  const usedBytes = usedStorage?.total_size_bytes ?? 0;
  const remainingBytes = Math.max(STORAGE_CAPACITY_BYTES - usedBytes, 0);
  const usagePercentage = Math.min((usedBytes / STORAGE_CAPACITY_BYTES) * 100, 100);
  const roundedPercentage = Math.round(usagePercentage);

  useEffect(() => {
    fetchStorage().then(setUsedStorage);
  },[])

  const formatBytes = (bytes: number) => {
      if (bytes <= 0) return "0 B";
      const units = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
  };
  return(
    <div className="flex flex-col items-center rounded-sm bg-msscc-pink py-4 sm:flex-1 lg:flex-none">
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
                ? `${formatBytes(usedBytes)} / ${formatBytes(STORAGE_CAPACITY_BYTES)}`
                : "--"}
            </div>
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

async function fetchStorage(): Promise<StorageInfo | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/total-size/`);
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    const data: StorageInfo = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to fetch storage usage:", err);
    return null;
  }
}
