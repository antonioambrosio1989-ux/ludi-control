import {
  promises as fs,
} from "node:fs";

import path from "node:path";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireAdminApi,
} from "@/src/lib/requireAdminApi";

const IMAGE_EXTENSION =
  /\.(avif|gif|jpe?g|png|webp)$/i;

export const dynamic =
  "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    await requireAdminApi(
      request,
    );
  } catch (currentError) {
    const code =
      currentError instanceof Error
        ? currentError.message
        : "UNAUTHORIZED";

    return NextResponse.json(
      {
        error:
          code === "FORBIDDEN"
            ? "Accesso riservato agli Admin attivi."
            : "Autenticazione richiesta.",
      },
      {
        status:
          code === "FORBIDDEN"
            ? 403
            : 401,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const playersDirectory =
    path.join(
      process.cwd(),
      "public",
      "players",
    );

  try {
    const entries =
      await fs.readdir(
        playersDirectory,
        {
          withFileTypes:
            true,
        },
      );

    const files =
      entries
        .filter(
          (entry) =>
            entry.isFile() &&
            IMAGE_EXTENSION.test(
              entry.name,
            ),
        )
        .map(
          (entry) => ({
            fileName:
              entry.name,

            publicUrl:
              `/players/${encodeURIComponent(
                entry.name,
              )}`,

            key:
              normalizeFileKey(
                entry.name,
              ),
          }),
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.fileName.localeCompare(
              second.fileName,
              "it",
              {
                numeric:
                  true,
              },
            ),
        );

    return NextResponse.json({
      files,
    });
  } catch (
    currentError
  ) {
    const error =
      currentError as
        NodeJS.ErrnoException;

    if (
      error.code ===
      "ENOENT"
    ) {
      return NextResponse.json({
        files:
          [],
      });
    }

    console.error(
      "Errore lettura public/players:",
      currentError,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile leggere public/players.",
      },
      {
        status:
          500,
      },
    );
  }
}

function normalizeFileKey(
  fileName: string,
) {
  return fileName
    .replace(
      IMAGE_EXTENSION,
      "",
    )
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /['’`]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}
