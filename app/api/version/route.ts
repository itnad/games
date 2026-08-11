import { PAPEROID_BUILD_ID } from "../../app-version";

export async function GET() {
  return Response.json(
    { buildId: PAPEROID_BUILD_ID },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
