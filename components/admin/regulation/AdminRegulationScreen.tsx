"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  FileDown,
  FileUp,
  GripVertical,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import AppShell from "@/components/ui/AppShell";

import { FirebaseRegulationRepository } from "@/src/services/regulation/FirebaseRegulationRepository";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import type {
  Regulation,
} from "@/src/types/Regulation";

type RegulationArticle = {
  id: string;
  number: number;
  title: string;
  paragraphs: string[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const initialArticles: RegulationArticle[] = [
  {
    id: "article-1",
    number: 1,
    title: "",
    paragraphs: [],
  },
];

function createArticle(number: number): RegulationArticle {
  return {
    id: `article-${Date.now()}-${number}`,
    number,
    title: "Nuovo articolo",
    paragraphs: [""],
  };
}

function normalizeArticles(
  articles: RegulationArticle[],
): RegulationArticle[] {
  return articles.map((article, index) => ({
    ...article,
    number: index + 1,
  }));
}

function mapRegulationToArticles(
  regulation:
    | Regulation
    | undefined,
): RegulationArticle[] {
  if (
    !regulation ||
    regulation.sections.length ===
      0
  ) {
    return initialArticles.map(
      (article) => ({
        ...article,
        paragraphs: [
          ...article.paragraphs,
        ],
      }),
    );
  }

  return regulation.sections.map(
    (
      section,
      index,
    ) => ({
      id:
        section.id,

      number:
        index + 1,

      title:
        section.title,

      paragraphs:
        section.content
          .split(
            /\r?\n\s*\r?\n|\r?\n+/,
          )
          .map(
            (paragraph) =>
              paragraph.trim(),
          )
          .filter(Boolean)
          .concat(
            section.content.trim()
              ? []
              : [""],
          ),
    }),
  );
}

export default function AdminRegulationScreen() {
  const {
    selectedCompetition,
    selectedCompetitionId,
  } =
    useCompetition();

  const selectedCompetitionIdRef =
    useRef<
      string | undefined
    >(
      selectedCompetitionId,
    );

  const [
    loadedCompetitionId,
    setLoadedCompetitionId,
  ] =
    useState<
      string | null
    >(null);

  const [articles, setArticles] =
    useState<RegulationArticle[]>(initialArticles);

  const [expandedArticles, setExpandedArticles] = useState<string[]>(
    initialArticles.map((article) => article.id),
  );

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  
  const [showPreview, setShowPreview] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wordInputRef =
  useRef<HTMLInputElement | null>(
    null,
  );

const [
  isImportingWord,
  setIsImportingWord,
] = useState(false);

const [
  importMessage,
  setImportMessage,
] =
  useState<string | null>(
    null,
  );

  useEffect(
    () => {
      selectedCompetitionIdRef.current =
        selectedCompetitionId;
    },
    [
      selectedCompetitionId,
    ],
  );

  useEffect(
    () => {
      if (
        !selectedCompetitionId
      ) {
        return;
      }

      const competitionId =
        selectedCompetitionId;

      const unsubscribe =
        FirebaseRegulationRepository.subscribeByCompetition(
          competitionId,

          (
            nextRegulation,
          ) => {
            const nextArticles =
              mapRegulationToArticles(
                nextRegulation,
              );

            setArticles(
              nextArticles,
            );

            setExpandedArticles(
              nextArticles.map(
                (article) =>
                  article.id,
              ),
            );

            setLoadedCompetitionId(
              competitionId,
            );

            setSaveStatus(
              "idle",
            );

            setErrorMessage(
              null,
            );

            setImportMessage(
              null,
            );

            setShowPreview(
              false,
            );
          },

          (
            currentError,
          ) => {
            console.error(
              "Errore caricamento regolamento Admin:",
              currentError,
            );

            setLoadedCompetitionId(
              competitionId,
            );

            setErrorMessage(
              "Impossibile caricare il regolamento della competizione selezionata.",
            );
          },
        );

      return unsubscribe;
    },
    [
      selectedCompetitionId,
    ],
  );

  const isLoadingRegulation =
    Boolean(
      selectedCompetitionId,
    ) &&
    loadedCompetitionId !==
      selectedCompetitionId;

  const totalParagraphs = useMemo(
    () =>
      articles.reduce(
        (total, article) => total + article.paragraphs.length,
        0,
      ),
    [articles],
  );

  function updateArticle(
    articleId: string,
    updates: Partial<RegulationArticle>,
  ) {
    setArticles((currentArticles) =>
      currentArticles.map((article) =>
        article.id === articleId
          ? {
              ...article,
              ...updates,
            }
          : article,
      ),
    );

    setSaveStatus("idle");
  }

  function addArticle() {
    const newArticle = createArticle(articles.length + 1);

    setArticles((currentArticles) => [
      ...currentArticles,
      newArticle,
    ]);

    setExpandedArticles((current) => [...current, newArticle.id]);
    setSaveStatus("idle");
  }

  function removeArticle(articleId: string) {
    setArticles((currentArticles) =>
      normalizeArticles(
        currentArticles.filter(
          (article) => article.id !== articleId,
        ),
      ),
    );

    setExpandedArticles((current) =>
      current.filter((id) => id !== articleId),
    );

    setSaveStatus("idle");
  }

  function moveArticle(articleId: string, direction: "up" | "down") {
    setArticles((currentArticles) => {
      const currentIndex = currentArticles.findIndex(
        (article) => article.id === articleId,
      );

      if (currentIndex === -1) {
        return currentArticles;
      }

      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= currentArticles.length
      ) {
        return currentArticles;
      }

      const reorderedArticles = [...currentArticles];
      const [movedArticle] = reorderedArticles.splice(currentIndex, 1);

      reorderedArticles.splice(targetIndex, 0, movedArticle);

      return normalizeArticles(reorderedArticles);
    });

    setSaveStatus("idle");
  }

  function toggleExpanded(articleId: string) {
    setExpandedArticles((current) =>
      current.includes(articleId)
        ? current.filter((id) => id !== articleId)
        : [...current, articleId],
    );
  }

  function addParagraph(articleId: string) {
    setArticles((currentArticles) =>
      currentArticles.map((article) =>
        article.id === articleId
          ? {
              ...article,
              paragraphs: [...article.paragraphs, ""],
            }
          : article,
      ),
    );

    setSaveStatus("idle");
  }

  function updateParagraph(
    articleId: string,
    paragraphIndex: number,
    value: string,
  ) {
    setArticles((currentArticles) =>
      currentArticles.map((article) => {
        if (article.id !== articleId) {
          return article;
        }

        return {
          ...article,
          paragraphs: article.paragraphs.map(
            (paragraph, currentIndex) =>
              currentIndex === paragraphIndex ? value : paragraph,
          ),
        };
      }),
    );

    setSaveStatus("idle");
  }

  function removeParagraph(
    articleId: string,
    paragraphIndex: number,
  ) {
    setArticles((currentArticles) =>
      currentArticles.map((article) => {
        if (article.id !== articleId) {
          return article;
        }

        const remainingParagraphs = article.paragraphs.filter(
          (_, currentIndex) => currentIndex !== paragraphIndex,
        );

        return {
          ...article,
          paragraphs:
            remainingParagraphs.length > 0
              ? remainingParagraphs
              : [""],
        };
      }),
    );

    setSaveStatus("idle");
  }

  async function importWordFile(
  file: File,
) {
  if (isImportingWord) {
    return;
  }

  const importCompetitionId =
    selectedCompetitionId;

  if (
    !importCompetitionId ||
    loadedCompetitionId !==
      importCompetitionId
  ) {
    setErrorMessage(
      "Attendi il caricamento della competizione prima di importare il file Word.",
    );

    return;
  }

  if (
    !file.name
      .toLowerCase()
      .endsWith(".docx")
  ) {
    setErrorMessage(
      "Seleziona un file Word in formato .docx.",
    );

    return;
  }

  setIsImportingWord(true);
  setErrorMessage(null);
  setImportMessage(null);

  try {
    const [
      { extractRawText },
      arrayBuffer,
    ] =
      await Promise.all([
        import("mammoth"),
        file.arrayBuffer(),
      ]);

    const result =
      await extractRawText({
        arrayBuffer,
      });

    const importedArticles =
      parseWordRegulation(
        result.value,
      );

    if (
      selectedCompetitionIdRef.current !==
      importCompetitionId
    ) {
      throw new Error(
        "La competizione è cambiata durante l'importazione. Ricarica il file Word nella competizione corretta.",
      );
    }

    if (
      importedArticles.length ===
      0
    ) {
      throw new Error(
        "Non sono stati trovati articoli nel file Word.",
      );
    }

    const hasExistingContent =
      articles.some(
        (article) =>
          article.title
            .trim()
            .length > 0 ||
          article.paragraphs.some(
            (paragraph) =>
              paragraph
                .trim()
                .length > 0,
          ),
      );

    if (
      hasExistingContent
    ) {
      const confirmed =
        window.confirm(
          [
            "Importando il file Word il contenuto attuale dell'editor verrà sostituito.",
            "",
            "Vuoi continuare?",
          ].join("\n"),
        );

      if (!confirmed) {
        return;
      }
    }

    if (
      selectedCompetitionIdRef.current !==
      importCompetitionId
    ) {
      throw new Error(
        "La competizione è cambiata durante l'importazione. Ricarica il file Word nella competizione corretta.",
      );
    }

    setArticles(
      importedArticles,
    );

    setExpandedArticles(
      importedArticles.map(
        (article) =>
          article.id,
      ),
    );

    setSaveStatus("idle");

    setImportMessage(
      `Importazione completata: ${importedArticles.length} articoli caricati.`,
    );
  } catch (error) {
    console.error(
      "Errore importazione Word:",
      error,
    );

    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Impossibile importare il regolamento Word.",
    );
  } finally {
    setIsImportingWord(false);
  }
}

  function exportWordFile() {
    if (
      !selectedCompetitionId ||
      loadedCompetitionId !==
        selectedCompetitionId
    ) {
      setErrorMessage(
        "Attendi il caricamento del regolamento della competizione selezionata.",
      );

      return;
    }

    const normalizedArticles =
      normalizeArticles(
        articles,
      );

    const hasContent =
      normalizedArticles.some(
        (article) =>
          article.title
            .trim()
            .length > 0 ||
          article.paragraphs.some(
            (paragraph) =>
              paragraph
                .trim()
                .length > 0,
          ),
      );

    if (
      !hasContent
    ) {
      setErrorMessage(
        "Non c'è ancora alcun contenuto da esportare.",
      );

      return;
    }

    setErrorMessage(
      null,
    );

    const competitionName =
      selectedCompetition
        ?.name
        ?.trim() ||
      "Competizione";

    const body =
      normalizedArticles
        .map(
          (
            article,
          ) => {
            const title =
              escapeWordHtml(
                article.title
                  .trim() ||
                  `Articolo ${article.number}`,
              );

            const paragraphs =
              article.paragraphs
                .map(
                  (
                    paragraph,
                    paragraphIndex,
                  ) => {
                    const value =
                      paragraph
                        .trim();

                    if (
                      !value
                    ) {
                      return "";
                    }

                    return `
                      <p class="paragraph">
                        <strong>${article.number}.${paragraphIndex + 1}</strong>
                        ${escapeWordHtml(
                          value,
                        )}
                      </p>
                    `;
                  },
                )
                .filter(
                  Boolean,
                )
                .join(
                  "",
                );

            return `
              <section class="article">
                <h2>ARTICOLO ${article.number} - ${title}</h2>
                ${paragraphs}
              </section>
            `;
          },
        )
        .join(
          "",
        );

    const html =
      `<!DOCTYPE html>
      <html
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word"
        xmlns="http://www.w3.org/TR/REC-html40"
      >
        <head>
          <meta charset="utf-8" />
          <title>Regolamento ${escapeWordHtml(
            competitionName,
          )}</title>
          <style>
            @page {
              size: A4;
              margin: 2cm;
            }

            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #111111;
              font-size: 11pt;
              line-height: 1.45;
            }

            h1 {
              text-align: center;
              font-size: 20pt;
              margin: 0 0 8pt 0;
            }

            .competition {
              text-align: center;
              font-size: 13pt;
              font-weight: 700;
              margin: 0 0 28pt 0;
            }

            .article {
              page-break-inside: avoid;
              margin: 0 0 20pt 0;
            }

            h2 {
              font-size: 13pt;
              margin: 0 0 10pt 0;
            }

            .paragraph {
              margin: 0 0 8pt 0;
              text-align: justify;
            }
          </style>
        </head>

        <body>
          <h1>REGOLAMENTO UFFICIALE</h1>

          <p class="competition">
            ${escapeWordHtml(
              competitionName,
            )}
          </p>

          ${body}
        </body>
      </html>`;

    const blob =
      new Blob(
        [
          "\ufeff",
          html,
        ],
        {
          type:
            "application/msword;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const link =
      document.createElement(
        "a",
      );

    link.href =
      url;

    link.download =
      `Regolamento-${toFileName(
        competitionName,
      )}.doc`;

    document.body.appendChild(
      link,
    );

    link.click();
    link.remove();

    window.setTimeout(
      () => {
        URL.revokeObjectURL(
          url,
        );
      },
      1000,
    );
  }

  async function saveRegulation() {
  if (
    !selectedCompetitionId ||
    loadedCompetitionId !==
      selectedCompetitionId
  ) {
    setSaveStatus(
      "error",
    );

    setErrorMessage(
      "Attendi il caricamento del regolamento della competizione selezionata.",
    );

    return;
  }

  setErrorMessage(null);
  setSaveStatus("saving");

  const normalizedArticles =
    normalizeArticles(
      articles,
    );

  const hasEmptyTitle =
    normalizedArticles.some(
      (article) =>
        article.title
          .trim()
          .length === 0,
    );

  const hasEmptyParagraph =
    normalizedArticles.some(
      (article) =>
        article.paragraphs.some(
          (paragraph) =>
            paragraph
              .trim()
              .length === 0,
        ),
    );

  if (
    hasEmptyTitle ||
    hasEmptyParagraph
  ) {
    setSaveStatus("error");

    setErrorMessage(
      "Completa tutti i titoli e i paragrafi prima di salvare.",
    );

    return;
  }

  try {
    /*
     * Trasformiamo:
     *
     * articolo
     *   ├ paragrafo 1
     *   └ paragrafo 2
     *
     * nella struttura utilizzata
     * dal repository del regolamento.
     */
    const sections =
      normalizedArticles.map(
        (
          article,
          index,
        ) => ({
          id:
            article.id,

          title:
            article.title.trim(),

          content:
            article.paragraphs
              .map(
                (paragraph) =>
                  paragraph.trim(),
              )
              .filter(Boolean)
              .join("\n\n"),

          order:
            index + 1,
        }),
      );

    await FirebaseRegulationRepository.publish(
      selectedCompetitionId,
      {
        title:
          "Regolamento ufficiale",

        sections,
      },
    );

    setArticles(
      normalizedArticles,
    );

    setSaveStatus(
      "saved",
    );

    window.setTimeout(
      () => {
        setSaveStatus(
          "idle",
        );
      },
      2500,
    );
  } catch (error) {
    console.error(
      "Errore salvataggio regolamento:",
      error,
    );

    setSaveStatus(
      "error",
    );

    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Non è stato possibile salvare il regolamento.",
    );
  }
}

  return (
    <AppShell>
      <header className="mt-2 mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
          Centro di controllo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
          Regolamento
        </h1>

        <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/50">
          Gestisci, importa e pubblica il regolamento della competizione.
        </p>
      </header>

      <section>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">
              Competizione
            </p>

            <p className="mt-1 text-lg font-black">
              {
                selectedCompetition
                  ?.name ??
                  "Competizione non selezionata"
              }
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
          ref={wordInputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(event) => {
          const file =
          event.target.files?.[0];
          
          event.target.value =
          "";
          
          if (!file) {
          return;
          }
          
          void importWordFile(
          file,
          );
          }}
          />
          <button
          type="button"
          disabled={
          isImportingWord ||
          isLoadingRegulation ||
          !selectedCompetitionId
          }
          onClick={() => {
          wordInputRef.current
          ?.click();
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-black/[0.05] px-4 text-sm font-bold transition hover:bg-black/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
          >
          {isImportingWord ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
          <FileUp className="h-4 w-4" />
          )}
          
          {isImportingWord
          ? "Importazione..."
          : "Importa Word"}
          </button>
          
            <button
              type="button"
              onClick={exportWordFile}
              disabled={
                isLoadingRegulation ||
                !selectedCompetitionId
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-black/[0.05] px-4 text-sm font-bold transition hover:bg-black/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              Esporta Word
            </button>

            <button
              type="button"
              onClick={() => void saveRegulation()}
              disabled={
                saveStatus === "saving" ||
                isLoadingRegulation ||
                !selectedCompetitionId
              }
              className="inline-flex h-11 min-w-40 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveStatus === "saving" && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
          
              {saveStatus === "saved" && (
                <Check className="h-4 w-4" />
              )}
          
              {saveStatus !== "saving" &&
                saveStatus !== "saved" && (
                  <Save className="h-4 w-4" />
                )}
          
              {saveStatus === "saving"
                ? "Salvataggio..."
                : saveStatus === "saved"
                  ? "Salvato"
                  : "Salva regolamento"}
            </button>
          </div>
        </div>

        <div className="mt-6">
        {isLoadingRegulation && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
            <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-blue-300" />

            <p className="text-sm font-bold text-blue-100">
              Caricamento regolamento di {
                selectedCompetition
                  ?.name ??
                  "questa competizione"
              }...
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

              <p className="text-sm leading-6 text-red-100">
                {errorMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-200 transition hover:text-black"
              aria-label="Chiudi messaggio"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {importMessage && (
  <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-400/20 bg-green-400/10 p-4">
    <Check className="h-5 w-5 shrink-0 text-green-400" />

    <p className="text-sm font-bold text-green-100">
      {importMessage}
    </p>
  </div>
)}

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-black/10 bg-black/[0.04] p-5">
            <p className="text-sm font-semibold text-slate-400">
              Articoli
            </p>

            <p className="mt-2 text-3xl font-black">
              {articles.length}
            </p>
          </div>

          <div className="rounded-3xl border border-black/10 bg-black/[0.04] p-5">
            <p className="text-sm font-semibold text-slate-400">
              Paragrafi
            </p>

            <p className="mt-2 text-3xl font-black">
              {totalParagraphs}
            </p>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">
                Contenuto del regolamento
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Modifica, ordina o aggiungi nuovi articoli.
              </p>
            </div>

            <button
              type="button"
              onClick={addArticle}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-black/10 px-4 text-sm font-black text-slate-950 transition hover:bg-slate-200"
            >
              <Plus className="h-4 w-4" />
              Articolo
            </button>
          </div>

          <div className="space-y-4">
            {articles.map((article, articleIndex) => {
              const isExpanded = expandedArticles.includes(article.id);

              return (
                <article
                  key={article.id}
                  className="overflow-hidden rounded-3xl border border-black/10 bg-black/[0.04]"
                >
                  <div className="flex items-center gap-3 p-4 sm:p-5">
                    <GripVertical className="hidden h-5 w-5 shrink-0 text-slate-600 sm:block" />

                    <div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-black-400 text-sm font-black">
                      {article.number}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpanded(article.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-black-300">
                        Articolo {article.number}
                      </p>

                      <p className="mt-1 truncate font-black">
                        {article.title || "Articolo senza titolo"}
                      </p>
                    </button>

                    <div className="flex items-center">
                      <button
                        type="button"
                        disabled={articleIndex === 0}
                        onClick={() => moveArticle(article.id, "up")}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-black/[0.07] hover:text-black disabled:opacity-20"
                        aria-label="Sposta articolo in alto"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        disabled={
                          articleIndex === articles.length - 1
                        }
                        onClick={() =>
                          moveArticle(article.id, "down")
                        }
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-black/[0.07] hover:text-black disabled:opacity-20"
                        aria-label="Sposta articolo in basso"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removeArticle(article.id)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Elimina articolo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleExpanded(article.id)}
                        className="ml-1 rounded-lg p-2 text-slate-400 transition hover:bg-black/[0.07] hover:text-black"
                        aria-label={
                          isExpanded
                            ? "Chiudi articolo"
                            : "Apri articolo"
                        }
                      >
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-black/10 p-4 sm:p-5">
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Titolo articolo
                        </span>

                        <div className="relative">
                          <Pencil className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                          <input
                            type="text"
                            value={article.title}
                            onChange={(event) =>
                              updateArticle(article.id, {
                                title: event.target.value,
                              })
                            }
                            className="h-12 w-full rounded-xl border border-black/10 bg-black/25 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/10"
                            placeholder="Titolo dell’articolo"
                          />
                        </div>
                      </label>

                      <div className="mt-5 space-y-4">
                        {article.paragraphs.map(
                          (paragraph, paragraphIndex) => (
                            <div
                              key={`${article.id}-${paragraphIndex}`}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                  Paragrafo {paragraphIndex + 1}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeParagraph(
                                      article.id,
                                      paragraphIndex,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-red-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Rimuovi
                                </button>
                              </div>

                              <textarea
                                value={paragraph}
                                onChange={(event) =>
                                  updateParagraph(
                                    article.id,
                                    paragraphIndex,
                                    event.target.value,
                                  )
                                }
                                rows={4}
                                className="w-full resize-y rounded-xl border border-black/10 bg-black/25 p-4 text-sm leading-6 outline-none transition placeholder:text-slate-600 focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/10"
                                placeholder="Inserisci il testo del paragrafo..."
                              />
                            </div>
                          ),
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => addParagraph(article.id)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-black/10 bg-black/[0.04] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-black/[0.08] hover:text-black"
                      >
                        <Plus className="h-4 w-4" />
                        Aggiungi paragrafo
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {articles.length === 0 && (
            <div className="rounded-3xl border border-dashed border-black/15 bg-black/[0.03] px-6 py-14 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-600" />

              <h2 className="mt-4 text-lg font-black">
                Nessun articolo presente
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Aggiungi manualmente un articolo oppure importa un
                regolamento in formato Word.
              </p>

              <button
                type="button"
                onClick={addArticle}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-black-600 px-5 py-3 text-sm font-bold transition hover:bg-black-500"
              >
                <Plus className="h-4 w-4" />
                Crea il primo articolo
              </button>
            </div>
          )}
        </section>
      </div>

      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Anteprima regolamento"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl border border-black/10 bg-slate-950 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-300">
                  Anteprima pubblica
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Regolamento ufficiale
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="rounded-xl bg-black/[0.06] p-2.5 text-slate-400 transition hover:bg-black/[0.1] hover:text-black"
                aria-label="Chiudi anteprima"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-78px)] space-y-4 overflow-y-auto p-5 sm:p-6">
              {articles.map((article) => (
                <article
                  key={`preview-${article.id}`}
                  className="rounded-2xl border border-black/10 bg-black/[0.04] p-5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-black-300">
                    Articolo {article.number}
                  </p>

                  <h3 className="mt-2 text-lg font-black">
                    {article.title || "Articolo senza titolo"}
                  </h3>

                  <div className="mt-4 space-y-3">
                    {article.paragraphs.map(
                      (paragraph, paragraphIndex) => (
                        <p
                          key={`preview-${article.id}-${paragraphIndex}`}
                          className="text-sm leading-7 text-slate-300"
                        >
                          {paragraph ||
                            "Paragrafo ancora da compilare."}
                        </p>
                      ),
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
      </section>
    </AppShell>
  );
}

function escapeWordHtml(
  value:
    string,
): string {
  return value
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#39;",
    );
}

function toFileName(
  value:
    string,
): string {
  const normalized =
    value
      .normalize(
        "NFD",
      )
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-zA-Z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );

  return normalized ||
    "Regolamento";
}

function parseWordRegulation(
  rawText: string,
): RegulationArticle[] {
  const blocks =
    rawText
      .replace(/\r/g, "")
      .split(/\n\s*\n+/)
      .map((block) =>
        block
          .replace(
            /\s*\n\s*/g,
            " ",
          )
          .trim(),
      )
      .filter(Boolean);

  const parsedArticles: Array<{
    originalNumber: number;
    title: string;
    paragraphs: string[];
  }> = [];

  let currentArticle:
    | {
        originalNumber: number;
        title: string;
        paragraphs: string[];
      }
    | undefined;

  for (
    const block of blocks
  ) {
    /*
     * Esempi riconosciuti:
     *
     * ARTICOLO 1 - Iscrizioni
     * Articolo 2 – Formula torneo
     * ARTICOLO 3: Disciplina
     */
    const articleMatch =
      block.match(
        /^articolo\s+(\d+)\s*(?:[-–—:]\s*)?(.*)$/i,
      );

    if (articleMatch) {
      const articleNumber =
        Number(
          articleMatch[1],
        );

      const title =
        articleMatch[2]
          ?.trim() ??
        "";

      currentArticle = {
        originalNumber:
          articleNumber,

        title,

        paragraphs: [],
      };

      parsedArticles.push(
        currentArticle,
      );

      continue;
    }

    /*
     * Esempi riconosciuti:
     *
     * 1.1 Testo...
     * 1.2 - Testo...
     * 2.3: Testo...
     */
    const paragraphMatch =
      block.match(
        /^(\d+)\.(\d+)\s*(?:[-–—:]\s*)?([\s\S]*)$/,
      );

    if (
      paragraphMatch
    ) {
      const articleNumber =
        Number(
          paragraphMatch[1],
        );

      const paragraphText =
        paragraphMatch[3]
          ?.trim() ??
        "";

      const targetArticle =
        parsedArticles.find(
          (article) =>
            article.originalNumber ===
            articleNumber,
        ) ??
        currentArticle;

      if (
        targetArticle &&
        paragraphText
      ) {
        targetArticle.paragraphs.push(
          paragraphText,
        );
      }

      continue;
    }

    /*
     * Se siamo già dentro un articolo
     * e troviamo un normale paragrafo Word,
     * lo aggiungiamo comunque.
     */
    if (
      currentArticle &&
      block
    ) {
      currentArticle.paragraphs.push(
        block,
      );
    }
  }

  return parsedArticles.map(
    (
      article,
      index,
    ) => ({
      id: `article-import-${Date.now()}-${index}`,

      number:
        index + 1,

      title:
        article.title ||
        `Articolo ${index + 1}`,

      paragraphs:
        article.paragraphs.length >
        0
          ? article.paragraphs
          : [""],
    }),
  );
}
