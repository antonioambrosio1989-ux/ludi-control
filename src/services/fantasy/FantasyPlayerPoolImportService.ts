const SHEET_NAME =
  "Listone";

const REQUIRED_HEADERS = [
  "playerSeasonCode",
  "nome",
  "cognome",
  "teamCode",
  "nomeSquadra",
  "ruolo",
  "costo",
] as const;

export type FantasyPlayerPoolImportRow = {
  playerSeasonCode:
    string;

  nome:
    string;

  cognome:
    string;

  teamCode:
    string;

  nomeSquadra:
    string;

  ruolo:
    string;

  costo:
    number;

  rowNumber:
    number;
};

export type FantasyPlayerPoolImportError = {
  rowNumber:
    number | null;

  field?:
    string;

  message:
    string;
};

export type FantasyPlayerPoolImportResult = {
  rows:
    FantasyPlayerPoolImportRow[];

  errors:
    FantasyPlayerPoolImportError[];
};

type RawListoneRow = {
  playerSeasonCode?:
    unknown;

  nome?:
    unknown;

  cognome?:
    unknown;

  teamCode?:
    unknown;

  nomeSquadra?:
    unknown;

  ruolo?:
    unknown;

  costo?:
    unknown;
};

export class FantasyPlayerPoolImportService {
  static async parseFile(
    file:
      File,
  ): Promise<FantasyPlayerPoolImportResult> {
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase();

    if (
      extension !== "xlsx" &&
      extension !== "xls"
    ) {
      throw new Error(
        "Il file selezionato deve essere un file Excel (.xlsx o .xls).",
      );
    }

    const [
      XLSX,
      arrayBuffer,
    ] =
      await Promise.all([
        import("xlsx"),
        file.arrayBuffer(),
      ]);

    return this.parseArrayBufferWithXlsx(
      arrayBuffer,
      XLSX,
    );
  }

  static async parseArrayBuffer(
    arrayBuffer:
      ArrayBuffer,
  ): Promise<FantasyPlayerPoolImportResult> {
    const XLSX =
      await import("xlsx");

    return this.parseArrayBufferWithXlsx(
      arrayBuffer,
      XLSX,
    );
  }

  private static parseArrayBufferWithXlsx(
    arrayBuffer:
      ArrayBuffer,
    XLSX:
      typeof import("xlsx"),
  ): FantasyPlayerPoolImportResult {
    const workbook =
      XLSX.read(
        arrayBuffer,
        {
          type:
            "array",
        },
      );

    const worksheet =
      workbook.Sheets[
        SHEET_NAME
      ];

    if (
      !worksheet
    ) {
      throw new Error(
        `Il file Excel deve contenere il foglio "${SHEET_NAME}".`,
      );
    }

    const matrix =
      XLSX.utils.sheet_to_json<
        unknown[]
      >(
        worksheet,
        {
          header:
            1,

          defval:
            "",

          raw:
            false,
        },
      );

    if (
      matrix.length ===
      0
    ) {
      throw new Error(
        `Il foglio "${SHEET_NAME}" è vuoto.`,
      );
    }

    const headerRow =
      (
        matrix[0] ??
        []
      ).map(
        (value) =>
          String(
            value ??
              "",
          ).trim(),
      );

    const missingHeaders =
      REQUIRED_HEADERS.filter(
        (header) =>
          !headerRow.includes(
            header,
          ),
      );

    if (
      missingHeaders.length >
      0
    ) {
      throw new Error(
        `Nel foglio "${SHEET_NAME}" mancano le colonne obbligatorie: ${missingHeaders.join(
          ", ",
        )}.`,
      );
    }

    const rawRows =
      XLSX.utils.sheet_to_json<
        RawListoneRow
      >(
        worksheet,
        {
          defval:
            "",
        },
      );

    const rows:
      FantasyPlayerPoolImportRow[] =
      [];

    const errors:
      FantasyPlayerPoolImportError[] =
      [];

    rawRows.forEach(
      (
        rawRow,
        index,
      ) => {
        const rowNumber =
          index + 2;

        const normalized =
          this.normalizeRow(
            rawRow,
            rowNumber,
          );

        const rowErrors =
          this.validateRow(
            normalized,
          );

        if (
          rowErrors.length >
          0
        ) {
          errors.push(
            ...rowErrors,
          );

          return;
        }

        rows.push(
          normalized,
        );
      },
    );

    this.validateDuplicates(
      rows,
      errors,
    );

    return {
      rows,
      errors,
    };
  }

