"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import AppShell from "@/components/ui/AppShell";

import {
  FUT_CARD_TEMPLATES,
  getDefaultFutCardLayout,
  getFutCardTextColor,
} from "@/src/application/fut/FutCardLayoutDefaults";

import type {
  FutCardTemplate,
} from "@/src/application/fut/FutCardResolver";

import {
  FirebaseFutCardLayoutRepository,
} from "@/src/services/fut/FirebaseFutCardLayoutRepository";

import type {
  FutCardElementKey,
  FutCardElementLayout,
  FutCardLayout,
} from "@/src/types/FutCardLayout";

const PLAYER_PLACEHOLDER_URL =
  "/players/player-placeholder.png";

const ELEMENT_LABELS: Record<
  FutCardElementKey,
  string
> = {
  rating: "Rating",
  role: "Ruolo",
  photo: "Foto",
  name: "Nome",
  nationality: "Nazionalità",
  competitionLogo:
    "Logo competizione",
  teamLogo:
    "Logo squadra",
};

type Interaction = {
  pointerId: number;
  mode:
    | "move"
    | "resize";
  element:
    FutCardElementKey;
  startClientX: number;
  startClientY: number;
  startLayout:
    FutCardElementLayout;
};

export default function FutCardEditorScreen() {
  /*
   * Il template selezionato serve SOLO
   * per cambiare l'immagine di anteprima.
   * Il layout salvato è unico per tutte le card.
   */
  const [
    previewTemplate,
    setPreviewTemplate,
  ] =
    useState<
      FutCardTemplate
    >(
      "player-gold",
    );

  const [
    layout,
    setLayout,
  ] =
    useState<
      FutCardLayout
    >(
      () =>
        getDefaultFutCardLayout(),
    );

  const [
    selectedElement,
    setSelectedElement,
  ] =
    useState<
      FutCardElementKey
    >(
      "photo",
    );

  const [
    saveState,
    setSaveState,
  ] =
    useState<
      | "idle"
      | "saving"
      | "saved"
      | "error"
    >(
      "idle",
    );

  const previewRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null,
    );

  const interactionRef =
    useRef<
      Interaction |
      null
    >(
      null,
    );

  useEffect(() => {
    return FirebaseFutCardLayoutRepository.subscribe(
      (
        nextLayout,
      ) => {
        setLayout(
          nextLayout,
        );

        setSaveState(
          "idle",
        );
      },
    );
  }, []);

  const selectedLayout =
    layout.elements[
      selectedElement
    ];

  const previewTemplateUrl =
    `/FUT/${previewTemplate}.png`;

  const textColor =
    getFutCardTextColor(
      previewTemplate,
    );

  const cardLabel =
    useMemo(
      () =>
        previewTemplate
          .replaceAll(
            "-",
            " ",
          )
          .toLocaleUpperCase(
            "it",
          ),

      [
        previewTemplate,
      ],
    );

  function updateElement(
    element:
      FutCardElementKey,

    patch:
      Partial<
        FutCardElementLayout
      >,
  ) {
    setLayout(
      (
        current,
      ) => ({
        ...current,

        elements: {
          ...current.elements,

          [element]: {
            ...current.elements[
              element
            ],

            ...patch,
          },
        },
      }),
    );

    setSaveState(
      "idle",
    );
  }

  function beginInteraction({
    event,
    element,
    mode,
  }: {
    event:
      ReactPointerEvent<
        HTMLElement
      >;

    element:
      FutCardElementKey;

    mode:
      | "move"
      | "resize";
  }) {
    event.preventDefault();
    event.stopPropagation();

    setSelectedElement(
      element,
    );

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    interactionRef.current =
      {
        pointerId:
          event.pointerId,

        mode,

        element,

        startClientX:
          event.clientX,

        startClientY:
          event.clientY,

        startLayout:
          {
            ...layout.elements[
              element
            ],
          },
      };
  }

  function handleInteractionMove(
    event:
      ReactPointerEvent<
        HTMLElement
      >,
  ) {
    const interaction =
      interactionRef.current;

    const preview =
      previewRef.current;

    if (
      !interaction ||
      !preview ||
      interaction.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const rect =
      preview.getBoundingClientRect();

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return;
    }

    const dx =
      (
        event.clientX -
        interaction.startClientX
      ) /
      rect.width *
      100;

    const dy =
      (
        event.clientY -
        interaction.startClientY
      ) /
      rect.height *
      100;

    if (
      interaction.mode ===
      "move"
    ) {
      updateElement(
        interaction.element,
        {
          x:
            clamp(
              interaction.startLayout.x +
              dx,
              0,
              100 -
              interaction.startLayout.width,
            ),

          y:
            clamp(
              interaction.startLayout.y +
              dy,
              0,
              100 -
              interaction.startLayout.height,
            ),
        },
      );

      return;
    }

    updateElement(
      interaction.element,
      {
        width:
          clamp(
            interaction.startLayout.width +
            dx,
            2,
            100 -
            interaction.startLayout.x,
          ),

        height:
          clamp(
            interaction.startLayout.height +
            dy,
            2,
            100 -
            interaction.startLayout.y,
          ),
      },
    );
  }

  function endInteraction(
    event:
      ReactPointerEvent<
        HTMLElement
      >,
  ) {
    if (
      interactionRef.current
        ?.pointerId !==
      event.pointerId
    ) {
      return;
    }

    interactionRef.current =
      null;
  }

  async function saveLayout() {
    try {
      setSaveState(
        "saving",
      );

      await FirebaseFutCardLayoutRepository.save(
        layout,
      );

      setSaveState(
        "saved",
      );
    } catch (
      error
    ) {
      console.error(
        "Errore salvataggio layout FUT:",
        error,
      );

      setSaveState(
        "error",
      );
    }
  }

  function resetLayout() {
    setLayout(
      getDefaultFutCardLayout(),
    );

    setSaveState(
      "idle",
    );
  }

  return (
    <AppShell>
      <header className="mt-6 mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
          Centro di controllo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          Card Editor
        </h1>

        <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
          Il layout è unico e viene applicato a tutte le FUT card. Cambia soltanto il colore del testo: scuro sulle card chiare, bianco sulle card scure.
        </p>
      </header>

      <section className="mb-5 rounded-[13px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/45">
          Card di anteprima
        </label>

        <select
          value={
            previewTemplate
          }
          onChange={
            (
              event,
            ) => {
              setPreviewTemplate(
                event.target.value as
                  FutCardTemplate,
              );
            }
          }
          className="mt-2 h-12 w-full rounded-[11px] border border-[#06142E]/10 bg-white px-3 text-sm font-black uppercase text-[#06142E] outline-none"
        >
          {FUT_CARD_TEMPLATES.map(
            (
              currentTemplate,
            ) => (
              <option
                key={
                  currentTemplate
                }
                value={
                  currentTemplate
                }
              >
                {
                  currentTemplate
                }
              </option>
            ),
          )}
        </select>

        <p className="mt-2 text-[10px] font-bold leading-4 text-[#06142E]/40">
          Cambiare questa voce modifica solo la grafica di anteprima: posizione e dimensione degli elementi restano identiche per tutte le card.
        </p>
      </section>

      <section className="mb-5 rounded-[13px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
              Anteprima
            </p>

            <p className="mt-1 text-sm font-black uppercase text-[#06142E]">
              {
                cardLabel
              }
            </p>
          </div>

          <span className="rounded-full bg-[#06142E]/5 px-3 py-1 text-[9px] font-black uppercase text-[#06142E]/45">
            Layout unico
          </span>
        </div>

        <div className="flex justify-center">
          <div
            ref={
              previewRef
            }
            className="relative w-full max-w-[340px] touch-none select-none"
            style={{
              aspectRatio:
                "3 / 4",
            }}
          >
            <Image
              src={
                previewTemplateUrl
              }
              alt={`Template ${previewTemplate}`}
              fill
              priority
              unoptimized
              sizes="340px"
              className="pointer-events-none object-contain"
            />

            <EditableElement
              element="rating"
              selectedElement={
                selectedElement
              }
              layout={
                layout.elements.rating
              }
              onMoveStart={
                beginInteraction
              }
              onMove={
                handleInteractionMove
              }
              onMoveEnd={
                endInteraction
              }
            >
              <span
                className="font-black leading-none"
                style={{
                  color:
                    textColor,

                  fontSize:
                    layout.elements.rating.fontSize,
                }}
              >
                84
              </span>
            </EditableElement>

            <EditableElement
              element="role"
              selectedElement={
                selectedElement
              }
              layout={
                layout.elements.role
              }
              onMoveStart={
                beginInteraction
              }
              onMove={
                handleInteractionMove
              }
              onMoveEnd={
                endInteraction
              }
            >
              <span
                className="font-black uppercase"
                style={{
                  color:
                    textColor,

                  fontSize:
                    layout.elements.role.fontSize,
                }}
              >
                ATT
              </span>
            </EditableElement>

            <EditableElement
              element="photo"
              selectedElement={
                selectedElement
              }
              layout={
                layout.elements.photo
              }
              onMoveStart={
                beginInteraction
              }
              onMove={
                handleInteractionMove
              }
              onMoveEnd={
                endInteraction
              }
            >
              <div className="relative h-full w-full overflow-hidden">
                <Image
                  src={
                    PLAYER_PLACEHOLDER_URL
                  }
                  alt="Giocatore di esempio"
                  fill
                  sizes="180px"
                  className="object-contain object-bottom"
                />
              </div>
            </EditableElement>

            <EditableElement
              element="name"
              selectedElement={
                selectedElement
              }
              layout={
                layout.elements.name
              }
              onMoveStart={
                beginInteraction
              }
              onMove={
                handleInteractionMove
              }
              onMoveEnd={
                endInteraction
              }
            >
              <span
                className="w-full truncate text-center font-black uppercase"
                style={{
                  color:
                    textColor,

                  fontSize:
                    layout.elements.name.fontSize,
                }}
              >
                RANIERI
              </span>
            </EditableElement>

            <EditableElement
              element="nationality"
              selectedElement={
                selectedElement
              }
              layout={
                layout.elements.nationality
              }
              onMoveStart={
                beginInteraction
              }
              onMove={
                handleInteractionMove
              }
              onMoveEnd={
                endInteraction
              }
            >
              <ItalyFlag />
            </EditableElement>

            <EditableElement
              element="competitionLogo"
              selectedElement={
                selectedElement
              }
              layout={
                layout.elements.competitionLogo
              }
              onMoveStart={
                beginInteraction
              }
              onMove={
                handleInteractionMove
              }
              onMoveEnd={
                endInteraction
              }
            >
              <PreviewLogo
                label="LUDI"
                textColor={
                  textColor
                }
              />
            </EditableElement>

            <EditableElement
              element="teamLogo"
              selectedElement={
                selectedElement
              }
              layout={
                layout.elements.teamLogo
              }
              onMoveStart={
                beginInteraction
              }
              onMove={
                handleInteractionMove
              }
              onMoveEnd={
                endInteraction
              }
            >
              <PreviewLogo
                label="FC"
                textColor={
                  textColor
                }
              />
            </EditableElement>
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-[13px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#06142E]/40">
          Elemento
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            Object.keys(
              ELEMENT_LABELS,
            ) as
              FutCardElementKey[]
          ).map(
            (
              element,
            ) => (
              <button
                key={
                  element
                }
                type="button"
                onClick={
                  () =>
                    setSelectedElement(
                      element,
                    )
                }
                className={[
                  "min-h-[44px] rounded-[10px] px-3 text-[10px] font-black uppercase transition",
                  selectedElement ===
                    element
                    ? "bg-[#06142E] text-white"
                    : "bg-[#06142E]/5 text-[#06142E]",
                ].join(
                  " ",
                )}
              >
                {
                  ELEMENT_LABELS[
                    element
                  ]
                }
              </button>
            ),
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <NumberControl
            label="X"
            value={
              selectedLayout.x
            }
            min={0}
            max={98}
            onChange={
              (
                value,
              ) =>
                updateElement(
                  selectedElement,
                  {
                    x:
                      value,
                  },
                )
            }
          />

          <NumberControl
            label="Y"
            value={
              selectedLayout.y
            }
            min={0}
            max={98}
            onChange={
              (
                value,
              ) =>
                updateElement(
                  selectedElement,
                  {
                    y:
                      value,
                  },
                )
            }
          />

          <NumberControl
            label="Larghezza"
            value={
              selectedLayout.width
            }
            min={2}
            max={100}
            onChange={
              (
                value,
              ) =>
                updateElement(
                  selectedElement,
                  {
                    width:
                      value,
                  },
                )
            }
          />

          <NumberControl
            label="Altezza"
            value={
              selectedLayout.height
            }
            min={2}
            max={100}
            onChange={
              (
                value,
              ) =>
                updateElement(
                  selectedElement,
                  {
                    height:
                      value,
                  },
                )
            }
          />
        </div>

        {selectedLayout.fontSize !==
          undefined && (
          <div className="mt-3">
            <NumberControl
              label="Font"
              value={
                selectedLayout.fontSize
              }
              min={6}
              max={80}
              onChange={
                (
                  value,
                ) =>
                  updateElement(
                    selectedElement,
                    {
                      fontSize:
                        value,
                    },
                  )
              }
            />
          </div>
        )}
      </section>

      <section className="mb-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={
            resetLayout
          }
          className="h-12 rounded-[13px] border border-[#06142E]/10 bg-white text-xs font-black uppercase text-[#06142E] shadow-[0_8px_20px_rgba(6,20,46,0.06)]"
        >
          Reset
        </button>

        <button
          type="button"
          disabled={
            saveState ===
            "saving"
          }
          onClick={
            () => {
              void saveLayout();
            }
          }
          className="h-12 rounded-[13px] bg-[#06142E] text-xs font-black uppercase text-white shadow-[0_10px_24px_rgba(6,20,46,0.16)] disabled:opacity-50"
        >
          {saveState ===
            "saving"
            ? "Salvataggio..."
            : "Salva layout unico"}
        </button>
      </section>

      {saveState ===
        "saved" && (
        <p className="mb-5 text-center text-xs font-black text-green-700">
          Layout unico salvato e applicato a tutte le FUT card.
        </p>
      )}

      {saveState ===
        "error" && (
        <p className="mb-5 text-center text-xs font-black text-red-700">
          Impossibile salvare il layout.
        </p>
      )}
    </AppShell>
  );
}

