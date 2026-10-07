import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import {
  createDefaultLudiStudioElements,
  getLudiStudioCanvasSize,
  type LudiStudioGeneratedAsset,
  type LudiStudioTemplateDefinition,
  type LudiStudioTemplateType,
} from "@/src/types/LudiStudio";

const TEMPLATE_COLLECTION = "ludiStudioTemplates";
const ASSET_COLLECTION = "ludiStudioGeneratedAssets";

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function buildLudiStudioTemplateId(
  competitionId: string,
  templateType: LudiStudioTemplateType,
) {
  return `${safeId(competitionId)}__${templateType}`;
}

export function buildLudiStudioAssetId({
  competitionId,
  seasonId,
  templateType,
  sourceKey,
}: {
  competitionId: string;
  seasonId: string;
  templateType: LudiStudioTemplateType;
  sourceKey: string;
}) {
  return [
    safeId(competitionId),
    safeId(seasonId),
    templateType,
    safeId(sourceKey),
  ].join("__");
}

export const DEFAULT_STUDIO_TEMPLATE_STYLE = {
  background: "#07162f",
  foreground: "#ffffff",
  accent: "#d9ff43",
  surface: "#eef1f4",
} as const;

export const FirebaseLudiStudioRepository = {
  async getTemplate(
    competitionId: string,
    templateType: LudiStudioTemplateType,
  ): Promise<LudiStudioTemplateDefinition | null> {
    const id = buildLudiStudioTemplateId(
      competitionId,
      templateType,
    );

    const snapshot = await getDoc(
      doc(db, TEMPLATE_COLLECTION, id),
    );

    if (!snapshot.exists()) return null;

    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<LudiStudioTemplateDefinition, "id">),
    };
  },

  async ensureTemplate(
    competitionId: string,
    templateType: LudiStudioTemplateType,
  ): Promise<LudiStudioTemplateDefinition> {
    const existing = await this.getTemplate(
      competitionId,
      templateType,
    );

    const canvas = getLudiStudioCanvasSize(templateType);

    if (existing) {
      const hasElements =
        Array.isArray(
          existing.elements,
        );

      const normalized = {
        ...existing,
        ...canvas,
        elements:
          hasElements
            ? existing.elements
            : createDefaultLudiStudioElements(
                templateType,
              ),
      };

      if (
        existing.width !==
          canvas.width ||
        existing.height !==
          canvas.height ||
        !hasElements
      ) {
        await setDoc(
          doc(
            db,
            TEMPLATE_COLLECTION,
            existing.id,
          ),
          {
            width:
              canvas.width,
            height:
              canvas.height,
            ...(
              !hasElements
                ? {
                    elements:
                      normalized.elements,
                  }
                : {}
            ),
            updatedAt:
              serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      }

      return normalized;
    }

    const id = buildLudiStudioTemplateId(
      competitionId,
      templateType,
    );

    const value: LudiStudioTemplateDefinition = {
      id,
      competitionId,
      templateType,
      ...canvas,
      ...DEFAULT_STUDIO_TEMPLATE_STYLE,
      elements:
        createDefaultLudiStudioElements(
          templateType,
        ),
    };

    await setDoc(
      doc(db, TEMPLATE_COLLECTION, id),
      {
        ...value,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return value;
  },

  async saveTemplate(
    template: LudiStudioTemplateDefinition,
  ): Promise<void> {
    await setDoc(
      doc(
        db,
        TEMPLATE_COLLECTION,
        template.id,
      ),
      {
        ...template,
        updatedAt:
          serverTimestamp(),
      },
      {
        merge:
          true,
      },
    );
  },

  async saveGeneratedAsset(
    input: Omit<
      LudiStudioGeneratedAsset,
      "id" | "createdAt" | "updatedAt"
    >,
  ): Promise<string> {
    const id = buildLudiStudioAssetId(input);

    await setDoc(
      doc(db, ASSET_COLLECTION, id),
      {
        ...input,
        id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return id;
  },

  async getGeneratedAsset({
    competitionId,
    seasonId,
    templateType,
    sourceKey,
  }: {
    competitionId: string;
    seasonId: string;
    templateType: LudiStudioTemplateType;
    sourceKey: string;
  }): Promise<LudiStudioGeneratedAsset | null> {
    const id = buildLudiStudioAssetId({
      competitionId,
      seasonId,
      templateType,
      sourceKey,
    });

    const snapshot = await getDoc(
      doc(db, ASSET_COLLECTION, id),
    );

    if (!snapshot.exists()) return null;

    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<LudiStudioGeneratedAsset, "id">),
    };
  },
};
