import {
  Constant,
  Field,
  Module,
  RecordLocation,
  convertCase,
} from "skir-internal";

export function structFieldToDartName(field: Field | string): string {
  const skirName = typeof field === "string" ? field : field.name.text;
  const convertCaseResult = convertCase(skirName, "lowerCamel");
  return DART_KEYWORDS.has(convertCaseResult) ||
    DART_OBJECT_SYMBOLS.has(convertCaseResult) ||
    GENERATED_STRUCT_SYMBOLS.has(convertCaseResult) ||
    skirName.startsWith("mutable_")
    ? convertCaseResult + "_"
    : convertCaseResult;
}

export function enumVariantToDartName(variant: Field): string {
  const skirName = variant.name.text;
  const convertCaseResult = convertCase(skirName, "lowerCamel");
  return DART_KEYWORDS.has(convertCaseResult) ||
    DART_OBJECT_SYMBOLS.has(convertCaseResult) ||
    GENERATED_ENUM_SYMBOLS.has(convertCaseResult) ||
    skirName.startsWith("wrap_") ||
    skirName.startsWith("create_")
    ? convertCaseResult + "_"
    : convertCaseResult;
}

export function toLowerCamel(field: Field): string {
  const skirName = field.name.text;
  return convertCase(skirName, "lowerCamel");
}

export function toUpperCamel(field: Field): string {
  const skirName = field.name.text;
  return convertCase(skirName, "UpperCamel");
}

export function toTopLevelConstantName(constant: Constant): string {
  const skirName = constant.name.text;
  const convertCaseResult = convertCase(skirName, "lowerCamel");
  return DART_KEYWORDS.has(convertCaseResult) || skirName.endsWith("_METHOD")
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
  return (
    "_lib_" +
    modulePath
      .replace(/\.skir$/, "")
      .replace(/^@/, "external/")
      .replace(/[/-]/g, "_")
  );
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
