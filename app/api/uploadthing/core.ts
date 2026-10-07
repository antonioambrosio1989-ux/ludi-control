import {
  createUploadthing,
  type FileRouter,
} from "uploadthing/next";

import {
  requireUploadThingAdmin,
} from "@/src/lib/requireUploadThingAdmin";

import {
  enqueueUploadedFileForCleanup,
} from "@/src/lib/uploadThingCleanupQueue";

const uploadThing =
  createUploadthing();

type CompletedUploadFile = {
  url: string;
  key: string;
};

async function trackCompletedUpload({
  file,
  source,
  uploadedBy,
}: {
  file: CompletedUploadFile;
  source: string;
  uploadedBy?: string;
}) {
  /*
   * Il cleanup è best-effort:
   * un problema nella coda non deve trasformare
   * un upload già riuscito in un errore per l'Admin.
   */
  try {
    await enqueueUploadedFileForCleanup({
      key:
        file.key,
      url:
        file.url,
      source,
      uploadedBy,
    });
  } catch (error) {
    console.error(
      "Impossibile accodare il file UploadThing per il cleanup:",
      {
        source,
        key:
          file.key,
        error,
      },
    );
  }

  return {
    url:
      file.url,
    key:
      file.key,
  };
}

/*
 * ============================================================
 * UPLOADTHING FILE ROUTER
 * ============================================================
 *
 * Tutti gli uploader presenti in questo file sono riservati
 * all'area Admin.
 *
 * Ogni middleware verifica realmente il Firebase ID token
 * attraverso requireUploadThingAdmin().
 * ============================================================
 */

