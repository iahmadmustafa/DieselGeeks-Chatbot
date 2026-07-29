import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import {
  collectSpreadsheetPartNumbers,
  isCatalogPartNumber,
  normalizePartNumber,
} from "./extract-part-numbers";
import { normalizeMake, parseYear } from "./normalize";
import type {
  VehiclePartSpecRow,
  VehicleSpecRow,
  VehicleSpreadsheetData,
} from "./types";

const METADATA_COLUMN_PATTERN =
  /^(make\s*|model(\s+designation)?|engine(\s+capacity)?|year|change over year.*|vin look up system|back up method.*)$/i;

function readCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function inferMakeFromModel(model: string): string {
  const normalized = normalizeMake(model);
  if (normalized.includes("dmax") || normalized.includes("mux")) {
    return "Isuzu";
  }
  if (
    normalized.includes("hilux") ||
    normalized.includes("prado") ||
    normalized.includes("landcruiser")
  ) {
    return "Toyota";
  }
  return "";
}

function rowToVehicleSpec(
  make: string,
  model: string,
  designation: string,
  engine: string,
  year: number,
): VehicleSpecRow {
  return {
    make: make || inferMakeFromModel(model),
    model,
    designation,
    engine,
    year,
  };
}

function isPartColumn(columnName: string): boolean {
  return !METADATA_COLUMN_PATTERN.test(columnName.trim());
}

function rowToVehicleSpecRow(row: Record<string, unknown>): VehicleSpecRow | null {
  const make = readCell(row, "Make", "Make ");
  const model = readCell(row, "Model");
  const designation = readCell(row, "Model Designation");
  const engine = readCell(row, "Engine");
  const year = parseYear(row.Year);

  if (!model || !engine || year === null) {
    return null;
  }

  return rowToVehicleSpec(make, model, designation, engine, year);
}

function rowToPartSpecRows(
  row: Record<string, unknown>,
  allowedExact: ReadonlySet<string>,
): VehiclePartSpecRow[] {
  const make = readCell(row, "Make", "Make ");
  const model = readCell(row, "Model");
  const designation = readCell(row, "Model Designation");
  const engine = readCell(row, "Engine");
  const year = parseYear(row.Year);

  if (!model || !engine || year === null) {
    return [];
  }

  const vehicleSpec = rowToVehicleSpec(make, model, designation, engine, year);
  const partSpecs: VehiclePartSpecRow[] = [];

  for (const [columnName, value] of Object.entries(row)) {
    if (!isPartColumn(columnName)) {
      continue;
    }

    const rawPartNumber =
      typeof value === "string"
        ? value.trim()
        : typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : "";

    if (!isCatalogPartNumber(rawPartNumber, allowedExact)) {
      continue;
    }

    partSpecs.push({
      ...vehicleSpec,
      part_number: normalizePartNumber(rawPartNumber),
      part_column: columnName.trim(),
    });
  }

  return partSpecs;
}

/** Load vehicle-year rows and part-number links from the part-selection spreadsheets. */
export function loadVehicleSpreadsheetData(directoryPath: string): VehicleSpreadsheetData {
  const files = readdirSync(directoryPath).filter((name) => name.toLowerCase().endsWith(".xlsx"));
  const allRows: Record<string, unknown>[] = [];

  for (const fileName of files) {
    const filePath = path.join(directoryPath, fileName);
    const workbook = XLSX.read(readFileSync(filePath), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];

    if (!sheet) {
      continue;
    }

    allRows.push(...XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }));
  }

  const knownPartNumbers = collectSpreadsheetPartNumbers(allRows, isPartColumn);
  const vehicleSpecs: VehicleSpecRow[] = [];
  const partSpecs: VehiclePartSpecRow[] = [];

  for (const row of allRows) {
    const vehicleSpec = rowToVehicleSpecRow(row);
    if (vehicleSpec) {
      vehicleSpecs.push(vehicleSpec);
    }

    partSpecs.push(...rowToPartSpecRows(row, knownPartNumbers));
  }

  return {
    vehicle_specs: vehicleSpecs,
    part_specs: partSpecs,
    known_part_numbers: knownPartNumbers,
  };
}

/** Load all vehicle-year rows from the part-selection spreadsheets. */
export function loadVehicleSpecsFromDirectory(directoryPath: string): VehicleSpecRow[] {
  return loadVehicleSpreadsheetData(directoryPath).vehicle_specs;
}
