// TODO: name collision toString
// TODO: name collistion String
// TODO: use named parameters in constructors
// TODO: in client, add a internal__frozenCopy which expects a transform function...
// TODO: in client, add a internal__MutableList class

import * as paths from "path";
import {
  type CodeGenerator,
  type Constant,
  type Field,
  type Method,
  type Module,
  type RecordKey,
  type RecordLocation,
  type ResolvedType,
  convertCase,
} from "soiac";
import { z } from "zod";
import { getModuleAlias, toLowerCamelName } from "./naming.js";
import { TypeSpeller } from "./type_speller.js";

const Config = z.object({});

type Config = z.infer<typeof Config>;

class DartCodeGenerator implements CodeGenerator<Config> {
  readonly id = "dart";
  readonly configType = Config;
  readonly version = "1.0.0";

  generateCode(input: CodeGenerator.Input<Config>): CodeGenerator.Output {
    const { recordMap, config } = input;
    const outputFiles: CodeGenerator.OutputFile[] = [];
    for (const module of input.modules) {
      outputFiles.push({
        path: module.path.replace(/\.soia$/, ".dart"),
        code: new DartSourceFileGenerator(module, recordMap, config).generate(),
      });
    }
    return { files: outputFiles };
  }
}

// Generates the code for one Dart file.
class DartSourceFileGenerator {
  constructor(
    private readonly inModule: Module,
    recordMap: ReadonlyMap<RecordKey, RecordLocation>,
    config: Config,
  ) {
    this.typeSpeller = new TypeSpeller(recordMap, inModule);
  }

  generate(): string {
    // http://patorjk.com/software/taag/#f=Doom&t=Do%20not%20edit
    this.push(
      `//  ______                        _               _  _  _
      //  |  _  \\                      | |             | |(_)| |
      //  | | | |  ___    _ __    ___  | |_    ___   __| | _ | |_
      //  | | | | / _ \\  | '_ \\  / _ \\ | __|  / _ \\ / _\` || || __|
      //  | |/ / | (_) | | | | || (_) || |_  |  __/| (_| || || |_ 
      //  |___/   \\___/  |_| |_| \\___/  \\__|  \\___| \\__,_||_| \\__|
      //

      // To install the Soia client library:
      //   dart pub add soia

      `,
    );

    this.writeImports();

    for (const record of this.inModule.records) {
      const { recordType } = record.record;
      this.pushEol();
      if (recordType === "struct") {
        this.writeClassesForStruct(record);
      } else {
        this.writeClassesForEnum(record);
      }
    }

    for (const method of this.inModule.methods) {
      this.writeMethod(method);
    }

    // for (const constant of this.inModule.constants) {
    //   this.writeConstant(constant);
    // }

    return this.joinLinesAndFixFormatting();
  }

