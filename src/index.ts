// TODO: unit tests
// TODO: I think in method generation, I want to add the "Method" suffix
// TODO: set up pre-commit hook

import * as paths from "path";
import {
  type CodeGenerator,
  type Constant,
  type Method,
  type Module,
  type RecordKey,
  type RecordLocation,
  type ResolvedType,
} from "soiac";
import { z } from "zod";
import {
  enumFieldToDartName,
  getModuleAlias,
  structFieldToDartName,
  toLowerCamel,
  toTopLevelConstantName,
  toUpperCamel,
} from "./naming.js";
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

    for (const constant of this.inModule.constants) {
      this.writeConstant(constant);
    }

    return this.joinLinesAndFixFormatting();
  }

  private writeClassesForStruct(struct: RecordLocation): void {
    const { typeSpeller } = this;
    const { fields } = struct.record;
    const className = typeSpeller.getClassName(struct);
    this.push(
      `${DartSourceFileGenerator.SEPARATOR}\n`,
      `// struct ${className.replace("_", ".")}\n`,
      `${DartSourceFileGenerator.SEPARATOR}\n\n`,
      `sealed class ${className}_orMutable {\n`,
    );
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      const allRecordsFrozen = field.isRecursive === "hard";
      const type = field.type!;
      const dartType = typeSpeller.getDartType(
        type,
        "maybe-mutable",
        allRecordsFrozen,
      );
      this.push(`${dartType} get ${dartName};\n`);
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
      const dartName = structFieldToDartName(field);
      const type = field.type!;
      const dartType = typeSpeller.getDartType(type, "frozen");
      if (field.isRecursive === "hard") {
        this.push(`final ${dartType}? _rec_${dartName};\n`);
        const defaultExpr = this.getDefaultExpression(type).expression;
        this.push(
          `${dartType} get ${dartName} => _rec_${dartName} ?? ${defaultExpr};\n`,
        );
      } else {
        this.push(`final ${dartType} ${dartName};\n`);
      }
    }
    this.push(`_soia.internal__UnrecognizedFields? _u;\n\n`);

    // Public constructor
    this.push(`factory ${className}(`);
    this.push(fields.length ? "{\n" : "");
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      const dartType = typeSpeller.getDartType(field.type!, "initializer");
      this.push(`required ${dartType} ${dartName},\n`);
    }
    this.push(fields.length ? "}" : "");
    this.push(`) => ${className}._(\n`);
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      const toFrozenExpr = this.toFrozenExpression(dartName, field.type!);
      this.push(`${toFrozenExpr},\n`);
    }
    this.push(");\n\n");

    // Private constructor
    this.push(`${className}._(\n`);
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      if (field.isRecursive === "hard") {
        this.push(`this._rec_${dartName},\n`);
      } else {
        this.push(`this.${dartName},\n`);
      }
    }
    this.push(
      ");\n\n", //
      `static final defaultInstance = ${className}._(\n`,
    );
    for (const field of fields) {
      if (field.isRecursive === "hard") {
        this.push("null,\n");
      } else {
        const defaultExpr = this.getDefaultExpression(field.type!).expression;
        this.push(`${defaultExpr},\n`);
      }
    }
    this.push(
      ");\n\n",
      `static ${className}_mutable mutable() => ${className}_mutable._(\n`,
    );
    for (const field of fields) {
      const defaultExpr = this.getDefaultExpression(field.type!).expression;
      this.push(`${defaultExpr},\n`);
    }
    this.push(`);\n\n`);

    this.push(
      "@_core.deprecated\n",
      `${className} toFrozen() => this;\n\n`,
      `${className}_mutable toMutable() => ${className}_mutable._(\n`,
    );
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      this.push(`this.${dartName},\n`);
    }
    this.push(
      ");\n\n",
      "_core.bool equals(other) {\n",
      "if (_core.identical(this, other)) return true;\n",
      `if (other is! ${className}) return false;\n`,
      "return _soia.internal__listEquality.equals(_equality_proxy, other._equality_proxy);\n",
      "}\n\n",
      "_core.int get hashCode => _soia.internal__listEquality.hash(_equality_proxy);\n\n",
      "_core.List get _equality_proxy => [\n",
    );
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      this.push(`this.${dartName},\n`);
    }
    this.push(
      "];\n\n",
      "_core.String toString() => _soia.internal__stringify(this, serializer);\n\n",
      `static _soia.StructSerializer<${className}, ${className}_mutable> get serializer {\n`,
      "if (_serializerBuilder.mustInitialize()) {\n",
    );
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      const serializerExpr = typeSpeller.getSerializerExpression(field.type!);
      this.push(
        "_serializerBuilder.addField(\n",
        `"${field.name.text}",\n`,
        `"${dartName}",\n`,
        `${field.number},\n`,
        `${serializerExpr},\n`,
        `(it) => it.${dartName},\n`,
        `(it, v) => it.${dartName} = v,\n`,
        ");\n",
      );
    }
    for (const removedNumber of struct.record.removedNumbers) {
      this.push(`_serializerBuilder.addRemovedNumber(${removedNumber});\n`);
    }
    this.push(
      "_serializerBuilder.finalize();\n",
      "}\n",
      "return _serializerBuilder.serializer;\n",
      "}\n\n",
      "static final _serializerBuilder = _soia.internal__StructSerializerBuilder(\n",
      `recordId: "${getRecordId(struct)}",\n`,
      "defaultInstance: defaultInstance,\n",
      "newMutable: (it) => (it != null) ? it.toMutable() : mutable(),\n",
      `toFrozen: (${className}_mutable it) => it.toFrozen(),\n`,
      "getUnrecognizedFields: (it) => it._u,\n",
      "setUnrecognizedFields: (it, u) => it._u = u,\n",
      ");\n\n",
      "}\n\n",
    ); // class frozen

    this.push(
      `final class ${className}_mutable implements ${className}_orMutable {\n\n`,
    );
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      const allRecordsFrozen = field.isRecursive === "hard";
      const type = field.type!;
      const dartType = typeSpeller.getDartType(
        type,
        "maybe-mutable",
        allRecordsFrozen,
      );
      this.push(`${dartType} ${dartName};\n`);
    }
    this.push(
      `_soia.internal__UnrecognizedFields? _u;\n\n`,
      `${className}_mutable._(\n`,
    );
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      this.push(`this.${dartName},\n`);
    }
    this.push(
      `);\n\n`,
      `${className} toFrozen() => ${className}(\n`,
    );
    for (const field of fields) {
      const dartName = structFieldToDartName(field);
      this.push(`${dartName}: this.${dartName},\n`);
    }
    this.push(
      ").._u = this._u;\n",
      "}\n\n", // class _mutable
    );
  }

  private writeClassesForEnum(record: RecordLocation): void {
    const { typeSpeller } = this;
    const { fields } = record.record;
    const constantFields = fields.filter((f) => !f.type);
    const valueFields = fields.filter((f) => f.type);
    const className = typeSpeller.getClassName(record);
    // The actual enum class
    this.push(
      `${DartSourceFileGenerator.SEPARATOR}\n`,
      `// enum ${className.replace("_", ".")}\n`,
      `${DartSourceFileGenerator.SEPARATOR}\n\n`,
      `sealed class ${className} {\n`,
      `static const ${className} unknown = ${className}_unknown._instance;\n\n`,
    );
    for (const field of constantFields) {
      this.push(
        `static const ${enumFieldToDartName(field)} = `,
        `_${className}_consts.${toLowerCamel(field)}Const;\n`,
      );
    }
    this.pushEol();
    for (const field of valueFields) {
      const type = field.type!;
      const dartType = typeSpeller.getDartType(type, "frozen");
      this.push(
        `factory ${className}.wrap${toUpperCamel(field)}(\n`,
        `${dartType} value\n`,
        `) => ${className}_${toLowerCamel(field)}Wrapper._(value);\n\n`,
      );
      if (type.kind === "record") {
        const record = typeSpeller.recordMap.get(type.key)!;
        if (record.record.recordType === "struct") {
          const struct = record.record;
          this.push(`factory ${className}.create${toUpperCamel(field)}(`);
          const structFields = struct.fields;
          this.push(structFields.length ? "{\n" : "");
          for (const structField of structFields) {
            const dartName = structFieldToDartName(structField);
            const structType = structField.type!;
            const dartType = typeSpeller.getDartType(structType, "initializer");
            this.push(`required ${dartType} ${dartName},\n`);
          }
          this.push(structFields.length ? "}" : "");
          this.push(`) => ${className}.wrap${toUpperCamel(field)}(\n`);
          this.push(`${typeSpeller.getClassName(record)}(\n`);
          for (const structField of structFields) {
            const dartName = structFieldToDartName(structField);
            this.push(`${dartName}: ${dartName},\n`);
          }
          this.push(")\n", ");\n\n");
        }
      }
    }
    this.push(`\n${className}_kind get kind;\n`);
    this.push(
      "_core.bool get isUnknown;\n\n",
      `static _soia.EnumSerializer<${className}> get serializer {\n`,
      "if (_serializerBuilder.mustInitialize()) {\n",
    );
    for (const constantField of constantFields) {
      const dartName = enumFieldToDartName(constantField)
      this.push(
        "_serializerBuilder.addConstantField(\n",
        `${constantField.number},\n`,
        `"${constantField.name.text}",\n`,
        `"${dartName}",\n`,
        `${dartName},\n`,
        ");\n",
      );
    }
    for (const valueField of valueFields) {
      const type = valueField.type!;
      const serializerExpr = typeSpeller.getSerializerExpression(type);
      this.push(
        "_serializerBuilder.addValueField(\n",
        `${valueField.number},\n`,
        `"${valueField.name.text}",\n`,
        `"wrap${toUpperCamel(valueField)}",\n`,
        `${serializerExpr},\n`,
        `${className}_${toLowerCamel(valueField)}Wrapper._,\n`,
        "(it) => it.value,\n",
        `ordinal: ${className}_kind.${toLowerCamel(valueField)}Wrapper._ordinal,\n`,
        ");\n",
      );
    }
    for (const removedNumber of record.record.removedNumbers) {
      this.push(`_serializerBuilder.addRemovedNumber(${removedNumber});\n`);
    }
    this.push(
      "_serializerBuilder.finalize();\n",
      "}\n",
      "return _serializerBuilder.serializer;\n",
      "}\n\n",
      "static final _serializerBuilder = _soia.internal__EnumSerializerBuilder.create(\n",
      `recordId: "${getRecordId(record)}",\n`,
      `unknownInstance: ${className}_unknown._instance,\n`,
      `enumInstance: ${className}.unknown,\n`,
      `getOrdinal: (it) => it.kind._ordinal,\n`,
      `wrapUnrecognized: ${className}_unknown._unrecognized,\n`,
      `getUnrecognized: (it) => it._u,\n`,
      ");\n",
      "}\n\n",
    );
    // The _kind enum
    this.push(
      `enum ${className}_kind {\n`, //
      "unknown(0),\n",
    );
    let ordinalCounter = 1;
    for (const field of constantFields) {
      const ordinal = ordinalCounter++;
      this.push(`${toLowerCamel(field)}Const(${ordinal}),\n`);
    }
    for (const field of valueFields) {
      const ordinal = ordinalCounter++;
      this.push(`${toLowerCamel(field)}Wrapper(${ordinal}),\n`);
    }
    this.replaceEnd(",\n", ";\n\n");
    this.push(
      "final _core.int _ordinal;\n\n",
      `const ${className}_kind(this._ordinal);\n\n`,
      "}\n\n",
    );
    // The _unknown class
    this.push(
      `final class ${className}_unknown implements ${className} {\n`,
      `static const _instance = ${className}_unknown._();\n\n`,
      "final _soia.internal__UnrecognizedEnum? _u;\n\n",
      `const ${className}_unknown._() : _u = null;\n`,
      `${className}_unknown._unrecognized(this._u);\n\n`,
      `${className}_kind get kind => ${className}_kind.unknown;\n`,
      "_core.bool get isUnknown => true;\n\n",
      "_core.String toString() => _soia.internal__stringify(this, ",
      `${className}.serializer);\n`,
      "}\n\n",
    );
    // The _consts_ internal enum
    if (constantFields.length) {
      this.push(`enum _${className}_consts implements ${className} {\n`);
      for (const field of constantFields) {
        const name = toLowerCamel(field) + "Const";
        this.push(`${name}(${className}_kind.${name}),\n`);
      }
      this.replaceEnd(",\n", ";\n\n");
      this.push(
        `final ${className}_kind kind;\n\n`,
        `const _${className}_consts(this.kind);\n\n`,
        "_core.bool get isUnknown => false;\n\n",
        "_core.String toString() => _soia.internal__stringify(this, ",
        `${className}.serializer);\n`,
      );
      this.push("}\n\n"); // enum _consts
    }
    if (valueFields.length) {
      // The _wrapper abstract class
      this.push(
        `sealed class _${className}_wrapper implements ${className} {\n`,
        "_core.bool get isUnknown => false;\n",
        "_core.dynamic get value;\n\n",
        "_core.bool equals(other) {\n",
        `if (other is! _${className}_wrapper) return false;\n`,
        "return kind == other.kind && value == other.value;\n",
        "}\n\n",
        "_core.int get hashCode => (kind._ordinal * 31) ^ value.hashCode;\n\n",
        "_core.String toString() => _soia.internal__stringify(this, ",
        `${className}.serializer);\n`,
        "}\n\n",
      );
      for (const field of valueFields) {
        const dartType = typeSpeller.getDartType(field.type!, "frozen");
        this.push(
          `final class ${className}_${toLowerCamel(field)}Wrapper `,
          `extends _${className}_wrapper {\n`,
          `final ${dartType} value;\n\n`,
          `${className}_${toLowerCamel(field)}Wrapper._(this.value);\n\n`,
          `${className}_kind get kind => ${className}_kind.${toLowerCamel(field)}Wrapper;\n`,
          "}\n\n",
        );
      }
    }
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
    const type = constant.type!;
    const name = toTopLevelConstantName(constant);
    const dartType = typeSpeller.getDartType(type, "frozen");
    const tryGetDartConstLiteral: () => string | undefined = () => {
      if (type.kind !== "primitive") {
        return undefined;
      }
      switch (type.primitive) {
        case "bool":
        case "int32":
        case "int64":
        case "uint64":
        case "string":
          return JSON.stringify(constant.valueAsDenseJson);
        case "float32":
        case "float64":
          const number = constant.valueAsDenseJson as number;
          if (Number.isFinite(number)) {
            return JSON.stringify(number);
          } else if (Number.isNaN(number)) {
            return "double.nan";
          } else if (number > 0) {
            return "double.infinity";
          } else {
            return "-double.infinity";
          }
        default:
          return undefined;
      }
    };
    const dartConstLiteral = tryGetDartConstLiteral();
    if (dartConstLiteral !== undefined) {
      this.push(`const ${dartType} ${name} = ${dartConstLiteral};`);
    } else {
      const serializerExpression = typeSpeller.getSerializerExpression(
        constant.type!,
      );
      const jsonStringLiteral = JSON.stringify(
        JSON.stringify(constant.valueAsDenseJson),
      );
      this.push(
        `final ${dartType} ${name} = (\n`,
        serializerExpression,
        `.fromJsonCode(${jsonStringLiteral})\n`,
        ");\n\n",
      );
    }
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
            .map((f) => structFieldToDartName(f.name.text))
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

  private replaceEnd(searchString: string, replaceString: string): void {
    if (!this.code.endsWith(searchString)) {
      throw new Error();
    }
    this.code = this.code.slice(0, -searchString.length) + replaceString;
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

  private static readonly SEPARATOR = `// ${"-".repeat(80 - "// ".length)}`;

  private readonly typeSpeller: TypeSpeller;
  private code = "";
}

function getRecordId(record: RecordLocation): string {
  const modulePath = record.modulePath;
  const qualifiedRecordName = record.recordAncestors
    .map((r) => r.name.text)
    .join(".");
  return `${modulePath}:${qualifiedRecordName}`;
}

export const GENERATOR = new DartCodeGenerator();
