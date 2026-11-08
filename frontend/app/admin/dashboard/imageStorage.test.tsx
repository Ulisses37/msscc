/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";

import { ImageStorage } from "./imageStorage";

describe("ImageStorage", () => {
  beforeEach(() => {
    localStorage.setItem("msscc_access_token", "admin-token");
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("uses the database capacity returned by the API", async () => {
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        used_bytes: 512,
        capacity_bytes: 1024,
        remaining_bytes: 512,
        usage_percentage: 50,
        object_count: 2,
        last_synced_at: null,
        sync_state: "ok",
        sync_error: null,
      }),
    } as Response);

    render(<ImageStorage />);

    await waitFor(() => expect(screen.getByText("50%")).toBeInTheDocument());
    expect(screen.getByText("512.0 B / 1.0 KB")).toBeInTheDocument();
    expect(jest.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/api/media/total-size/"),
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
  });

  it("flags stale usage", async () => {
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        used_bytes: 100,
        capacity_bytes: 1000,
        remaining_bytes: 900,
        usage_percentage: 10,
        object_count: 1,
        last_synced_at: null,
        sync_state: "stale",
        sync_error: "bucket unavailable",
      }),
    } as Response);

    render(<ImageStorage />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Usage may be out of date.",
    );
  });

  it("shows an unavailable state when the request fails", async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response);

    render(<ImageStorage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Storage usage unavailable.",
    );
  });
});