function EditableElement({
  element,
  selectedElement,
  layout,
  onMoveStart,
  onMove,
  onMoveEnd,
  children,
}: {
  element:
    FutCardElementKey;

  selectedElement:
    FutCardElementKey;

  layout:
    FutCardElementLayout;

  onMoveStart:
    (
      input: {
        event:
          ReactPointerEvent<
            HTMLElement
          >;

        element:
          FutCardElementKey;

        mode:
          | "move"
          | "resize";
      },
    ) => void;

  onMove:
    (
      event:
        ReactPointerEvent<
          HTMLElement
        >,
    ) => void;

  onMoveEnd:
    (
      event:
        ReactPointerEvent<
          HTMLElement
        >,
    ) => void;

  children:
    React.ReactNode;
}) {
  const isSelected =
    selectedElement ===
    element;

  return (
    <div
      className={[
        "absolute z-20 flex cursor-move touch-none items-center justify-center",
        isSelected
          ? "outline outline-2 outline-cyan-500"
          : "outline outline-1 outline-transparent",
      ].join(
        " ",
      )}
      style={{
        left:
          `${layout.x}%`,

        top:
          `${layout.y}%`,

        width:
          `${layout.width}%`,

        height:
          `${layout.height}%`,
      }}
      onPointerDown={
        (
          event,
        ) =>
          onMoveStart({
            event,
            element,
            mode:
              "move",
          })
      }
      onPointerMove={
        onMove
      }
      onPointerUp={
        onMoveEnd
      }
      onPointerCancel={
        onMoveEnd
      }
    >
      {
        children
      }

      {isSelected && (
        <button
          type="button"
          aria-label={`Ridimensiona ${ELEMENT_LABELS[element]}`}
          className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-cyan-500 shadow"
          onPointerDown={
            (
              event,
            ) =>
              onMoveStart({
                event,
                element,
                mode:
                  "resize",
              })
          }
          onPointerMove={
            onMove
          }
          onPointerUp={
            onMoveEnd
          }
          onPointerCancel={
            onMoveEnd
          }
        />
      )}
    </div>
  );
}

