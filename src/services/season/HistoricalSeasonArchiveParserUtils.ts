import * as XLSX from "xlsx";

/*
 * ============================================================
 * LETTURA FOGLIO STANDARD
 * ============================================================
 *
 * Riga 1 = titolo
 * Riga 2 = descrizione
 * Riga 3 = vuota
 * Riga 4 = intestazioni
 * Riga 5+ = dati
 * ============================================================
 */

export function readSheetRows(
  workbook:
    XLSX.WorkBook,

  sheetName:
    string,
): Record<
  string,
  unknown
>[] {
  const worksheet =
    workbook.Sheets[
      sheetName
    ];

  if (
    !worksheet
  ) {
    throw new Error(
      `Foglio "${sheetName}" non trovato.`,
    );
  }

  return sheetToRows(
    worksheet,
  );
}

/*
 * ============================================================
 * WORKSHEET → ROW OBJECTS
 * ============================================================
 */

export function sheetToRows(
  worksheet:
    XLSX.WorkSheet,
): Record<
  string,
  unknown
>[] {
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
          true,
      },
    );

  const headerRow =
    matrix[3];

  if (
    !headerRow
  ) {
    return [];
  }

  const headers =
    headerRow.map(
      (
        value,
      ) =>
        cleanString(
          value,
        ),
    );

  const dataRows =
    matrix.slice(
      4,
    );

  const result:
    Record<
      string,
      unknown
    >[] = [];

  for (
    const row of
      dataRows
  ) {
    const hasContent =
      row.some(
        (
          value,
        ) =>
          cleanString(
            value,
          ) !== "",
      );

    if (
      !hasContent
    ) {
      continue;
    }

    const object:
      Record<
        string,
        unknown
      > = {};

    headers.forEach(
      (
        header,
        index,
      ) => {
        if (
          !header
        ) {
          return;
        }

        object[
          header
        ] =
          row[index] ??
          "";
      },
    );

    result.push(
      object,
    );
  }

  return result;
}

/*
 * ============================================================
 * STRINGHE
 * ============================================================
 */

export function cleanString(
  value:
    unknown,
): string {
  return String(
    value ??
      "",
  ).trim();
}

export function optionalString(
  value:
    unknown,
):
  | string
  | undefined {
  const text =
    cleanString(
      value,
    );

  return (
    text ||
    undefined
  );
}

export function requiredString(
  value:
    unknown,

  field:
    string,

  sheet:
    string,

  rowIndex?:
    number,
): string {
  const text =
    optionalString(
      value,
    );

  if (
    !text
  ) {
    throw createFieldError(
      sheet,
      field,
      rowIndex,
    );
  }

  return text;
}

/*
 * ============================================================
 * NUMERI
 * ============================================================
 */

export function optionalNumber(
  value:
    unknown,
):
  | number
  | undefined {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return undefined;
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  const number =
    Number(
      cleanString(
        value,
      ).replace(
        ",",
        ".",
      ),
    );

  return Number.isFinite(
    number,
  )
    ? number
    : undefined;
}

export function numberOrZero(
  value:
    unknown,
): number {
  return (
    optionalNumber(
      value,
    ) ??
    0
  );
}

/*
 * ============================================================
 * INTERI
 * ============================================================
 */

export function optionalInteger(
  value:
    unknown,
):
  | number
  | undefined {
  const number =
    optionalNumber(
      value,
    );

  if (
    number ===
    undefined
  ) {
    return undefined;
  }

  if (
    !Number.isInteger(
      number,
    )
  ) {
    return undefined;
  }

  return number;
}

export function requiredInteger(
  value:
    unknown,

  field:
    string,

  sheet:
    string,

  rowIndex?:
    number,
): number {
  const number =
    optionalInteger(
      value,
    );

  if (
    number ===
    undefined
  ) {
    throw createFieldError(
      sheet,
      field,
      rowIndex,
    );
  }

  return number;
}

export function integerOrZero(
  value:
    unknown,
): number {
  return (
    optionalInteger(
      value,
    ) ??
    0
  );
}

/*
 * ============================================================
 * NORMALIZZAZIONE TESTO
 * ============================================================
 */

export function normalizeText(
  value:
    string,
) {
  return value
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
      /\s+/g,
      " ",
    );
}

/*
 * ============================================================
 * DATE EXCEL
 * ============================================================
 */

export function excelDateToIso(
  value:
    unknown,
):
  | string
  | undefined {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return undefined;
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    const parsed =
      XLSX.SSF.parse_date_code(
        value,
      );

    if (
      !parsed
    ) {
      return undefined;
    }

    return [
      String(
        parsed.y,
      ).padStart(
        4,
        "0",
      ),

      String(
        parsed.m,
      ).padStart(
        2,
        "0",
      ),

      String(
        parsed.d,
      ).padStart(
        2,
        "0",
      ),
    ].join(
      "-",
    );
  }

  return optionalString(
    value,
  );
}

/*
 * ============================================================
 * ORARI EXCEL
 * ============================================================
 */

export function excelTimeToText(
  value:
    unknown,
):
  | string
  | undefined {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return undefined;
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    const totalMinutes =
      Math.round(
        value *
          24 *
          60,
      );

    const hours =
      Math.floor(
        totalMinutes /
          60,
      ) %
      24;

    const minutes =
      totalMinutes %
      60;

    return `${String(
      hours,
    ).padStart(
      2,
      "0",
    )}:${String(
      minutes,
    ).padStart(
      2,
      "0",
    )}`;
  }

  return optionalString(
    value,
  );
}

/*
 * ============================================================
 * ERRORI CAMPI
 * ============================================================
 */

export function createFieldError(
  sheet:
    string,

  field:
    string,

  rowIndex?:
    number,
) {
  const excelRow =
    rowIndex !==
    undefined
      ? rowIndex +
        5
      : undefined;

  return new Error(
    excelRow
      ? `Foglio "${sheet}", riga ${excelRow}: campo "${field}" mancante o non valido.`
      : `Foglio "${sheet}": campo "${field}" mancante o non valido.`,
  );
}