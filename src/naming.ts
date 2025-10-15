import { Constant, Field, Module, RecordLocation, convertCase } from "soiac";

export function structFieldToDartName(field: Field | string): string {
  const soiaName = typeof field === "string" ? field : field.name.text;
  const convertCaseResult = convertCase(
    soiaName,
    "lower_underscore",
    "lowerCamel",
  );
  return DART_KEYWORDS.has(convertCaseResult) ||
    DART_OBJECT_SYMBOLS.has(convertCaseResult) ||
    GENERATED_STRUCT_SYMBOLS.has(convertCaseResult)
    ? convertCaseResult + "_"
    : convertCaseResult;
}

export function enumFieldToDartName(field: Field): string {
  const soiaName = field.name.text;
  const convertCaseResult = convertCase(
    soiaName,
    field.type ? "lower_underscore" : "UPPER_UNDERSCORE",
    "lowerCamel",
  );
  return DART_KEYWORDS.has(convertCaseResult) ||
    DART_OBJECT_SYMBOLS.has(convertCaseResult) ||
    GENERATED_ENUM_SYMBOLS.has(convertCaseResult) ||
    soiaName.startsWith("wrap_") ||
    soiaName.startsWith("create_")
    ? convertCaseResult + "_"
    : convertCaseResult;
}

export function toLowerCamel(field: Field): string {
  const soiaName = field.name.text;
  return convertCase(
    soiaName,
    field.type ? "lower_underscore" : "UPPER_UNDERSCORE",
    "lowerCamel",
  );
}

export function toUpperCamel(field: Field): string {
  const soiaName = field.name.text;
  return convertCase(
    soiaName,
    field.type ? "lower_underscore" : "UPPER_UNDERSCORE",
    "UpperCamel",
  );
}

export function toTopLevelConstantName(constant: Constant): string {
  const soiaName = constant.name.text;
  const convertCaseResult = convertCase(
    soiaName,
    "UPPER_UNDERSCORE",
    "lowerCamel",
  );
  return DART_KEYWORDS.has(convertCaseResult)
    ? convertCaseResult + "_"
    : convertCaseResult;
}

/** Returns the name of the frozen Dart class for the given record. */
export function getClassName(
  record: RecordLocation,
  origin: {
    origin: Module;
  },
): string {
  const { recordAncestors } = record;
  const parts: string[] = [];
  for (let i = 0; i < recordAncestors.length; ++i) {
    const record = recordAncestors[i]!;
    parts.push(record.name.text);
  }

  const name = parts.join("_");

  if (origin.origin.path === record.modulePath) {
    return name;
  } else {
    const alias = getModuleAlias(record.modulePath);
    return `${alias}.${name}`;
  }
}

export function getModuleAlias(modulePath: string): string {
  return "_lib_" + modulePath.replace(/\.soia$/, "").replace("/", "_");
}

const DART_KEYWORDS: ReadonlySet<string> = new Set([
  "abstract",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "covariant",
  "default",
  "deferred",
  "do",
  "dynamic",
  "else",
  "enum",
  "export",
  "extends",
  "extension",
  "external",
  "factory",
  "false",
  "final",
  "finally",
  "for",
  "Function",
  "get",
  "hide",
  "if",
  "implements",
  "import",
  "in",
  "interface",
  "is",
  "late",
  "library",
  "mixin",
  "new",
  "null",
  "on",
  "operator",
  "part",
  "required",
  "rethrow",
  "return",
  "set",
  "show",
  "static",
  "super",
  "switch",
  "sync",
  "this",
  "throw",
  "true",
  "try",
  "typedef",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

const DART_OBJECT_SYMBOLS: ReadonlySet<string> = new Set([
  "hashCode",
  "noSuchMethod",
  "runtimeType",
  "toString",
]);

const GENERATED_STRUCT_SYMBOLS: ReadonlySet<string> = new Set([
  "defaultInstance",
  "mutable",
  "serializer",
  "toFrozen",
  "toMutable",
]);

const GENERATED_ENUM_SYMBOLS: ReadonlySet<string> = new Set([
  "isUnknown",
  "kind",
  "serializer",
]);
