"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { createPortal } from "react-dom";

/*
 * ============================================================
 * ASPECT RATIO
 * ============================================================
 */

export type ImageEditorAspectRatio =
  | "1:1"
  | "4:5"
  | "3:2"
  | "16:9"
  | "9:16";

/*
 * ============================================================
 * PROPS
 * ============================================================
 */

type Props = {
  file: File;

  title?: string;

  label?: string;

  defaultAspectRatio?:
    ImageEditorAspectRatio;

  allowedAspectRatios?:
    ImageEditorAspectRatio[];

  /*
   * Larghezza del file finale.
   *
   * L'altezza viene calcolata
   * automaticamente.
   */

  outputWidth?: number;

  /*
   * Mostra il pulsante
   * "Rimuovi sfondo".
   */

  onCancel:
    () => void;

  onConfirm:
    (
      file: File,
    ) =>
      void |
      Promise<void>;
};

/*
 * ============================================================
 * IMAGE SIZE
 * ============================================================
 */

type ImageSize = {
  width:
    number;

  height:
    number;
};

/*
 * ============================================================
 * POSITION
 * ============================================================
 */

type Position = {
  x:
    number;

  y:
    number;
};


type PreviewSize = {
  width:
    number;

  height:
    number;
};

/*
 * ============================================================
 * ASPECT RATIOS
 * ============================================================
 */

const ASPECT_RATIOS:
  Record<
    ImageEditorAspectRatio,
    number
  > = {
  "1:1":
    1,

  "4:5":
    4 / 5,

  "3:2":
    3 / 2,

  "16:9":
    16 / 9,

  "9:16":
    9 / 16,
};

/*
 * ============================================================
 * DEFAULT ASPECT RATIOS
 * ============================================================
 */

const DEFAULT_ASPECT_RATIOS:
  ImageEditorAspectRatio[] = [
    "1:1",
    "4:5",
    "3:2",
    "16:9",
    "9:16",
  ];

/*
 * ============================================================
 * IMAGE EDITOR
 * ============================================================
 */

