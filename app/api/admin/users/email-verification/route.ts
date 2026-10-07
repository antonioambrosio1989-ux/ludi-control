import {
  NextResponse,
} from "next/server";

import {
  adminAuth,
  adminDb,
} from "@/src/lib/firebaseAdmin";

export const runtime =
  "nodejs";

type VerifyEmailRequest = {
  uid?:
    unknown;
};

type DeleteUserRequest = {
  uid?:
    unknown;
};

/*
 * ============================================================
 * ADMIN AUTH
 * ============================================================
 */

async function requireAdmin(
  request:
    Request,
) {
  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Autenticazione richiesta.",
          },
          {
            status:
              401,
          },
        ),
    };
  }

  const token =
    authorization
      .slice(
        "Bearer ".length,
      )
      .trim();

  if (!token) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Token di autenticazione mancante.",
          },
          {
            status:
              401,
          },
        ),
    };
  }

  try {
    const decodedToken =
      await adminAuth.verifyIdToken(
        token,
      );

    const adminSnapshot =
      await adminDb
        .collection(
          "admins",
        )
        .doc(
          decodedToken.uid,
        )
        .get();

    if (
      !adminSnapshot.exists ||
      adminSnapshot.data()
        ?.active !==
        true
    ) {
      return {
        error:
          NextResponse.json(
            {
              error:
                "Accesso non autorizzato.",
            },
            {
              status:
                403,
            },
          ),
      };
    }

    return {
      uid:
        decodedToken.uid,
    };
  } catch (
    error
  ) {
    console.error(
      "[Admin Users Auth]",
      error,
    );

    return {
      error:
        NextResponse.json(
          {
            error:
              "Sessione non valida o scaduta.",
          },
          {
            status:
              401,
          },
        ),
    };
  }
}

/*
 * ============================================================
 * GET USERS
 * ============================================================
 */

export async function GET(
  request:
    Request,
) {
  const admin =
    await requireAdmin(
      request,
    );

  if (
    "error" in admin
  ) {
    return admin.error;
  }

  try {
    const users:
      Array<{
        uid:
          string;
        email:
          string;
        displayName:
          string;
        emailVerified:
          boolean;
        disabled:
          boolean;
        creationTime:
          string | null;
        lastSignInTime:
          string | null;
      }> = [];

    let pageToken:
      string | undefined;

    do {
      const result =
        await adminAuth.listUsers(
          1000,
          pageToken,
        );

      for (
        const user of
        result.users
      ) {
        users.push({
          uid:
            user.uid,

          email:
            user.email ??
            "",

          displayName:
            user.displayName ??
            "",

          emailVerified:
            user.emailVerified,

          disabled:
            user.disabled,

          creationTime:
            user.metadata
              .creationTime ??
            null,

          lastSignInTime:
            user.metadata
              .lastSignInTime ??
            null,
        });
      }

      pageToken =
        result.pageToken;
    } while (
      pageToken
    );

    users.sort(
      (
        first,
        second,
      ) =>
        (
          second.creationTime ??
          ""
        ).localeCompare(
          first.creationTime ??
          "",
        ),
    );

    return NextResponse.json({
      users,
    });
  } catch (
    error
  ) {
    console.error(
      "[Admin Users List]",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile caricare gli utenti Firebase Authentication.",
      },
      {
        status:
          500,
      },
    );
  }
}

/*
 * ============================================================
 * MANUAL EMAIL VERIFICATION
 * ============================================================
 */

