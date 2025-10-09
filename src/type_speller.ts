import type { RecordKey, RecordLocation, ResolvedType } from "soiac";
import { ClassName, Namer } from "./naming.js";

export type TypeFlavor =
  | "initializer"
  | "frozen"
  | "maybe-mutable"
  | "mutable"
  | "kind";

/**
 * Transforms a type found in a `.soia` file into a Kotlin type.
 *
 * The flavors are:
 *   · initializer
 *       The value can be passed by parameter to the `create` method of a frozen
 *       class or the constructor of a mutable class.
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
    private readonly namer: Namer,
  ) {}

  getKotlinType(
    type: ResolvedType,
    flavor: "initializer" | "frozen" | "mutable",
    allRecordsFrozen?: undefined,
  ): string;

  getKotlinType(
    type: ResolvedType,
    flavor: TypeFlavor,
    // Only matters if mode is "maybe-mutable"
    allRecordsFrozen: boolean | undefined,
  ): string;

  getKotlinType(
    type: ResolvedType,
    flavor: TypeFlavor,
    // Only matters if mode is "maybe-mutable"
    allRecordsFrozen: boolean | undefined,
  ): string {
    switch (type.kind) {
      case "record": {
        const recordLocation = this.recordMap.get(type.key)!;
        const record = recordLocation.record;
        const className = this.namer.getClassName(recordLocation).qualifiedName;
        if (record.recordType === "struct") {
          if (flavor === "frozen" || allRecordsFrozen) {
            return className;
          } else if (flavor === "maybe-mutable" || flavor === "initializer") {
            return allRecordsFrozen ? className : `${className}_OrMutable`;
          } else if (flavor === "mutable") {
            return `${className}.Mutable`;
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
          return `${className}.Kind`;
        } else {
          const _: never = flavor;
          throw TypeError();
        }
      }
      case "array": {
        if (flavor === "initializer") {
          const itemType = this.getKotlinType(
            type.item,
            "maybe-mutable",
            allRecordsFrozen,
          );
          return `kotlin.collections.Iterable<${itemType}>`;
        } else if (flavor === "frozen") {
          const itemType = this.getKotlinType(
            type.item,
            "frozen",
            allRecordsFrozen,
          );
          if (type.key) {
            const { keyType } = type.key;
            let kotlinKeyType = this.getKotlinType(keyType, "frozen");
            if (keyType.kind === "record") {
              kotlinKeyType += ".Kind";
            }
            return `land.soia.KeyedList<${itemType}, ${kotlinKeyType}>`;
          } else {
            return `kotlin.collections.List<${itemType}>`;
          }
        } else if (flavor === "maybe-mutable") {
          const itemType = this.getKotlinType(
            type.item,
            "maybe-mutable",
            allRecordsFrozen,
          );
          return `kotlin.collections.List<${itemType}>`;
        } else if (flavor === "mutable") {
          const itemType = this.getKotlinType(
            type.item,
            "maybe-mutable",
            allRecordsFrozen,
          );
          return `kotlin.collections.MutableList<${itemType}>`;
        } else {
          const _: "kind" = flavor;
          throw TypeError();
        }
      }
      case "optional": {
        const otherType = this.getKotlinType(
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
            return "kotlin.Boolean";
          case "int32":
            return "kotlin.Int";
          case "int64":
            return "kotlin.Long";
          case "uint64":
            return "kotlin.ULong";
          case "float32":
            return "kotlin.Float";
          case "float64":
            return "kotlin.Double";
          case "timestamp":
            return "java.time.Instant";
          case "string":
            return "kotlin.String";
          case "bytes":
            return "okio.ByteString";
        }
      }
    }
  }

  getClassName(recordKey: RecordKey): ClassName {
    const record = this.recordMap.get(recordKey)!;
    return this.namer.getClassName(record);
  }

  getSerializerExpression(type: ResolvedType): string {
    switch (type.kind) {
      case "primitive": {
        switch (type.primitive) {
          case "bool":
            return "land.soia.Serializers.bool";
          case "int32":
            return "land.soia.Serializers.int32";
          case "int64":
            return "land.soia.Serializers.int64";
          case "uint64":
            return "land.soia.Serializers.uint64";
          case "float32":
            return "land.soia.Serializers.float32";
          case "float64":
            return "land.soia.Serializers.float64";
          case "timestamp":
            return "land.soia.Serializers.timestamp";
          case "string":
            return "land.soia.Serializers.string";
          case "bytes":
            return "land.soia.Serializers.bytes";
        }
        const _: never = type.primitive;
        throw TypeError();
      }
      case "array": {
        if (type.key) {
          const keyChain = type.key.path.join(".");
          const path = type.key.path
            .map((f) => this.namer.toLowerCamelName(f.name.text))
            .join(".");
          return (
            "land.soia.internal.keyedListSerializer(\n" +
            this.getSerializerExpression(type.item) +
            `,\n"${keyChain}",\n{ it.${path} },\n)`
          );
        } else {
          return (
            "land.soia.Serializers.list(\n" +
            this.getSerializerExpression(type.item) +
            ",\n)"
          );
        }
      }
      case "optional": {
        return (
          `land.soia.Serializers.optional(\n` +
          this.getSerializerExpression(type.other) +
          `,\n)`
        );
      }
      case "record": {
        return this.getClassName(type.key).qualifiedName + ".SERIALIZER";
      }
    }
  }
}
