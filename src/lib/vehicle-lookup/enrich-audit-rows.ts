import { refreshAuditRowIssueType, type FitmentAuditRow } from "@/lib/fitment/audit";
import { inferDieselFuelTypeFromEngineCodes } from "@/lib/fitment/infer-diesel-fuel-type";

import {
  buildPartNumberIndex,
  enrichRowsByPartNumber,
  enrichRowsByPartNumberEnhanced,
} from "./match-by-part-number";
import { enrichMissingYearRangeRows } from "./match-year-ranges";
import type { VehicleSpreadsheetData } from "./types";

export interface AuditEnrichmentStats {
  pass1_filled: number;
  pass2_filled: number;
  pass3_filled: number;
  diesel_fuel_type_filled: number;
  total_prefilled: number;
  blank_year_range_after: number;
}

function countPrefilled(rows: FitmentAuditRow[]): number {
  return rows.filter((row) => row.year_range.trim()).length;
}

export function enrichDieselFuelTypeRows(rows: FitmentAuditRow[]): {
  rows: FitmentAuditRow[];
  filled_count: number;
} {
  let filledCount = 0;

  const enrichedRows = rows.map((row) => {
    if (row.fuel_type.trim()) {
      return row;
    }

    const inferred = inferDieselFuelTypeFromEngineCodes(row.engine_code);
    if (!inferred) {
      return row;
    }

    filledCount += 1;
    return {
      ...row,
      fuel_type: inferred,
    };
  });

  return { rows: enrichedRows, filled_count: filledCount };
}

/** Run make/model/engine enrichment, then part-number passes for remaining blanks. */
export function enrichAuditRowsFromVehicleData(
  rows: FitmentAuditRow[],
  data: VehicleSpreadsheetData,
): { rows: FitmentAuditRow[]; stats: AuditEnrichmentStats } {
  const afterPass1 = enrichMissingYearRangeRows(rows, data.vehicle_specs);
  const pass1Filled = countPrefilled(afterPass1) - countPrefilled(rows);

  const partIndex = buildPartNumberIndex(data.part_specs);
  const { rows: afterPass2, filled_count: pass2Filled } = enrichRowsByPartNumber(
    afterPass1,
    partIndex,
  );

  const { rows: afterPass3, filled_count: pass3Filled } = enrichRowsByPartNumberEnhanced(
    afterPass2,
    partIndex,
    data.known_part_numbers,
  );

  const { rows: afterFuelType, filled_count: dieselFuelTypeFilled } =
    enrichDieselFuelTypeRows(afterPass3);

  const finalRows = afterFuelType.map(refreshAuditRowIssueType);

  const totalPrefilled = countPrefilled(finalRows);
  const blankYearRangeAfter = finalRows.filter((row) => !row.year_range.trim()).length;

  return {
    rows: finalRows,
    stats: {
      pass1_filled: pass1Filled,
      pass2_filled: pass2Filled,
      pass3_filled: pass3Filled,
      diesel_fuel_type_filled: dieselFuelTypeFilled,
      total_prefilled: totalPrefilled,
      blank_year_range_after: blankYearRangeAfter,
    },
  };
}
