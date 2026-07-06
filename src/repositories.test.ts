import { describe, expect, it, vi } from "vitest";

import { listGitLabRepositoryMediaUrls } from "./repositories";

describe("listGitLabRepositoryMediaUrls", () => {
  it("follows GitLab tree pagination and builds encoded raw media URLs", async () => {
    const fetcher = vi.fn(async (url: string | URL) => {
      const page = new URL(url.toString()).searchParams.get("page");
      if (page === "1") {
        return new Response(
          JSON.stringify([
            { type: "blob", path: "folder/first image.jpg" },
            { type: "blob", path: "notes/readme.md" },
          ]),
          { headers: { "x-next-page": "2" } },
        );
      }
      return new Response(JSON.stringify([{ type: "blob", path: "nested/second.png" }]), {
        headers: { "x-next-page": "" },
      });
    });

    const urls = await listGitLabRepositoryMediaUrls(
      {
        projectPath: "owner/project with spaces",
        branch: "main",
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(urls).toEqual([
      "https://gitlab.com/owner/project%20with%20spaces/-/raw/main/folder/first%20image.jpg",
      "https://gitlab.com/owner/project%20with%20spaces/-/raw/main/nested/second.png",
    ]);
  });
});
