import { useEffect } from "react";

export function useTrackVisit() {
  useEffect(() => {
    if (sessionStorage.getItem("visit_tracked")) return;
    sessionStorage.setItem("visit_tracked", "1");

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/visits/`, {
      method: "POST",
    }).catch(() => {});
  }, []);
}
