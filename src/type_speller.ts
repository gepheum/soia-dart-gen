import type { Module, RecordKey, RecordLocation, ResolvedType } from "soiac";
import { getClassName, structFieldToDartName } from "./naming.js";

export type TypeFlavor =
  | "initializer"
  | "frozen"
  | "maybe-mutable"
  | "mutable"
  | "kind";

/**
 * Transforms a type found in a `.soia` file into a Dart type.
 *
 * The flavors are:
 *   · initializer
 *       The value can be passed by parameter to the constructor of a frozen class.
 *   · frozen:
 *       The type is deeply immutable. All the fields of a frozen class are also
 *       frozen.
 *   · maybe-mutable:
 *       Type union of the frozen type and the mutable type. All the fields of a
 *       mutable class are maybe-mutable.
 *   · mutable:
 *       A mutable value. Not all types found in `.soia` files support this, e.g.
 *       strings and numbers are always immutable.
 */
export class TypeSpeller {
  constructor(
    readonly recordMap: ReadonlyMap<RecordKey, RecordLocation>,
    private readonly origin: Module,
  ) {}

  getDartType(
    type: ResolvedType,
    flavor: "initializer" | "frozen" | "mutable",
    allRecordsFrozen?: undefined,
  ): string;

  getDartType(
    type: ResolvedType,
    flavor: TypeFlavor,
    // Only matters if mode is "maybe-mutable"
    allRecordsFrozen: boolean | undefined,
  ): string;

  getDartType(
    type: ResolvedType,
    flavor: TypeFlavor,
    // Only matters if mode is "maybe-mutable"
    allRecordsFrozen: boolean | undefined,
  ): string {
    switch (type.kind) {
      case "record": {
        const recordLocation = this.recordMap.get(type.key)!;
        const record = recordLocation.record;
        const className = this.getClassName(recordLocation);
        if (record.recordType === "struct") {
          if (flavor === "frozen" || allRecordsFrozen) {
            return className;
          } else if (flavor === "maybe-mutable" || flavor === "initializer") {
            return allRecordsFrozen ? className : `${className}_orMutable`;
          } else if (flavor === "mutable") {
            return `${className}_mutable`;
          } else {
            const _: "kind" = flavor;
            throw TypeError();
          }
        }
        // An enum.
        const _: "enum" = record.recordType;
        if (
          flavor === "initializer" ||
          flavor === "frozen" ||
          flavor === "maybe-mutable" ||
          flavor === "mutable"
        ) {
          return className;
        } else if (flavor === "kind") {
          return `${className}_kind`;
        } else {
          const _: never = flavor;
          throw TypeError();
        }
      }
      case "array": {
        if (flavor === "initializer") {
          const itemType = this.getDartType(
            type.item,
            "maybe-mutable",
            allRecordsFrozen,
          );
          return `_core.Iterable<${itemType}>`;
        } else if (flavor === "frozen") {
          const itemType = this.getDartType(
            type.item,
            "frozen",
            allRecordsFrozen,
          );
          if (type.key) {
            const { keyType } = type.key;
            let dartKeyType = this.getDartType(keyType, "frozen");
            if (keyType.kind === "record") {
              dartKeyType += "_kind";
            }
            return `_soia.KeyedIterable<${itemType}, ${dartKeyType}>`;
          } else {
            return `_core.Iterable<${itemType}>`;
          }
        } else if (flavor === "maybe-mutable") {
          const itemType = this.getDartType(
            type.item,
            "maybe-mutable",
            allRecordsFrozen,
          );
          return `_core.Iterable<${itemType}>`;
        } else if (flavor === "mutable") {
          const itemType = this.getDartType(
            type.item,
            "maybe-mutable",
            allRecordsFrozen,
          );
          return `_core.List<${itemType}>`;
        } else {
          const _: "kind" = flavor;
          throw TypeError();
        }
      }
      case "optional": {
        const otherType = this.getDartType(
          type.other,
          flavor,
          allRecordsFrozen,
        );
        return `${otherType}?`;
      }
      case "primitive": {
        const { primitive } = type;
        switch (primitive) {
          case "bool":
            return "_core.bool";
          case "int32":
          case "int64":
            return "_core.int";
          case "uint64":
            return "_core.BigInt";
          case "float32":
          case "float64":
            return "_core.double";
          case "timestamp":
            return "_core.DateTime";
          case "string":
            return "_core.String";
          case "bytes":
            return "_soia.ByteString";
        }
      }
    }
  }

  getClassName(recordOrKey: RecordKey | RecordLocation): string {
    const record =
      typeof recordOrKey === "string"
        ? this.recordMap.get(recordOrKey)!
        : recordOrKey;
    return getClassName(record, { origin: this.origin });
  }

  getSerializerExpression(type: ResolvedType): string {
    switch (type.kind) {
      case "primitive": {
        switch (type.primitive) {
          case "bool":
            return "_soia.Serializers.bool";
          case "int32":
            return "_soia.Serializers.int32";
          case "int64":
            return "_soia.Serializers.int64";
          case "uint64":
            return "_soia.Serializers.uint64";
          case "float32":
            return "_soia.Serializers.float32";
          case "float64":
            return "_soia.Serializers.float64";
          case "timestamp":
            return "_soia.Serializers.timestamp";
          case "string":
            return "_soia.Serializers.string";
          case "bytes":
            return "_soia.Serializers.bytes";
        }
        const _: never = type.primitive;
        throw TypeError();
      }
      case "array": {
        if (type.key) {
          const keyChain = type.key.path.map((p) => p.name.text).join(".");
          const path = type.key.path
            .map((f) => structFieldToDartName(f.name.text))
            .join(".");
          const itemType = this.getDartType(type.item, "frozen");
          return (
            "_soia.Serializers.keyedIterable(\n" +
            `${this.getSerializerExpression(type.item)},\n` +
            `(${itemType} it) => it.${path},\n` +
            `internal__getKeySpec: "${keyChain}",\n)`
          );
        } else {
          return (
            "_soia.Serializers.iterable(\n" +
            this.getSerializerExpression(type.item) +
            ",\n)"
          );
        }
      }
      case "optional": {
        return (
          `_soia.Serializers.optional(\n` +
          this.getSerializerExpression(type.other) +
          `,\n)`
        );
      }
      case "record": {
        return this.getClassName(type.key) + ".serializer";
      }
    }
  }
}