export const ourFileRouter = {
  /*
   * ==========================================================
   * LOGO SQUADRA
   * ==========================================================
   */

  teamLogoUploader:
    uploadThing({
      image: {
        maxFileSize:
          "16MB",

        maxFileCount:
          1,
      },
    })
      .middleware(
        async ({
          req,
        }) => {
          const admin =
            await requireUploadThingAdmin(
              req,
            );

          return {
            uploadedBy:
              admin.uid,

            category:
              "team-logo",
          };
        },
      )
      .onUploadComplete(
        async ({
          file,
          metadata,
        }) => {
          console.log(
            "Logo squadra caricato:",
            file.url,
            metadata.uploadedBy,
          );

          return trackCompletedUpload({
            file,
            source:
              "team-logo",
            uploadedBy:
              metadata.uploadedBy,
          });
        },
      ),

  /*
   * ==========================================================
   * FOTO SQUADRA
   * ==========================================================
   */

  teamPhotoUploader:
    uploadThing({
      image: {
        maxFileSize:
          "16MB",

        maxFileCount:
          1,
      },
    })
      .middleware(
        async ({
          req,
        }) => {
          const admin =
            await requireUploadThingAdmin(
              req,
            );

          return {
            uploadedBy:
              admin.uid,

            category:
              "team-photo",
          };
        },
      )
      .onUploadComplete(
        async ({
          file,
          metadata,
        }) => {
          console.log(
            "Foto squadra caricata:",
            file.url,
            metadata.uploadedBy,
          );

          return trackCompletedUpload({
            file,
            source:
              "team-photo",
            uploadedBy:
              metadata.uploadedBy,
          });
        },
      ),

  /*
   * ==========================================================
   * FOTO GIOCATORE
   * ==========================================================
   */

  playerPhotoUploader:
    uploadThing({
      image: {
        maxFileSize:
          "16MB",

        maxFileCount:
          1,
      },
    })
      .middleware(
        async ({
          req,
        }) => {
          const admin =
            await requireUploadThingAdmin(
              req,
            );

          return {
            uploadedBy:
              admin.uid,

            category:
              "player-photo",
          };
        },
      )
      .onUploadComplete(
        async ({
          file,
          metadata,
        }) => {
          console.log(
            "Foto giocatore caricata:",
            file.url,
            metadata.uploadedBy,
          );

          return trackCompletedUpload({
            file,
            source:
              "player-photo",
            uploadedBy:
              metadata.uploadedBy,
          });
        },
      ),

  /*
   * ==========================================================
   * HALL OF FAME IMAGE
   * ==========================================================
   */

  hallOfFameImageUploader:
    uploadThing({
      image: {
        maxFileSize:
          "16MB",

        maxFileCount:
          1,
      },
    })
      .middleware(
        async ({
          req,
        }) => {
          const admin =
            await requireUploadThingAdmin(
              req,
            );

          return {
            uploadedBy:
              admin.uid,

            category:
              "hall-of-fame",
          };
        },
      )
      .onUploadComplete(
        async ({
          file,
          metadata,
        }) => {
          return trackCompletedUpload({
            file,
            source:
              "hall-of-fame",
            uploadedBy:
              metadata.uploadedBy,
          });
        },
      ),
      
      /*
   * ==========================================================
   * HALL OF FAME VIDEO
   * ==========================================================
   */

 hallOfFameVideoUploader:
  uploadThing({
    video: {
      maxFileSize:
        "128MB",

      maxFileCount:
        1,
    },
  })
    .middleware(
      async ({
        req,
      }) => {
        const admin =
          await requireUploadThingAdmin(
            req,
          );

        return {
          uploadedBy:
            admin.uid,

          category:
            "hall-of-fame-video",
        };
      },
    )
    .onUploadComplete(
      async ({
        file,
        metadata,
      }) => {
        return trackCompletedUpload({
          file,
          source:
            "hall-of-fame-video",
          uploadedBy:
            metadata.uploadedBy,
        });
      },
    ),

  /*
   * ==========================================================
   * COVER VIDEO / GOAL PARADE
   * ==========================================================
   */

  VideoCoverUploader:
    uploadThing({
      image: {
        maxFileSize:
          "16MB",

        maxFileCount:
          1,
      },
    })
      .middleware(
        async ({
          req,
        }) => {
          const admin =
            await requireUploadThingAdmin(
              req,
            );

          return {
            uploadedBy:
              admin.uid,

            category:
              "goal-parade-cover",
          };
        },
      )
      .onUploadComplete(
        async ({
          file,
          metadata,
        }) => {
          return trackCompletedUpload({
            file,
            source:
              "goal-parade-cover",
            uploadedBy:
              metadata.uploadedBy,
          });
        },
      ),

  /*
   * ==========================================================
   * BEST OF THE MONTH
   * ==========================================================
   */

  bestOfTheMonthImageUploader:
    uploadThing({
      image: {
        maxFileSize:
          "16MB",

        maxFileCount:
          1,
      },
    })
      .middleware(
        async ({
          req,
        }) => {
          const admin =
            await requireUploadThingAdmin(
              req,
            );

          return {
            uploadedBy:
              admin.uid,

            category:
              "best-of-the-month",
          };
        },
      )
      .onUploadComplete(
        async ({
          file,
          metadata,
        }) => {
          return trackCompletedUpload({
            file,
            source:
              "best-of-the-month",
            uploadedBy:
              metadata.uploadedBy,
          });
        },
      ),

  ludiWeekImageUploader:
    uploadThing({
      image: { maxFileSize: "16MB", maxFileCount: 1 },
    })
      .middleware(async ({ req }) => {
        const admin = await requireUploadThingAdmin(req);
        return { uploadedBy: admin.uid, category: "ludi-week" };
      })
      .onUploadComplete(async ({ file, metadata }) =>
        trackCompletedUpload({ file, source: "ludi-week", uploadedBy: metadata.uploadedBy }),
      ),

  newsImageUploader: uploadThing({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const admin = await requireUploadThingAdmin(req);
      return { uploadedBy: admin.uid };
    })
    .onUploadComplete(async ({ file, metadata }) => trackCompletedUpload({ file, source: "news", uploadedBy: metadata.uploadedBy })),
    } satisfies FileRouter;

export type OurFileRouter =
  typeof ourFileRouter;