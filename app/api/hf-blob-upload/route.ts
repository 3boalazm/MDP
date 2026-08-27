import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { MAX_INPUT_MB } from "@/lib/separation/constants";

// Authorizes direct browser -> Vercel Blob uploads for the Hugging Face Fast
// Mode path (see web/lib/separation/useHuggingFaceSeparation.ts). This app
// has no user login, so allowedContentTypes + maximumSizeInBytes are the
// whole abuse-guard layer at this step — the real processing request is
// separately authenticated by web/app/api/hf-separate/start/route.ts via a
// short-lived HMAC token before it ever reaches the Hugging Face Space.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "audio/mpeg",
          "audio/mp3",
          "audio/wav",
          "audio/x-wav",
          "audio/wave",
          "audio/mp4",
          "audio/x-m4a",
          "audio/aac",
          "audio/ogg",
          "audio/webm",
        ],
        maximumSizeInBytes: MAX_INPUT_MB * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ uploadedAt: Date.now() }),
      }),
      onUploadCompleted: async () => {
        // Fires as a webhook from Vercel once the browser finishes uploading
        // — requires a public URL, doesn't fire on localhost without a
        // tunnel. The actual "start GPU job" trigger is a separate call the
        // client makes itself right after upload() resolves (see
        // useHuggingFaceSeparation.ts), so nothing needs to happen here.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