export async function POST(
  request:
    Request,
) {
  const admin =
    await requireAdmin(
      request,
    );

  if (
    "error" in admin
  ) {
    return admin.error;
  }

  let body:
    VerifyEmailRequest;

  try {
    body =
      (
        await request.json()
      ) as
        VerifyEmailRequest;
  } catch {
    return NextResponse.json(
      {
        error:
          "Richiesta non valida.",
      },
      {
        status:
          400,
      },
    );
  }

  const uid =
    typeof body.uid ===
      "string"
      ? body.uid.trim()
      : "";

  if (!uid) {
    return NextResponse.json(
      {
        error:
          "UID utente non valido.",
      },
      {
        status:
          400,
      },
    );
  }

  try {
    const currentUser =
      await adminAuth.getUser(
        uid,
      );

    if (
      !currentUser.email
    ) {
      return NextResponse.json(
        {
          error:
            "L'utente non possiede un indirizzo email.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      currentUser.emailVerified
    ) {
      return NextResponse.json({
        success:
          true,

        alreadyVerified:
          true,

        user: {
          uid:
            currentUser.uid,

          email:
            currentUser.email,

          emailVerified:
            true,
        },
      });
    }

    const updatedUser =
      await adminAuth.updateUser(
        uid,
        {
          emailVerified:
            true,
        },
      );

    return NextResponse.json({
      success:
        true,

      alreadyVerified:
        false,

      user: {
        uid:
          updatedUser.uid,

        email:
          updatedUser.email ??
          "",

        emailVerified:
          updatedUser.emailVerified,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "[Admin Verify Email]",
      error,
    );

    const code =
      typeof error ===
        "object" &&
      error !==
        null &&
      "code" in error
        ? String(
            (
              error as {
                code:
                  unknown;
              }
            ).code,
          )
        : "";

    if (
      code ===
      "auth/user-not-found"
    ) {
      return NextResponse.json(
        {
          error:
            "Utente Firebase Authentication non trovato.",
        },
        {
          status:
            404,
        },
      );
    }

    return NextResponse.json(
      {
        error:
          "Impossibile verificare manualmente l'email.",
      },
      {
        status:
          500,
      },
    );
  }
}

/*
 * ============================================================
 * DELETE UNVERIFIED USER
 * ============================================================
 */

export async function DELETE(
  request:
    Request,
) {
  const admin =
    await requireAdmin(
      request,
    );

  if (
    "error" in admin
  ) {
    return admin.error;
  }

  let body:
    DeleteUserRequest;

  try {
    body =
      (
        await request.json()
      ) as
        DeleteUserRequest;
  } catch {
    return NextResponse.json(
      {
        error:
          "Richiesta non valida.",
      },
      {
        status:
          400,
      },
    );
  }

  const uid =
    typeof body.uid ===
      "string"
      ? body.uid.trim()
      : "";

  if (!uid) {
    return NextResponse.json(
      {
        error:
          "UID utente non valido.",
      },
      {
        status:
          400,
      },
    );
  }

  if (
    uid ===
    admin.uid
  ) {
    return NextResponse.json(
      {
        error:
          "Non puoi eliminare il tuo account amministratore.",
      },
      {
        status:
          409,
      },
    );
  }

  try {
    const [
      targetUser,
      targetAdminSnapshot,
    ] =
      await Promise.all([
        adminAuth.getUser(
          uid,
        ),

        adminDb
          .collection(
            "admins",
          )
          .doc(
            uid,
          )
          .get(),
      ]);

    if (
      targetUser.emailVerified
    ) {
      return NextResponse.json(
        {
          error:
            "Puoi eliminare da questa schermata soltanto gli account con email non verificata.",
        },
        {
          status:
            409,
        },
      );
    }

    if (
      targetAdminSnapshot.exists &&
      targetAdminSnapshot.data()
        ?.active ===
        true
    ) {
      return NextResponse.json(
        {
          error:
            "Non puoi eliminare un amministratore attivo.",
        },
        {
          status:
            409,
        },
      );
    }

    const deletedUser = {
      uid:
        targetUser.uid,

      email:
        targetUser.email ??
        "",
    };

    await adminAuth.deleteUser(
      uid,
    );

    await Promise.all([
      adminDb
        .collection(
          "users",
        )
        .doc(
          uid,
        )
        .delete(),

      targetAdminSnapshot.exists
        ? targetAdminSnapshot.ref.delete()
        : Promise.resolve(),
    ]);

    return NextResponse.json({
      success:
        true,

      deletedUser,
    });
  } catch (
    error
  ) {
    console.error(
      "[Admin Delete Unverified User]",
      error,
    );

    const code =
      typeof error ===
        "object" &&
      error !==
        null &&
      "code" in error
        ? String(
            (
              error as {
                code:
                  unknown;
              }
            ).code,
          )
        : "";

    if (
      code ===
      "auth/user-not-found"
    ) {
      return NextResponse.json(
        {
          error:
            "Utente Firebase Authentication non trovato.",
        },
        {
          status:
            404,
        },
      );
    }

    return NextResponse.json(
      {
        error:
          "Impossibile eliminare l'utente non verificato.",
      },
      {
        status:
          500,
      },
    );
  }
}