export default function ImageEditor({
  file,

  title =
    "Modifica immagine",

  label =
    "Editor foto",

  defaultAspectRatio =
    "4:5",

  allowedAspectRatios =
    DEFAULT_ASPECT_RATIOS,

  outputWidth =
    1080,

  onCancel,

  onConfirm,
}: Props) {
  /*
   * ==========================================================
   * REFS
   * ==========================================================
   */

  const imageRef =
    useRef<
      HTMLImageElement |
      null
    >(
      null,
    );

  const previewRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null,
    );

  const dragStartRef =
    useRef<{
      pointerX:
        number;

      pointerY:
        number;

      imageX:
        number;

      imageY:
        number;
    } | null>(
      null,
    );

  /*
   * ==========================================================
   * ASPECT RATIO
   * ==========================================================
   */

  const [
    aspectRatio,
    setAspectRatio,
  ] =
    useState<
      ImageEditorAspectRatio
    >(
      defaultAspectRatio,
    );

  /*
   * ==========================================================
   * ZOOM
   * ==========================================================
   */

  const [
    zoom,
    setZoom,
  ] =
    useState(
      1,
    );

  /*
   * ==========================================================
   * POSITION
   * ==========================================================
   */

  const [
    position,
    setPosition,
  ] =
    useState<Position>({
      x:
        0,

      y:
        0,
    });

  /*
   * ==========================================================
   * IMAGE SIZE
   * ==========================================================
   */

  const [
    imageSize,
    setImageSize,
  ] =
    useState<ImageSize>({
      width:
        0,

      height:
        0,
    });


  const [
    previewSize,
    setPreviewSize,
  ] =
    useState<PreviewSize>({
      width:
        0,

      height:
        0,
    });

  /*
   * ==========================================================
   * DRAGGING
   * ==========================================================
   */

  const [
    isDragging,
    setIsDragging,
  ] =
    useState(
      false,
    );

  /*
   * ==========================================================
   * SAVING
   * ==========================================================
   */

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false,
    );

  /*
   * ==========================================================
   * ERROR
   * ==========================================================
   */

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  /*
   * ==========================================================
   * CURRENT FILE
   * ==========================================================
   *
   * Il file ricevuto dal componente padre è già il file
   * corrente dell'editor. Evitiamo di duplicarlo in uno state
   * così, se cambia la prop, anche la preview viene aggiornata.
   * ==========================================================
   */

  const currentFile =
    file;

  /*
   * ==========================================================
   * BLOCCO SCROLL PAGINA SOTTOSTANTE
   * ==========================================================
   */

  useEffect(() => {
    const html =
      document.documentElement;

    const body =
      document.body;

    const scrollY =
      window.scrollY;

    const previousHtmlOverflow =
      html.style.overflow;

    const previousBodyOverflow =
      body.style.overflow;

    const previousBodyPosition =
      body.style.position;

    const previousBodyTop =
      body.style.top;

    const previousBodyWidth =
      body.style.width;

    html.style.overflow =
      "hidden";

    body.style.overflow =
      "hidden";

    body.style.position =
      "fixed";

    body.style.top =
      `-${scrollY}px`;

    body.style.width =
      "100%";

    return () => {
      html.style.overflow =
        previousHtmlOverflow;

      body.style.overflow =
        previousBodyOverflow;

      body.style.position =
        previousBodyPosition;

      body.style.top =
        previousBodyTop;

      body.style.width =
        previousBodyWidth;

      window.scrollTo(
        0,
        scrollY,
      );
    };
  }, []);

  /*
   * ==========================================================
   * PREVIEW IMMAGINE
   * ==========================================================
   *
   * In precedenza la preview veniva generata con
   * URL.createObjectURL() dentro useMemo e poi revocata nel
   * cleanup di un effect. In sviluppo React Strict Mode può
   * eseguire cleanup + setup aggiuntivi e lasciare l'elemento
   * <img> con un blob URL già revocato.
   *
   * Usiamo quindi FileReader e un Data URL: la preview resta
   * valida per tutta la vita del componente e non richiede
   * URL.revokeObjectURL().
   * ==========================================================
   */

  const [
    imagePreview,
    setImagePreview,
  ] =
    useState<{
      file:
        File;

      url:
        string;
    } | null>(
      null,
    );

  /*
   * La preview è considerata valida soltanto se appartiene
   * al File attualmente ricevuto dal componente.
   *
   * In questo modo non dobbiamo azzerare lo state
   * sincronamente dentro l'effect quando cambia il file.
   */
  const imageUrl =
    imagePreview?.file ===
    currentFile
      ? imagePreview.url
      : "";

  useEffect(() => {
    let cancelled =
      false;

    const reader =
      new FileReader();

    reader.onload =
      () => {
        if (
          cancelled
        ) {
          return;
        }

        if (
          typeof reader.result !==
          "string"
        ) {
          setError(
            "Impossibile leggere l'immagine selezionata.",
          );

          return;
        }

        setImagePreview({
          file:
            currentFile,

          url:
            reader.result,
        });
      };

    reader.onerror =
      () => {
        if (
          cancelled
        ) {
          return;
        }

        setError(
          "Impossibile leggere l'immagine selezionata.",
        );
      };

    reader.readAsDataURL(
      currentFile,
    );

    return () => {
      cancelled =
        true;

      if (
        reader.readyState ===
        FileReader.LOADING
      ) {
        reader.abort();
      }
    };
  }, [
    currentFile,
  ]);

  /*
   * ==========================================================
   * CARICAMENTO IMMAGINE
   * ==========================================================
   */

  function handleImageLoad() {
    const image =
      imageRef.current;

    if (
      !image
    ) {
      return;
    }

    setImageSize({
      width:
        image.naturalWidth,

      height:
        image.naturalHeight,
    });

    setError(
      null,
    );
  }


  const measurePreview =
    useCallback(
      (): PreviewSize => {
        const preview =
          previewRef.current;

        if (!preview) {
          return {
            width: 0,
            height: 0,
          };
        }

        return {
          width:
            preview.clientWidth,

          height:
            preview.clientHeight,
        };
      },
      [],
    );

  const getCoverSize =
    useCallback(
      function getCoverSize({
    containerWidth,
    containerHeight,
    currentZoom = zoom,
  }: {
    containerWidth: number;
    containerHeight: number;
    currentZoom?: number;
  }): ImageSize {
    if (
      imageSize.width <= 0 ||
      imageSize.height <= 0 ||
      containerWidth <= 0 ||
      containerHeight <= 0
    ) {
      return {
        width: containerWidth,
        height: containerHeight,
      };
    }

    const baseScale =
      Math.max(
        containerWidth /
          imageSize.width,

        containerHeight /
          imageSize.height,
      );

    return {
      width:
        imageSize.width *
        baseScale *
        currentZoom,

      height:
        imageSize.height *
        baseScale *
        currentZoom,
    };
      },
      [
        imageSize.width,
        imageSize.height,
        zoom,
      ],
    );

  const clampPosition =
    useCallback(
      function clampPosition(
    nextPosition: Position,
    currentZoom = zoom,
  ): Position {
    const measured =
      measurePreview();

    const containerWidth =
      measured.width ||
      previewSize.width;

    const containerHeight =
      measured.height ||
      previewSize.height;

    if (
      containerWidth <= 0 ||
      containerHeight <= 0
    ) {
      return nextPosition;
    }

    const cover =
      getCoverSize({
        containerWidth,
        containerHeight,
        currentZoom,
      });

    const maxX =
      Math.max(
        0,
        (cover.width -
          containerWidth) /
          2,
      );

    const maxY =
      Math.max(
        0,
        (cover.height -
          containerHeight) /
          2,
      );

    return {
      x:
        Math.max(
          -maxX,
          Math.min(
            maxX,
            nextPosition.x,
          ),
        ),

      y:
        Math.max(
          -maxY,
          Math.min(
            maxY,
            nextPosition.y,
          ),
        ),
    };
      },
      [
        measurePreview,
        previewSize.width,
        previewSize.height,
        getCoverSize,
        zoom,
      ],
    );

  useEffect(() => {
    const preview =
      previewRef.current;

    if (!preview) {
      return;
    }

    const updatePreviewSize = () => {
      const measured =
        measurePreview();

      setPreviewSize(
        measured,
      );

      setPosition(
        (current) =>
          clampPosition(
            current,
            zoom,
          ),
      );
    };

    updatePreviewSize();

    const observer =
      new ResizeObserver(
        updatePreviewSize,
      );

    observer.observe(
      preview,
    );

    return () => {
      observer.disconnect();
    };
  }, [
    aspectRatio,
    imageSize.width,
    imageSize.height,
    zoom,
    clampPosition,
    measurePreview,
  ]);

  /*
   * ==========================================================
   * DRAG - START
   * ==========================================================
   */

  function handlePointerDown(
    event:
      ReactPointerEvent<
        HTMLDivElement
      >,
  ) {
    event.currentTarget
      .setPointerCapture(
        event.pointerId,
      );

    dragStartRef.current = {
      pointerX:
        event.clientX,

      pointerY:
        event.clientY,

      imageX:
        position.x,

      imageY:
        position.y,
    };

    setIsDragging(
      true,
    );
  }

  /*
   * ==========================================================
   * DRAG - MOVE
   * ==========================================================
   */

  function handlePointerMove(
    event:
      ReactPointerEvent<
        HTMLDivElement
      >,
  ) {
    const dragStart =
      dragStartRef.current;

    if (
      !dragStart
    ) {
      return;
    }

    const deltaX =
      event.clientX -
      dragStart.pointerX;

    const deltaY =
      event.clientY -
      dragStart.pointerY;

    setPosition(
      clampPosition({
        x:
          dragStart.imageX +
          deltaX,

        y:
          dragStart.imageY +
          deltaY,
      }),
    );
  }

  /*
   * ==========================================================
   * DRAG - END
   * ==========================================================
   */

  function handlePointerEnd() {
    dragStartRef.current =
      null;

    setIsDragging(
      false,
    );
  }

  /*
   * ==========================================================
   * RESET
   * ==========================================================
   */

  function resetEditor() {
    setZoom(
      1,
    );

    setPosition({
      x:
        0,

      y:
        0,
    });
  }

  /*
   * ==========================================================
   * CONFERMA
   * ==========================================================
   */

  async function handleConfirm() {
    const image =
      imageRef.current;

    if (
      !image ||
      imageSize.width ===
        0 ||
      imageSize.height ===
        0
    ) {
      setError(
        "Immagine non ancora pronta.",
      );

      return;
    }

    setIsSaving(
      true,
    );

    setError(
      null,
    );

    try {
      const editedFile =
        await exportEditedImage({
          image,

          fileName:
            currentFile.name,

          aspectRatio,

          zoom,

          position,

          previewWidth:
            previewSize.width ||
            360,

          outputWidth,
        });

      await onConfirm(
        editedFile,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore elaborazione immagine:",
        currentError,
      );

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile elaborare l'immagine.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * RATIO NUMERICO
   * ==========================================================
   */

  const numericRatio =
    ASPECT_RATIOS[
      aspectRatio
    ];


  function updateZoom(
    nextZoom: number,
  ) {
    const normalizedZoom =
      Math.max(
        1,
        Math.min(
          5,
          Number(
            nextZoom.toFixed(
              2,
            ),
          ),
        ),
      );

    setZoom(
      normalizedZoom,
    );

    setPosition(
      (current) =>
        clampPosition(
          current,
          normalizedZoom,
        ),
    );
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] flex h-[100dvh] w-screen flex-col overflow-hidden bg-white text-[#06142E]"
      onWheel={(
        event,
      ) => {
        event.stopPropagation();
      }}
    >
      {/* ======================================================
          HEADER FISSO
          ====================================================== */}

      <div className="shrink-0 border-b border-[#06142E]/10 bg-white px-5 pb-4 pt-[max(16px,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-xl items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">
              {
                label
              }
            </p>

            <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
              {
                title
              }
            </h2>
          </div>

          <button
            type="button"
            disabled={
              isSaving
            }
            onClick={
              onCancel
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06142E]/5 text-lg font-black text-[#06142E]"
          >
            ×
          </button>
        </div>
      </div>

      {/* ======================================================
          CONTENUTO SCROLLABILE
          ====================================================== */}

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{
          WebkitOverflowScrolling:
            "touch",
          overscrollBehavior:
            "contain",
        }}
      >
        <div className="mx-auto w-full max-w-xl px-5 pb-8 pt-5">
          {/* ====================================================
              PREVIEW
              ==================================================== */}

          <div className="flex justify-center">
            <div
              ref={
                previewRef
              }
              onPointerDown={
                handlePointerDown
              }
              onPointerMove={
                handlePointerMove
              }
              onPointerUp={
                handlePointerEnd
              }
              onPointerCancel={
                handlePointerEnd
              }
              className={`relative w-full max-w-[360px] touch-none overflow-hidden rounded-[18px] bg-[#E9EDF2] shadow-inner ${
                isDragging
                  ? "cursor-grabbing"
                  : "cursor-grab"
              }`}
              style={{
                aspectRatio:
                  String(
                    numericRatio,
                  ),
              }}
            >
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={
                    imageRef
                  }
                  src={
                    imageUrl
                  }
                  alt="Anteprima immagine"
                  draggable={
                    false
                  }
                  onLoad={
                    handleImageLoad
                  }
                  onError={() => {
                    setError(
                      "Impossibile visualizzare l'anteprima dell'immagine",
                    );
                  }}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={(() => {
                    const measuredWidth =
                      previewSize.width || 360;

                    const measuredHeight =
                      previewSize.height ||
                      measuredWidth / numericRatio;

                    const coverSize =
                      getCoverSize({
                        containerWidth:
                          measuredWidth,
                        containerHeight:
                          measuredHeight,
                        currentZoom: zoom,
                      });

                    return {
                      width: `${coverSize.width}px`,
                      height: `${coverSize.height}px`,
                      maxWidth: "none",
                      maxHeight: "none",
                      transform:
                        `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
                    };
                  })()}
                />
              )}

              <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />
              <div className="pointer-events-none absolute left-1/3 top-0 h-full w-px bg-white/40" />
              <div className="pointer-events-none absolute left-2/3 top-0 h-full w-px bg-white/40" />
              <div className="pointer-events-none absolute left-0 top-1/3 h-px w-full bg-white/40" />
              <div className="pointer-events-none absolute left-0 top-2/3 h-px w-full bg-white/40" />
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] font-bold text-[#06142E]/40">
            Trascina l&apos;immagine per
            riposizionarla
          </p>

          {/* ====================================================
              FORMATO
              ==================================================== */}

          <div className="mt-6">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/45">
              Formato
            </p>

            <div
              className="mt-2 grid gap-2"
              style={{
                gridTemplateColumns:
                  `repeat(${allowedAspectRatios.length}, minmax(0, 1fr))`,
              }}
            >
              {allowedAspectRatios.map(
                (
                  ratio,
                ) => (
                  <button
                    key={
                      ratio
                    }
                    type="button"
                    onClick={() => {
                      setAspectRatio(
                        ratio,
                      );

                      resetEditor();
                    }}
                    className={`h-11 rounded-[12px] text-xs font-black ${
                      aspectRatio ===
                      ratio
                        ? "bg-[#06142E] text-white"
                        : "bg-[#06142E]/5 text-[#06142E]"
                    }`}
                  >
                    {
                      ratio
                    }
                  </button>
                ),
              )}
            </div>
          </div>

          {/* ====================================================
              ZOOM
              ==================================================== */}

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/45">
                Zoom
              </p>

              <p className="text-xs font-black text-[#06142E]">
                {Math.round(
                  zoom *
                  100,
                )}
                %
              </p>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  updateZoom(
                    zoom - 0.1,
                  );
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06142E]/5 text-xl font-black text-[#06142E]"
              >
                −
              </button>

              <input
                type="range"
                min="1"
                max="5"
                step="0.05"
                value={
                  zoom
                }
                onChange={(
                  event,
                ) => {
                  updateZoom(
                    Number(
                      event
                        .target
                        .value,
                    ),
                  );
                }}
                className="w-full accent-[#06142E]"
              />

              <button
                type="button"
                onClick={() => {
                  updateZoom(
                    zoom + 0.1,
                  );
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06142E]/5 text-xl font-black text-[#06142E]"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={
              resetEditor
            }
            className="mt-6 h-12 w-full rounded-[13px] border border-[#06142E]/20 text-xs font-black uppercase text-[#06142E]"
          >
            Ripristina
          </button>

          {error && (
            <div className="mt-4 rounded-[13px] border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-bold text-red-700">
                {
                  error
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          AZIONI FISSE
          ====================================================== */}

      <div
        className="shrink-0 border-t border-[#06142E]/10 bg-white px-5 pt-3 shadow-[0_-8px_20px_rgba(6,20,46,0.08)]"
        style={{
          paddingBottom:
            "max(16px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-3">
          <button
            type="button"
            disabled={
              isSaving
            }
            onClick={
              onCancel
            }
            className="h-12 rounded-[13px] border border-[#06142E] text-xs font-black uppercase text-[#06142E]"
          >
            Annulla
          </button>

          <button
            type="button"
            disabled={
              isSaving
            }
            onClick={() => {
              void handleConfirm();
            }}
            className="h-12 rounded-[13px] bg-[#06142E] text-xs font-black uppercase text-white disabled:opacity-40"
          >
            {isSaving
              ? "Preparazione..."
              : "Usa immagine"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/*
 * ============================================================
 * EXPORT IMMAGINE
 * ============================================================
 */

async function exportEditedImage({
  image,

  fileName,

  aspectRatio,

  zoom,

  position,

  previewWidth,

  outputWidth,
}: {
  image:
    HTMLImageElement;

  fileName:
    string;

  aspectRatio:
    ImageEditorAspectRatio;

  zoom:
    number;

  position:
    Position;

  previewWidth:
    number;

  outputWidth:
    number;
}): Promise<File> {
  const ratio =
    ASPECT_RATIOS[
      aspectRatio
    ];

  const outputHeight =
    Math.round(
      outputWidth /
        ratio,
    );

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width =
    outputWidth;

  canvas.height =
    outputHeight;

  const context =
    canvas.getContext(
      "2d",
    );

  if (
    !context
  ) {
    throw new Error(
      "Impossibile inizializzare l'editor immagine.",
    );
  }

  /*
   * ==========================================================
   * COVER
   * ==========================================================
   *
   * L'immagine deve coprire completamente
   * l'area di output.
   * ==========================================================
   */

  const baseScale =
    Math.max(
      outputWidth /
        image.naturalWidth,

      outputHeight /
        image.naturalHeight,
    );

  const finalScale =
    baseScale *
    zoom;

  const drawnWidth =
    image.naturalWidth *
    finalScale;

  const drawnHeight =
    image.naturalHeight *
    finalScale;

  /*
   * ==========================================================
   * PREVIEW SCALE
   * ==========================================================
   *
   * Preview editor = max 360px.
   * ==========================================================
   */

  const safePreviewWidth =
    previewWidth > 0
      ? previewWidth
      : 360;

  const positionScale =
    outputWidth /
    safePreviewWidth;

  const drawX =
    (
      outputWidth -
      drawnWidth
    ) /
      2 +
    position.x *
      positionScale;

  const drawY =
    (
      outputHeight -
      drawnHeight
    ) /
      2 +
    position.y *
      positionScale;

  /*
   * ==========================================================
   * DRAW
   * ==========================================================
   */

  context.clearRect(
    0,
    0,
    outputWidth,
    outputHeight,
  );

  context.drawImage(
    image,

    drawX,
    drawY,

    drawnWidth,
    drawnHeight,
  );

  /*
   * ==========================================================
   * WEBP
   * ==========================================================
   */

  const blob =
    await new Promise<
      Blob |
      null
    >(
      (
        resolve,
      ) => {
        canvas.toBlob(
          resolve,

          "image/webp",

          0.92,
        );
      },
    );

  if (
    !blob
  ) {
    throw new Error(
      "Impossibile generare l'immagine modificata.",
    );
  }

  return new File(
    [
      blob,
    ],

    createEditedFileName(
      fileName,

      aspectRatio.replace(
        ":",
        "x",
      ),

      "webp",
    ),

    {
      type:
        "image/webp",
    },
  );
}

/*
 * ============================================================
 * NOME FILE
 * ============================================================
 */

function createEditedFileName(
  originalName:
    string,

  suffix:
    string,

  extension:
    string,
): string {
  const baseName =
    originalName
      .replace(
        /\.[^/.]+$/,
        "",
      )
      .replace(
        /[^a-zA-Z0-9-_]+/g,
        "-",
      );

  return `${baseName}-${suffix}.${extension}`;
}