  private writeClassesForStruct(struct: RecordLocation): void {
    const { typeSpeller } = this;
    const { fields } = struct.record;
    const className = typeSpeller.getClassName(struct);
    this.push(`sealed class ${className}_orMutable {\n`);
    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      const allRecordsFrozen = field.isRecursive === "hard";
      const type = typeSpeller.getDartType(
        field.type!,
        "maybe-mutable",
        allRecordsFrozen,
      );
      this.push(`${type} get ${fieldName};\n`);
    }
    if (fields.length) {
      this.pushEol();
    }
    this.push(
      `${className} toFrozen();\n`,
      "}\n\n", // class _orMutable
      `final class ${className} implements ${className}_orMutable {\n`,
    );

    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      const type = typeSpeller.getDartType(field.type!, "frozen");
      if (field.isRecursive === "hard") {
        this.push(`final ${type}? _rec_${fieldName};\n`);
        const defaultExpr = this.getDefaultExpression(field.type!).expression;
        this.push(`${type} get ${fieldName} => _rec_${fieldName} ?? ${defaultExpr};\n`);
      } else {
        this.push(`final ${type} ${fieldName};\n`);
      }
    }
    this.push(
      `_soia.UnrecognizedFields<${className}>? _unrecognizedFields;\n\n`,
    );

    // Public constructor
    this.push(`factory ${className}(`);
    this.push(fields.length ? "{\n" : "");
    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      const type = typeSpeller.getDartType(field.type!, "initializer");
      this.push(`required ${type} ${fieldName},\n`);
    }
    this.push(fields.length ? "}" : "");
    this.push(`) => ${className}._(\n`);
    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      const toFrozenExpr = this.toFrozenExpression(fieldName, field.type!);
      this.push(`${toFrozenExpr},\n`);
    }
    this.push(");\n\n");

    // Private constructor
    this.push(`${className}._(\n`);
    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      if (field.isRecursive === "hard") {
        this.push(`this._rec_${fieldName},\n`);
      } else {
        this.push(`this.${fieldName},\n`);
      }
    }
    this.push(");\n\n");

    this.push(`static final defaultInstance = ${className}._(\n`);
    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      if (field.isRecursive === "hard") {
        this.push("null,\n");
      } else {
        const defaultExpr = this.getDefaultExpression(field.type!).expression;
        this.push(`${defaultExpr},\n`);
      }
    }
    this.push(
      ");\n\n",
      `static ${className}_mutable mutable() => ${className}_mutable._(\n`);
    for (const field of fields) {
      const defaultExpr = this.getDefaultExpression(field.type!).expression;
      this.push(`${defaultExpr},\n`);
    }
    this.push(`);\n\n`);

    this.push(
      "@_core.deprecated\n",
      "@_core.override\n",
      `${className} toFrozen() => this;\n\n`,
      `${className}_mutable toMutable() => ${className}_mutable._(\n`,
    );
    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      this.push(`this.${fieldName},\n`);
    }
    this.push(");\n");

    this.push("}\n\n"); // class frozen

    this.push(
      `final class ${className}_mutable implements ${className}_orMutable {\n\n`,
    );
    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      const allRecordsFrozen = field.isRecursive === "hard";
      const type = typeSpeller.getDartType(
        field.type!,
        "maybe-mutable",
        allRecordsFrozen,
      );
      this.push(`${type} ${fieldName};\n`);
    }
    this.push(
      `_soia.UnrecognizedFields<${className}>? _unrecognizedFields;\n\n`,
      `${className}_mutable._(\n`);
    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      this.push(`this.${fieldName},\n`);
    }
    this.push(
      `);\n\n`,
      "@_core.override\n",
      `${className} toFrozen() => ${className}(\n`,
    );
    for (const field of fields) {
      const fieldName = toLowerCamelName(field);
      this.push(`${fieldName}: this.${fieldName},\n`);
    }
    this.push(
      ").._unrecognizedFields = this._unrecognizedFields;\n",
      "}\n\n", // class _mutable
    );
  }

  private writeClassesForEnum(record: RecordLocation): void {
    const { typeSpeller } = this;
    const { fields } = record.record;
    const className = typeSpeller.getClassName(record);
    this.push(`sealed class ${className} {\n`);
    this.push(`static const ${className} unknown = ${className}_unknown._();\n`);
    this.push(`${className}_kind get kind;\n`);
    this.push("}\n\n");  // class enum
    this.push(
      `final class ${className}_unknown implements ${className} {\n`,
      `const ${className}_unknown._();\n`,
      `${className}_kind get kind => ${className}_kind.constUnknown;\n`,
      "}\n\n");
    this.push(
      `enum ${className}_kind {\n`,
      "constUnknown,\n",
      "}\n\n");
    // const { recordMap } = typeSpeller;
    // const { fields } = record.record;
    // const constantFields = fields.filter((f) => !f.type);
    // const valueFields = fields.filter((f) => f.type);
    // const className = typeSpeller.getClassName(record);
    // this.push(`sealed class ${className} private constructor() {\n`);
    // this.push(`enum class Kind {\n`, `CONST_UNKNOWN,\n`);
    // for (const field of constantFields) {
    //   this.push(`CONST_${field.name.text},\n`);
    // }
    // for (const field of valueFields) {
    //   this.push(
    //     `VAL_${convertCase(field.name.text, "lower_underscore", "UPPER_UNDERSCORE")},\n`,
    //   );
    // }
    // this.push(
    //   "}\n\n",
    //   'class Unknown @kotlin.Deprecated("For internal use", kotlin.ReplaceWith("',
    //   qualifiedName,
    //   '.UNKNOWN")) internal constructor(\n',
    //   `internal val _unrecognized: _UnrecognizedEnum<${qualifiedName}>?,\n`,
    //   `) : ${qualifiedName}() {\n`,
    //   "override val kind get() = Kind.CONST_UNKNOWN;\n\n",
    //   "override fun equals(other: kotlin.Any?): kotlin.Boolean {\n",
    //   "return other is Unknown;\n",
    //   "}\n\n",
    //   "override fun hashCode(): kotlin.Int {\n",
    //   "return -900601970;\n",
    //   "}\n\n",
    //   "}\n\n", // class Unknown
    // );
    // for (const constField of constantFields) {
    //   const kindExpr = `Kind.CONST_${constField.name.text}`;
    //   const constantName = toEnumConstantName(constField);
    //   this.push(
    //     `object ${constantName} : ${qualifiedName}() {\n`,
    //     `override val kind get() = ${kindExpr};\n\n`,
    //     "init {\n",
    //     "maybeFinalizeSerializer();\n",
    //     "}\n",
    //     `}\n\n`, // object
    //   );
    // }
    // for (const valueField of valueFields) {
    //   const valueType = valueField.type!;
    //   const optionClassName =
    //     convertCase(valueField.name.text, "lower_underscore", "UpperCamel") +
    //     "Option";
    //   const initializerType = typeSpeller
    //     .getDartType(valueType, "initializer")
    //     .toString();
    //   const frozenType = typeSpeller
    //     .getDartType(valueType, "frozen")
    //     .toString();
    //   this.pushEol();
    //   if (initializerType === frozenType) {
    //     this.push(
    //       `class ${optionClassName}(\n`,
    //       `val value: ${initializerType},\n`,
    //       `) : ${qualifiedName}() {\n`,
    //     );
    //   } else {
    //     this.push(
    //       `class ${optionClassName} private constructor (\n`,
    //       `val value: ${frozenType},\n`,
    //       `) : ${qualifiedName}() {\n`,
    //       "constructor(\n",
    //       `value: ${initializerType},\n`,
    //       `): this(${this.toFrozenExpression("value", valueType)}) {}\n\n`,
    //     );
    //   }
    //   const kindExpr = `Kind.VAL_${convertCase(valueField.name.text, "lower_underscore", "UPPER_UNDERSCORE")}`;
    //   this.push(
    //     `override val kind get() = ${kindExpr};\n\n`,
    //     "override fun equals(other: kotlin.Any?): kotlin.Boolean {\n",
    //     `return other is ${qualifiedName}.${optionClassName} && value == other.value;\n`,
    //     "}\n\n",
    //     "override fun hashCode(): kotlin.Int {\n",
    //     "return this.value.hashCode() + ",
    //     String(simpleHash(valueField.name.text) | 0),
    //     ";\n",
    //     "}\n\n",
    //     "}\n\n", // class
    //   );
    // }
    // this.push(
    //   "abstract val kind: Kind;\n\n",
    //   "override fun toString(): kotlin.String {\n",
    //   "return land.soia.internal.toStringImpl(\n",
    //   "this,\n",
    //   `${qualifiedName}.serializerImpl,\n`,
    //   ")\n",
    //   "}\n\n",
    //   "companion object {\n",
    //   'val UNKNOWN = @kotlin.Suppress("DEPRECATION") Unknown(null);\n\n',
    // );
    // for (const valueField of valueFields) {
    //   const type = valueField.type!;
    //   if (type.kind !== "record") {
    //     continue;
    //   }
    //   const structLocation = typeSpeller.recordMap.get(type.key)!;
    //   const struct = structLocation.record;
    //   if (struct.recordType !== "struct") {
    //     continue;
    //   }
    //   const structClassName = getClassName(structLocation);
    //   const createFunName =
    //     "create" +
    //     convertCase(valueField.name.text, "lower_underscore", "UpperCamel");
    //   const optionClassName =
    //     convertCase(valueField.name.text, "lower_underscore", "UpperCamel") +
    //     "Option";
    //   this.push(
    //     '@kotlin.Suppress("UNUSED_PARAMETER")\n',
    //     `fun ${createFunName}(\n`,
    //     "_mustNameArguments: _MustNameArguments =\n_MustNameArguments,\n",
    //   );
    //   for (const field of struct.fields) {
    //     const fieldName = toLowerCamelName(field);
    //     const type = typeSpeller.getDartType(field.type!, "initializer");
    //     this.push(`${fieldName}: ${type},\n`);
    //   }
    //   this.push(
    //     `) = ${optionClassName}(\n`,
    //     `${structClassName.qualifiedName}(\n`,
    //   );
    //   for (const field of struct.fields) {
    //     const fieldName = toLowerCamelName(field);
    //     this.push(`${fieldName} = ${fieldName},\n`);
    //   }
    //   this.push(")\n", ");\n\n");
    // }
    // this.push(
    //   "private val serializerImpl =\n",
    //   `land.soia.internal.EnumSerializer.create<${qualifiedName}, Unknown>(\n`,
    //   `recordId = "${getRecordId(record)}",\n`,
    //   "unknownInstance = UNKNOWN,\n",
    //   'wrapUnrecognized = { @kotlin.Suppress("DEPRECATION") Unknown(it) },\n',
    //   "getUnrecognized = { it._unrecognized },\n)",
    //   ";\n\n",
    //   "val SERIALIZER = land.soia.internal.makeSerializer(serializerImpl);\n\n",
    //   "val TYPE_DESCRIPTOR get() = serializerImpl.typeDescriptor;\n\n",
    //   "init {\n",
    // );
    // for (const constField of constantFields) {
    //   this.push(toEnumConstantName(constField), ";\n");
    // }
    // this.push("maybeFinalizeSerializer();\n");
    // this.push(
    //   "}\n\n", // init
    //   `private var finalizationCounter = 0;\n\n`,
    //   "private fun maybeFinalizeSerializer() {\n",
    //   "finalizationCounter += 1;\n",
    //   `if (finalizationCounter == ${constantFields.length + 1}) {\n`,
    // );
    // for (const constField of constantFields) {
    //   this.push(
    //     "serializerImpl.addConstantField(\n",
    //     `${constField.number},\n`,
    //     `"${constField.name.text}",\n`,
    //     `${toEnumConstantName(constField)},\n`,
    //     ");\n",
    //   );
    // }
    // for (const valueField of valueFields) {
    //   const serializerExpression = typeSpeller.getSerializerExpression(
    //     valueField.type!,
    //   );
    //   const optionClassName =
    //     convertCase(valueField.name.text, "lower_underscore", "UpperCamel") +
    //     "Option";
    //   this.push(
    //     "serializerImpl.addValueField(\n",
    //     `${valueField.number},\n`,
    //     `"${valueField.name.text}",\n`,
    //     `${optionClassName}::class.java,\n`,
    //     `${serializerExpression},\n`,
    //     `{ ${optionClassName}(it) },\n`,
    //     ") { it.value };\n",
    //   );
    // }
    // for (const removedNumber of record.record.removedNumbers) {
    //   this.push(`serializerImpl.addRemovedNumber(${removedNumber});\n`);
    // }
    // this.push(
    //   "serializerImpl.finalizeEnum();\n",
    //   "}\n",
    //   "}\n", // maybeFinalizeSerializer
    //   "}\n\n", // companion object
    // );
  }

  private writeMethod(method: Method): void {
    const { typeSpeller } = this;
    const methodName = method.name.text;
    const requestType = typeSpeller.getDartType(method.requestType!, "frozen");
    const requestSerializerExpr = typeSpeller.getSerializerExpression(
      method.requestType!,
    );
    const responseType = typeSpeller.getDartType(
      method.responseType!,
      "frozen",
    );
    const responseSerializerExpr = typeSpeller.getSerializerExpression(
      method.responseType!,
    );
    this.push(
      `final _soia.Method<\n${requestType},\n${responseType}\n> ${methodName} = \n`,
      "_soia.Method(\n",
      `"${methodName}",\n`,
      `${method.number},\n`,
      requestSerializerExpr + ",\n",
      responseSerializerExpr + ",\n",
      ");\n\n",
    );
  }

  private writeConstant(constant: Constant): void {
    const { typeSpeller } = this;
    const name = constant.name.text;
    const type = typeSpeller.getDartType(constant.type!, "frozen");
    const serializerExpression = typeSpeller.getSerializerExpression(
      constant.type!,
    );
    const jsonStringLiteral = JSON.stringify(
      JSON.stringify(constant.valueAsDenseJson),
    );
    this.push(
      `val ${name}: ${type} by kotlin.lazy {\n`,
      serializerExpression,
      `.fromJsonCode(${jsonStringLiteral})\n`,
      "}\n\n",
    );
  }

  private getDefaultExpression(type: ResolvedType): {
    expression: string;
    isConst: boolean;
  } {
    switch (type.kind) {
      case "primitive": {
        switch (type.primitive) {
          case "bool":
            return { expression: "false", isConst: true };
          case "int32":
          case "int64":
          case "uint64":
            return { expression: "0", isConst: true };
          case "float32":
          case "float64":
            return { expression: "0.0", isConst: true };
          case "timestamp":
            return { expression: "_soia.unixEpoch", isConst: false };
          case "string":
            return { expression: '""', isConst: true };
          case "bytes":
            return { expression: "_soia.ByteString.empty", isConst: false };
        }
        break;
      }
      case "array": {
        const itemType = this.typeSpeller.getDartType(type.item, "frozen");
        return { expression: `_soia.KeyedIterable.empty`, isConst: true };
      }
      case "optional": {
        return { expression: "null", isConst: true };
      }
      case "record": {
        const record = this.typeSpeller.recordMap.get(type.key)!;
        const kotlinType = this.typeSpeller.getDartType(type, "frozen");
        switch (record.record.recordType) {
          case "struct": {
            return {
              expression: `${kotlinType}.defaultInstance`,
              isConst: false,
            };
          }
          case "enum": {
            return { expression: `${kotlinType}.unknown`, isConst: true };
          }
        }
        break;
      }
    }
  }

  private toFrozenExpression(inputExpr: string, type: ResolvedType): string {
    switch (type.kind) {
      case "primitive": {
        switch (type.primitive) {
          case "timestamp":
            return `${inputExpr}.toUtc()`;
          default:
            return inputExpr;
        }
      }
      case "array": {
        const itemToFrozenExpr = this.toFrozenExpression("it", type.item);
        if (type.key) {
          const path = type.key.path
            .map((f) => toLowerCamelName(f.name.text))
            .join(".");
          if (itemToFrozenExpr === "it") {
            return `_soia.internal__keyedCopy(${inputExpr}, "${path}", (it) => it.${path})`;
          } else {
            return `_soia.internal__keyedMappedCopy(${inputExpr}, "${path}", (it) => it.${path}, (it) => ${itemToFrozenExpr})`;
          }
        } else {
          if (itemToFrozenExpr === "it") {
            return `_soia.internal__frozenCopy(${inputExpr})`;
          } else {
            return `_soia.internal__frozenMappedCopy(${inputExpr}, (it) => ${itemToFrozenExpr})`;
          }
        }
      }
      case "optional": {
        const otherExpr = this.toFrozenExpression(inputExpr, type.other);
        if (otherExpr === inputExpr) {
          return otherExpr;
        } else {
          return `(${inputExpr} != null) ? ${otherExpr} : null`;
        }
      }
      case "record": {
        const record = this.typeSpeller.recordMap.get(type.key)!;
        if (record.record.recordType === "struct") {
          return `${inputExpr}.toFrozen()`;
        } else {
          return inputExpr;
        }
      }
    }
  }

  private writeImports(): void {
    this.push('import "dart:core" as _core;\n');
    this.push('import "package:soia/soia.dart" as _soia;\n');

    if (this.inModule.pathToImportedNames.length) {
      this.pushEol();
    }

    const thisPath = paths.dirname(this.inModule.path);
    for (const path of Object.keys(this.inModule.pathToImportedNames)) {
      let dartPath = paths.relative(thisPath, path).replace(/\.soia/, ".dart");
      if (!dartPath.startsWith(".")) {
        dartPath = `./${dartPath}`;
      }
      const alias = getModuleAlias(path);
      this.push(`import "${dartPath}" as ${alias};\n`);
    }
    this.pushEol();
  }

  private push(...code: string[]): void {
    this.code += code.join("");
  }

  private pushEol(): void {
    this.code += "\n";
  }

  private joinLinesAndFixFormatting(): string {
    const indentUnit = "  ";
    let result = "";
    // The indent at every line is obtained by repeating indentUnit N times,
    // where N is the length of this array.
    const contextStack: Array<"{" | "(" | "[" | "<" | ":" | "."> = [];
    // Returns the last element in `contextStack`.
    const peakTop = (): string => contextStack.at(-1)!;
    const getMatchingLeftBracket = (r: "}" | ")" | "]" | ">"): string => {
      switch (r) {
        case "}":
          return "{";
        case ")":
          return "(";
        case "]":
          return "[";
        case ">":
          return "<";
      }
    };
    for (let line of this.code.split("\n")) {
      line = line.trim();
      if (line.length <= 0) {
        // Don't indent empty lines.
        result += "\n";
        continue;
      }

      const firstChar = line[0];
      switch (firstChar) {
        case "}":
        case ")":
        case "]":
        case ">": {
          const left = getMatchingLeftBracket(firstChar);
          while (contextStack.pop() !== left) {
            if (contextStack.length <= 0) {
              throw Error();
            }
          }
          break;
        }
        case ".": {
          if (peakTop() !== ".") {
            contextStack.push(".");
          }
          break;
        }
      }
      const indent = indentUnit.repeat(contextStack.length);
      result += `${indent}${line.trimEnd()}\n`;
      if (line.startsWith("//")) {
        continue;
      }
      const lastChar = line.slice(-1);
      switch (lastChar) {
        case "{":
        case "(":
        case "[":
        case "<": {
          // The next line will be indented
          contextStack.push(lastChar);
          break;
        }
        case ":":
        case "=": {
          if (peakTop() !== ":") {
            contextStack.push(":");
          }
          break;
        }
        case ";":
        case ",": {
          if (peakTop() === "." || peakTop() === ":") {
            contextStack.pop();
          }
        }
      }
    }

    return (
      result
        // Remove spaces enclosed within curly brackets if that's all there is.
        .replace(/\{\s+\}/g, "{}")
        // Remove spaces enclosed within round brackets if that's all there is.
        .replace(/\(\s+\)/g, "()")
        // Remove spaces enclosed within square brackets if that's all there is.
        .replace(/\[\s+\]/g, "[]")
        // Remove empty line following an open curly bracket.
        .replace(/(\{\n *)\n/g, "$1")
        // Remove empty line preceding a closed curly bracket.
        .replace(/\n(\n *\})/g, "$1")
        // Coalesce consecutive empty lines.
        .replace(/\n\n\n+/g, "\n\n")
        .replace(/\n\n$/g, "\n")
    );
  }

  private readonly typeSpeller: TypeSpeller;
  private code = "";
}

function getRecordId(struct: RecordLocation): string {
  const modulePath = struct.modulePath;
  const qualifiedRecordName = struct.recordAncestors
    .map((r) => r.name.text)
    .join(".");
  return `${modulePath}:${qualifiedRecordName}`;
}

export const GENERATOR = new DartCodeGenerator();
