import { Field, Module, RecordLocation, convertCase } from "soiac";

export function toLowerCamelName(field: Field | string): string {
  const inputName = typeof field === "string" ? field : field.name.text;
  const convertCaseResult = convertCase(inputName, "lower_underscore", "lowerCamel");
  return (DART_KEYWORDS.has(convertCaseResult) || GENERATED_LOWER_CAMEL_SYMBOLS.has(convertCaseResult))
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

export function toEnumConstantName(field: Field): string {
  // TODO: fix
  return GENERATED_LOWER_CAMEL_SYMBOLS.has(field.name.text)
    ? field.name.text + "_"
    : field.name.text;
}

export interface ClassName {
  /** The name right after the 'class' keyword.. */
  name: string;
  /**
   * Fully qualified class name.
   * Examples: 'soiagen.Foo', 'soiagen.Foo.Bar'
   */
  qualifiedName: string;
}

const GENERATED_LOWER_CAMEL_SYMBOLS: ReadonlySet<string> = new Set([
  "hashCode",
  "defaultInstance",
  "mutable",
  "noSuchMethod",
  "runtimeType",
  "toFrozen",
  "toMutable",
  "toString",
]);