  private static normalizeRow(
    rawRow:
      RawListoneRow,
    rowNumber:
      number,
  ): FantasyPlayerPoolImportRow {
    return {
      playerSeasonCode:
        this.toString(
          rawRow.playerSeasonCode,
        ),

      nome:
        this.toString(
          rawRow.nome,
        ),

      cognome:
        this.toString(
          rawRow.cognome,
        ),

      teamCode:
        this.toString(
          rawRow.teamCode,
        ),

      nomeSquadra:
        this.toString(
          rawRow.nomeSquadra,
        ),

      ruolo:
        this.normalizeRole(
          rawRow.ruolo,
        ),

      costo:
        this.toNumber(
          rawRow.costo,
        ),

      rowNumber,
    };
  }

  private static validateRow(
    row:
      FantasyPlayerPoolImportRow,
  ): FantasyPlayerPoolImportError[] {
    const errors:
      FantasyPlayerPoolImportError[] =
      [];

    if (
      !row.playerSeasonCode
    ) {
      errors.push({
        rowNumber:
          row.rowNumber,

        field:
          "playerSeasonCode",

        message:
          "playerSeasonCode obbligatorio.",
      });
    }

    if (
      !row.nome
    ) {
      errors.push({
        rowNumber:
          row.rowNumber,

        field:
          "nome",

        message:
          "Nome obbligatorio.",
      });
    }

    if (
      !row.cognome
    ) {
      errors.push({
        rowNumber:
          row.rowNumber,

        field:
          "cognome",

        message:
          "Cognome obbligatorio.",
      });
    }

    if (
      !row.teamCode
    ) {
      errors.push({
        rowNumber:
          row.rowNumber,

        field:
          "teamCode",

        message:
          "teamCode obbligatorio.",
      });
    }

    if (
      !row.nomeSquadra
    ) {
      errors.push({
        rowNumber:
          row.rowNumber,

        field:
          "nomeSquadra",

        message:
          "Nome squadra obbligatorio.",
      });
    }

    if (
      ![
        "Portiere",
        "Difensore",
        "Attaccante",
      ].includes(
        row.ruolo,
      )
    ) {
      errors.push({
        rowNumber:
          row.rowNumber,

        field:
          "ruolo",

        message:
          'Il ruolo deve essere "Portiere", "Difensore" oppure "Attaccante".',
      });
    }

    if (
      !Number.isFinite(
        row.costo,
      ) ||
      row.costo <=
        0
    ) {
      errors.push({
        rowNumber:
          row.rowNumber,

        field:
          "costo",

        message:
          "Il costo deve essere un numero maggiore di 0.",
      });
    }

    return errors;
  }

  private static validateDuplicates(
    rows:
      FantasyPlayerPoolImportRow[],
    errors:
      FantasyPlayerPoolImportError[],
  ): void {
    const seen =
      new Map<
        string,
        number
      >();

    rows.forEach(
      (row) => {
        const key =
          row.playerSeasonCode
            .trim()
            .toLowerCase();

        const previousRow =
          seen.get(
            key,
          );

        if (
          previousRow !==
          undefined
        ) {
          errors.push({
            rowNumber:
              row.rowNumber,

            field:
              "playerSeasonCode",

            message:
              `playerSeasonCode duplicato. È già presente alla riga ${previousRow}.`,
          });

          return;
        }

        seen.set(
          key,
          row.rowNumber,
        );
      },
    );
  }

  private static toString(
    value:
      unknown,
  ): string {
    return String(
      value ??
        "",
    ).trim();
  }

  private static toNumber(
    value:
      unknown,
  ): number {
    if (
      typeof value ===
      "number"
    ) {
      return value;
    }

    const normalized =
      String(
        value ??
          "",
      )
        .trim()
        .replace(
          ",",
          ".",
        );

    if (
      !normalized
    ) {
      return Number.NaN;
    }

    return Number(
      normalized,
    );
  }

  private static normalizeRole(
    value:
      unknown,
  ): string {
    const role =
      this.toString(
        value,
      ).toLowerCase();

    switch (
      role
    ) {
      case "p":
      case "por":
      case "portiere":
        return "Portiere";

      case "d":
      case "dif":
      case "difensore":
        return "Difensore";

      case "a":
      case "att":
      case "attaccante":
        return "Attaccante";

      default:
        return this.toString(
          value,
        );
    }
  }
}