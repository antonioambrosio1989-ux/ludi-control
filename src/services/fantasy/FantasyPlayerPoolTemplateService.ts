const SHEET_NAME =
  "Listone";

const HEADERS = [
  "playerSeasonCode",
  "nome",
  "cognome",
  "teamCode",
  "nomeSquadra",
  "ruolo",
  "costo",
] as const;

const EXAMPLE_ROWS = [
  [
    "rossi-mario-1998-ss26-27",
    "Mario",
    "Rossi",
    "chelsea",
    "Chelsea",
    "Portiere",
    12,
  ],
  [
    "bianchi-luca-2001-ss26-27",
    "Luca",
    "Bianchi",
    "arsenal",
    "Arsenal",
    "Difensore",
    18,
  ],
  [
    "verdi-paolo-1999-ss26-27",
    "Paolo",
    "Verdi",
    "liverpool",
    "Liverpool",
    "Attaccante",
    25,
  ],
] as const;

export class FantasyPlayerPoolTemplateService {
  private static buildWorkbookWithXlsx(
    XLSX:
      typeof import("xlsx"),
  ): import("xlsx").WorkBook {
    const worksheet =
      XLSX.utils.aoa_to_sheet(
        [
          [...HEADERS],
          ...EXAMPLE_ROWS.map(
            (row) => [
              ...row,
            ],
          ),
        ],
      );

    worksheet["!cols"] = [
      {
        wch:
          34,
      },
      {
        wch:
          18,
      },
      {
        wch:
          20,
      },
      {
        wch:
          22,
      },
      {
        wch:
          24,
      },
      {
        wch:
          16,
      },
      {
        wch:
          10,
      },
    ];

    worksheet["!autofilter"] = {
      ref:
        `A1:G${EXAMPLE_ROWS.length + 1}`,
    };

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      SHEET_NAME,
    );

    return workbook;
  }

  static async buildWorkbook():
    Promise<import("xlsx").WorkBook> {
    const XLSX =
      await import("xlsx");

    return this.buildWorkbookWithXlsx(
      XLSX,
    );
  }

  static async download(
    filename =
      "template-listone-fantacalcio.xlsx",
  ): Promise<void> {
    if (
      typeof window ===
      "undefined"
    ) {
      throw new Error(
        "Il download del template può essere eseguito solo dal browser.",
      );
    }

    const XLSX =
      await import("xlsx");

    const workbook =
      this.buildWorkbookWithXlsx(
        XLSX,
      );

    XLSX.writeFile(
      workbook,
      filename,
      {
        compression:
          true,
      },
    );
  }

  static async exportArrayBuffer():
    Promise<ArrayBuffer> {
    const XLSX =
      await import("xlsx");

    const workbook =
      this.buildWorkbookWithXlsx(
        XLSX,
      );

    return XLSX.write(
      workbook,
      {
        bookType:
          "xlsx",

        type:
          "array",

        compression:
          true,
      },
    ) as ArrayBuffer;
  }
}