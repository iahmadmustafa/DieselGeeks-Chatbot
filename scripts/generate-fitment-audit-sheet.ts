/**
 * Generate a content-team fitment audit CSV from the Redis catalog snapshot.
 *
 * Usage:
 *   npm run generate-fitment-audit-sheet
 *   npm run generate-fitment-audit-sheet -- --out context/fitment-audit-sheet.csv
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { collectFitmentAuditRows } from "../src/lib/fitment/audit";
import { writeFitmentAuditWorkbook } from "../src/lib/fitment/audit-sheet-export-xlsx";
import {
  FITMENT_AUDIT_HEADERS,
  fitmentAuditRowToCells,
  rowNeedsManualFitmentInput,
} from "../src/lib/fitment/audit-sheet-export";
import { loadEnvLocal } from "../src/lib/env/load-env-local";
import { readEnv } from "../src/lib/env/read-env";
import { loadCurrentSnapshot } from "../src/lib/sync/run-sync";
import { enrichAuditRowsFromVehicleData } from "../src/lib/vehicle-lookup/enrich-audit-rows";
import { loadVehicleSpreadsheetData } from "../src/lib/vehicle-lookup/load-spreadsheets";

function adminEditUrl(productId: number): string {
  const baseUrl = (readEnv("WOOCOMMERCE_URL") ?? "https://stage2.dieselgeeks.com.au").replace(
    /\/$/,
    "",
  );
  return `${baseUrl}/wp-admin/post.php?post=${productId}&action=edit`;
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function resolveOutputPaths(outArg: string | undefined): { csvPath: string; xlsxPath: string } {
  const csvPath = outArg ?? path.join("context", "fitment-audit-sheet.csv");
  const extension = path.extname(csvPath);

  if (extension.toLowerCase() === ".xlsx") {
    return {
      csvPath: csvPath.replace(/\.xlsx$/i, ".csv"),
      xlsxPath: csvPath,
    };
  }

  return {
    csvPath,
    xlsxPath: csvPath.replace(/\.csv$/i, ".xlsx"),
  };
}

async function main(): Promise<void> {
  loadEnvLocal();

  const outArgIndex = process.argv.indexOf("--out");
  const outArg = outArgIndex !== -1 ? process.argv[outArgIndex + 1] : undefined;
  const { csvPath, xlsxPath } = resolveOutputPaths(outArg);

  const snapshot = await loadCurrentSnapshot();
  if (!snapshot) {
    console.error("No snapshot found in Redis. Run GET /api/sync first.");
    process.exit(1);
  }

  const spreadsheetData = loadVehicleSpreadsheetData(path.join("context", "vehicles"));
  const baseRows = collectFitmentAuditRows(snapshot.products, adminEditUrl);
  const { rows, stats } = enrichAuditRowsFromVehicleData(baseRows, spreadsheetData);

  const missingYearRangeRows = rows.filter((row) => row.issue_type === "Missing Year Range");
  const prefilledMissingYearRangeRows = missingYearRangeRows.filter((row) =>
    row.year_range.trim(),
  ).length;
  const manualInputRows = rows.filter((row) => rowNeedsManualFitmentInput(row));

  const csvLines = [
    FITMENT_AUDIT_HEADERS.join(","),
    ...rows.map((row) =>
      fitmentAuditRowToCells(row)
        .map((value) => (typeof value === "number" ? String(value) : escapeCsv(value)))
        .join(","),
    ),
  ];

  await writeFile(csvPath, `\uFEFF${csvLines.join("\n")}\n`, "utf8");

  const { highlighted_rows: highlightedRows } = await writeFitmentAuditWorkbook(xlsxPath, rows);

  const summary = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.issue_type] = (acc[row.issue_type] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Wrote ${rows.length} products to ${csvPath}`);
  console.log(`Wrote highlighted workbook to ${xlsxPath}`);
  console.log(
    JSON.stringify(
      {
        snapshot_synced_at: snapshot.synced_at,
        product_count: snapshot.product_count,
        audit_rows: rows.length,
        vehicle_spec_rows: spreadsheetData.vehicle_specs.length,
        part_spec_rows: spreadsheetData.part_specs.length,
        missing_year_range_rows: missingYearRangeRows.length,
        prefilled_missing_year_range_rows: prefilledMissingYearRangeRows,
        manual_input_rows: manualInputRows.length,
        highlighted_rows: highlightedRows,
        enrichment: stats,
        by_issue_type: summary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
