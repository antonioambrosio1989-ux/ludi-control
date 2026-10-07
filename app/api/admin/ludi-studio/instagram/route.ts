import {
  NextResponse,
} from "next/server";

import {
  adminAuth,
  adminDb,
} from "@/src/lib/firebaseAdmin";

export const runtime = "nodejs";

type PublishRequest = {
  imageUrl?: unknown;
  caption?: unknown;
};

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "Autenticazione richiesta." },
        { status: 401 },
      ),
    };
  }

  const token = authorization.slice("Bearer ".length).trim();

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const adminSnapshot = await adminDb
      .collection("admins")
      .doc(decoded.uid)
      .get();

    if (!adminSnapshot.exists || adminSnapshot.data()?.active !== true) {
      return {
        error: NextResponse.json(
          { error: "Accesso non autorizzato." },
          { status: 403 },
        ),
      };
    }

    return { uid: decoded.uid };
  } catch (error) {
    console.error("[Ludi Studio Instagram Auth]", error);
    return {
      error: NextResponse.json(
        { error: "Sessione non valida o scaduta." },
        { status: 401 },
      ),
    };
  }
}

function graphUrl(path: string) {
  const version =
    process.env.INSTAGRAM_GRAPH_API_VERSION?.trim()
    || process.env.META_GRAPH_API_VERSION?.trim()
    || "v24.0";

  return `https://graph.instagram.com/${version}/${path.replace(/^\/+/, "")}`;
}

async function metaRequest(
  url: string,
  accessToken: string,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const nestedError =
      data.error && typeof data.error === "object"
        ? data.error as Record<string, unknown>
        : null;

    const message =
      typeof nestedError?.message === "string"
        ? nestedError.message
        : "Errore Instagram Graph API.";

    throw new Error(message);
  }

  return data;
}

async function waitForContainer(
  creationId: string,
  accessToken: string,
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const status = await metaRequest(
      `${graphUrl(creationId)}?fields=status_code`,
      accessToken,
    );

    const statusCode = String(status.status_code ?? "");

    if (statusCode === "FINISHED") return;

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(`Preparazione contenuto Instagram non riuscita (${statusCode}).`);
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(
    "Instagram sta ancora preparando l'immagine. Riprova tra qualche secondo.",
  );
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;

  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();

  if (!accountId || !accessToken) {
    return NextResponse.json(
      {
        error:
          "Instagram non configurato. Imposta INSTAGRAM_BUSINESS_ACCOUNT_ID e INSTAGRAM_ACCESS_TOKEN sul server.",
      },
      { status: 503 },
    );
  }

  let body: PublishRequest;

  try {
    body = await request.json() as PublishRequest;
  } catch {
    return NextResponse.json(
      { error: "Richiesta non valida." },
      { status: 400 },
    );
  }

  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";

  if (!/^https:\/\//i.test(imageUrl)) {
    return NextResponse.json(
      { error: "L'immagine deve avere un URL HTTPS pubblico." },
      { status: 400 },
    );
  }

  try {
    const createParams = new URLSearchParams({
      image_url: imageUrl,
    });

    if (caption) createParams.set("caption", caption);

    const created = await metaRequest(
      graphUrl(`${accountId}/media`),
      accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: createParams.toString(),
      },
    );

    const creationId = typeof created.id === "string" ? created.id : "";

    if (!creationId) {
      throw new Error("Instagram non ha restituito l'ID del contenuto.");
    }

    await waitForContainer(creationId, accessToken);

    const publishParams = new URLSearchParams({
      creation_id: creationId,
    });

    const published = await metaRequest(
      graphUrl(`${accountId}/media_publish`),
      accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: publishParams.toString(),
      },
    );

    return NextResponse.json({
      ok: true,
      postId: typeof published.id === "string" ? published.id : undefined,
    });
  } catch (error) {
    console.error("[Ludi Studio Instagram Publish]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pubblicazione Instagram non riuscita.",
      },
      { status: 502 },
    );
  }
}
