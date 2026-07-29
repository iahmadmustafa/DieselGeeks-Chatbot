import ExcelJS from "exceljs";

import type { FitmentAuditRow } from "@/lib/fitment/audit";

import {
  FITMENT_AUDIT_HEADERS,
  fitmentAuditRowToCells,
  rowNeedsManualFitmentInput,
} from "./audit-sheet-export";

const HIGHLIGHT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF2CC" },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9E1F2" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
};

function applyRowFill(row: ExcelJS.Row, fill: ExcelJS.Fill): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill;
  });
}

function setColumnWidths(sheet: ExcelJS.Worksheet): void {
  const widths = [12, 42, 36, 48, 18, 16, 24, 18, 12, 28, 48];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

export async function writeFitmentAuditWorkbook(
  outputPath: string,
  rows: FitmentAuditRow[],
): Promise<{ highlighted_rows: number }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Diesel Geeks";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Fitment Audit", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headerRow = sheet.addRow([...FITMENT_AUDIT_HEADERS]);
  headerRow.height = 20;
  applyRowFill(headerRow, HEADER_FILL);
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "top", wrapText: true };
  });

  let highlightedRows = 0;

  for (const auditRow of rows) {
    const dataRow = sheet.addRow(fitmentAuditRowToCells(auditRow));
    dataRow.alignment = { vertical: "top", wrapText: true };

    if (rowNeedsManualFitmentInput(auditRow)) {
      applyRowFill(dataRow, HIGHLIGHT_FILL);
      highlightedRows += 1;
    }

    const editUrlCell = dataRow.getCell(3);
    if (typeof editUrlCell.value === "string" && editUrlCell.value.startsWith("http")) {
      editUrlCell.value = {
        text: "Edit in WooCommerce",
        hyperlink: editUrlCell.value,
      };
      editUrlCell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
  }

  setColumnWidths(sheet);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: FITMENT_AUDIT_HEADERS.length },
  };

  await workbook.xlsx.writeFile(outputPath);

  return { highlighted_rows: highlightedRows };
}