function ItalyFlag() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="flex overflow-hidden"
        style={{
          width:
            "80%",

          aspectRatio:
            "3 / 2",
        }}
      >
        <div
          className="h-full flex-1"
          style={{
            backgroundColor:
              "#009246",
          }}
        />

        <div
          className="h-full flex-1"
          style={{
            backgroundColor:
              "#FFFFFF",
          }}
        />

        <div
          className="h-full flex-1"
          style={{
            backgroundColor:
              "#CE2B37",
          }}
        />
      </div>
    </div>
  );
}

function PreviewLogo({
  label,
  textColor,
}: {
  label:
    string;

  textColor:
    string;
}) {
  return (
    <div
      className="flex h-full w-full items-center justify-center p-1 text-[8px] font-black uppercase"
      style={{
        color:
          textColor,
      }}
    >
      {
        label
      }
    </div>
  );
}

function NumberControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label:
    string;

  value:
    number;

  min:
    number;

  max:
    number;

  onChange:
    (
      value:
        number,
    ) => void;
}) {
  return (
    <label>
      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#06142E]/40">
        {
          label
        }
      </span>

      <div className="mt-1 flex h-11 items-center rounded-[10px] border border-[#06142E]/10 bg-white px-3">
        <input
          type="number"
          min={
            min
          }
          max={
            max
          }
          step="0.5"
          value={
            roundValue(
              value,
            )
          }
          onChange={
            (
              event,
            ) => {
              const next =
                Number(
                  event.target.value,
                );

              if (
                Number.isFinite(
                  next,
                )
              ) {
                onChange(
                  clamp(
                    next,
                    min,
                    max,
                  ),
                );
              }
            }
          }
          className="w-full bg-transparent text-sm font-black text-[#06142E] outline-none"
        />

        <span className="text-[10px] font-black text-[#06142E]/30">
          {label ===
            "Font"
            ? "px"
            : "%"}
        </span>
      </div>
    </label>
  );
}

function clamp(
  value:
    number,

  min:
    number,

  max:
    number,
) {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

function roundValue(
  value:
    number,
) {
  return Math.round(
    value *
    10,
  ) /
  10;
}
