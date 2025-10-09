import { Field, RecordLocation, convertCase } from "soiac";

export class Namer {
  private readonly genPackageFirstName: string;

  constructor(private readonly packagePrefix: string) {
    if (packagePrefix.length <= 0) {
      this.genPackageFirstName = "soiagen";
    } else {
      this.genPackageFirstName = packagePrefix.split(".")[0]!;
    }
  }

  toLowerCamelName(field: Field | string): string {
    const inputName = typeof field === "string" ? field : field.name.text;
    const nameConflict =
      KOTLIN_HARD_KEYWORDS.has(inputName) ||
      TOP_LEVEL_PACKAGE_NAMES.has(inputName) ||
      inputName === this.genPackageFirstName;
    return nameConflict
      ? inputName + "_"
      : convertCase(inputName, "lower_underscore", "lowerCamel");
  }

  /** Returns the name of the frozen Kotlin class for the given record. */
  getClassName(record: RecordLocation): ClassName {
    const { recordAncestors } = record;
    const parts: string[] = [];
    for (let i = 0; i < recordAncestors.length; ++i) {
      const record = recordAncestors[i]!;
      let name = record.name.text;
      const parentType = i > 0 ? recordAncestors[i - 1]!.recordType : undefined;
      if (
        (parentType === "struct" && STRUCT_NESTED_TYPE_NAMES.has(name)) ||
        (parentType === "enum" &&
          (ENUM_NESTED_TYPE_NAMES.has(name) || /[^a-z]Option$/.test(name)))
      ) {
        name += "_";
      }
      parts.push(name);
    }

    const name = parts.at(-1)!;

    const path = record.modulePath;
    const importPath = path.replace(/\.soia$/, "").replace("/", ".");
    const qualifiedName = `${this.packagePrefix}soiagen.${importPath}.${parts.join(".")}`;

    return { name, qualifiedName };
  }
}

const KOTLIN_HARD_KEYWORDS: ReadonlySet<string> = new Set([
  "abstract",
  "annotation",
  "as",
  "break",
  "catch",
  "class",
  "const",
  "continue",
  "crossinline",
  "data",
  "else",
  "enum",
  "external",
  "final",
  "finally",
  "for",
  "fun",
  "if",
  "import",
  "in",
  "inline",
  "interface",
  "internal",
  "is",
  "lateinit",
  "noinline",
  "object",
  "open",
  "operator",
  "override",
  "package",
  "private",
  "protected",
  "public",
  "reified",
  "return",
  "sealed",
  "super",
  "suspend",
  "this",
  "throw",
  "try",
  "typealias",
  "val",
  "var",
  "when",
  "while",
]);

const TOP_LEVEL_PACKAGE_NAMES: ReadonlySet<string> = new Set<string>([
  "java",
  "kotlin",
  "okio",
]);

export function toEnumConstantName(field: Field): string {
  return RECORD_GENERATED_CONSTANT_NAMES.has(field.name.text)
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

/** Generated types nested within a struct class. */
const STRUCT_NESTED_TYPE_NAMES: ReadonlySet<string> = new Set(["Mutable"]);

/** Generated types nested within an enum class. */
const ENUM_NESTED_TYPE_NAMES: ReadonlySet<string> = new Set([
  "Kind",
  "Unknown",
]);

const RECORD_GENERATED_CONSTANT_NAMES: ReadonlySet<string> = new Set([
  "SERIALIZER",
  "TYPE_DESCRIPTOR",
]);
