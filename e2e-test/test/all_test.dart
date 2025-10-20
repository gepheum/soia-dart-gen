import 'package:test/test.dart';
import '../soiagen/constants.dart' as constants;
import '../soiagen/enums.dart' as enums;
import '../soiagen/full_name.dart' as full_name;
import '../soiagen/methods.dart' as methods;
import '../soiagen/schema_change.dart' as schema_change;
import '../soiagen/structs.dart' as structs;
import '../soiagen/user.dart' as user;
import '../soiagen/vehicles/car.dart' as vehicles_car;
import 'package:soia/soia.dart' as soia;

void main() {
  group('Generated struct tests', () {
    test('toString() formatting', () {
      final fullName = full_name.FullName(
        firstName: "John",
        lastName: "",
      );
      expect(
          fullName.toString(),
          equals('FullName(\n'
              '  firstName: "John",\n'
              '  lastName: "",\n'
              ')'));

      expect(full_name.FullName.defaultInstance.toString(),
          equals('FullName.defaultInstance'));

      final triangle = structs.Triangle(
        color: structs.Color(
          r: 127,
          g: 128,
          b: 139,
        ),
        points: [
          structs.Point(x: 0, y: 0),
          structs.Point(x: 10, y: 0),
          structs.Point(x: 0, y: 20),
        ],
      );
      expect(
          triangle.toString(),
          equals('Triangle(\n'
              '  color: Color(\n'
              '    r: 127,\n'
              '    g: 128,\n'
              '    b: 139,\n'
              '  ),\n'
              '  points: [\n'
              '    Point.defaultInstance,\n'
              '    Point(\n'
              '      x: 10,\n'
              '      y: 0,\n'
              '    ),\n'
              '    Point(\n'
              '      x: 0,\n'
              '      y: 20,\n'
              '    ),\n'
              '  ],\n'
              ')'));
    });

    test('equals() method', () {
      final fullName1 = full_name.FullName(
        firstName: "John",
        lastName: "Doe",
      );
      final fullName2 = full_name.FullName(
        firstName: "John",
        lastName: "Doe",
      );
      final fullName3 = full_name.FullName(
        firstName: "John",
        lastName: "",
      );

      expect(fullName1 == fullName2, isTrue);
      expect(fullName1 == fullName3, isFalse);
      expect(fullName1 == "not a FullName", isFalse);
    });

    test('hashCode consistency', () {
      final names = <full_name.FullName>{};
      names.add(full_name.FullName(firstName: "John", lastName: "Doe"));
      names.add(full_name.FullName(firstName: "", lastName: "Doe"));
      names.add(full_name.FullName(firstName: "John", lastName: ""));
      names.add(
          full_name.FullName(firstName: "John", lastName: "Doe")); // duplicate
      names
          .add(full_name.FullName(firstName: "", lastName: "Doe")); // duplicate

      expect(names.length, equals(3));
    });

    test('toMutable() functionality', () {
      final fullName = full_name.FullName(
        firstName: "John",
        lastName: "Doe",
      );
      final mutableFullName = fullName.toMutable();
      mutableFullName.firstName = "Jane";

      final frozen = mutableFullName.toFrozen();
      expect(frozen.firstName, equals("Jane"));
      expect(frozen.lastName, equals("Doe"));

      expect(
          (fullName.toMutable()..lastName = "Smith").toFrozen(),
          equals(full_name.FullName(
            firstName: "John",
            lastName: "Smith",
          )));
    });

    test('toFrozen() returns this for immutable objects', () {
      final fullName = full_name.FullName(
        firstName: "John",
        lastName: "Doe",
      );
      final full_name.FullName_orMutable fullNameOrMutable = fullName;
      expect(identical(fullNameOrMutable.toFrozen(), fullName), isTrue);
    });

    test('mutable getters for complex types', () {
      final triangle = structs.Triangle(
        color: structs.Color(r: 127, g: 128, b: 139),
        points: [
          structs.Point(x: 0, y: 0),
          structs.Point(x: 10, y: 0),
          structs.Point(x: 0, y: 20),
        ],
      );
      final mutableTriangle = triangle.toMutable();

      mutableTriangle.mutableColor.r = 27;
      mutableTriangle.mutableColor.g = 28;
      mutableTriangle.mutablePoints.add(structs.Point(x: 5, y: 5));
      mutableTriangle.mutablePoints.add(structs.Point(x: 10, y: 10));

      expect(
          mutableTriangle.toFrozen(),
          equals(structs.Triangle(
            color: structs.Color(r: 27, g: 28, b: 139),
            points: [
              structs.Point(x: 0, y: 0),
              structs.Point(x: 10, y: 0),
              structs.Point(x: 0, y: 20),
              structs.Point(x: 5, y: 5),
              structs.Point(x: 10, y: 10),
            ],
          )));
    });

    test('_orMutable sealed interface', () {
      final full_name.FullName_orMutable person1 = full_name.FullName(
        firstName: "John",
        lastName: "Doe",
      ) as full_name.FullName_orMutable;
      final full_name.FullName_orMutable person2 = full_name.FullName.mutable()
        ..firstName = "John"
        ..lastName = "Doe";
      expect(person1.toFrozen(), equals(person2.toFrozen()));
    });

    test('default instances', () {
      expect(full_name.FullName.defaultInstance,
          equals(full_name.FullName.new(firstName: "", lastName: "")));
    });

    test('recursive structures', () {
      final recA = structs.RecA(
        a: structs.RecA(
            a: structs.RecA.defaultInstance, b: structs.RecB.defaultInstance),
        b: structs.RecB(a: structs.RecA.defaultInstance, aList: [
          structs.RecA.defaultInstance,
          structs.RecA.defaultInstance,
        ]),
      );
      expect(
          recA.toString(),
          equals('RecA(\n'
              '  a: RecA.defaultInstance,\n'
              '  b: RecB(\n'
              '    a: RecA.defaultInstance,\n'
              '    aList: [\n'
              '      RecA.defaultInstance,\n'
              '      RecA.defaultInstance,\n'
              '    ],\n'
              '  ),\n'
              ')'));
      expect(
          recA,
          equals(structs.RecA(
            a: structs.RecA(
                a: structs.RecA.defaultInstance,
                b: structs.RecB.defaultInstance),
            b: structs.RecB(a: structs.RecA.defaultInstance, aList: [
              structs.RecA.defaultInstance,
              structs.RecA.defaultInstance,
            ]),
          )));
      expect(recA.a.a.a.a.a.a.a, equals(structs.RecA.defaultInstance));
    });

    test('keyed lists functionality', () {
      final items = structs.Items(
        arrayWithBoolKey: [
          structs.Item.mutable()
            ..bool = true
            ..string = "a"
        ],
        arrayWithStringKey: [],
        arrayWithInt32Key: [],
        arrayWithInt64Key: [
          structs.Item.mutable()
            ..int64 = 123
            ..string = "a123",
          structs.Item.mutable()
            ..int64 = 234
            ..string = "a234",
        ],
        arrayWithUserIdKey: [
          structs.Item.mutable()
            ..user = structs.Item_User(id: "user1")
            ..string = "user item",
        ],
        arrayWithEnumKey: [
          structs.Item.mutable()
            ..weekday = enums.Weekday.tuesday
            ..string = "monday item",
        ],
        arrayWithBytesKey: [],
        arrayWithTimestampKey: [],
      );

      expect(items.arrayWithBoolKey.length, equals(1));
      expect(
          items.arrayWithBoolKey.findByKey(true),
          (structs.Item.mutable()
                ..bool = true
                ..string = "a")
              .toFrozen());
      expect(
          items.arrayWithInt64Key.findByKey(123),
          (structs.Item.mutable()
                ..int64 = 123
                ..string = "a123")
              .toFrozen());
      expect(items.arrayWithInt64Key.findByKey(345), equals(null));
      expect(items.arrayWithStringKey.findByKey("a"), equals(null));
      expect(
          items.arrayWithUserIdKey.findByKey("user1"),
          (structs.Item.mutable()
                ..user = structs.Item_User(id: "user1")
                ..string = "user item")
              .toFrozen());
      expect(
          items.arrayWithEnumKey.findByKey(enums.Weekday_kind.tuesdayConst),
          (structs.Item.mutable()
                ..weekday = enums.Weekday.tuesday
                ..string = "monday item")
              .toFrozen());

      final copy = structs.Items(
        arrayWithBoolKey: items.arrayWithBoolKey,
        arrayWithStringKey: items.arrayWithStringKey,
        arrayWithInt32Key: items.arrayWithInt32Key,
        arrayWithInt64Key: items.arrayWithInt64Key,
        arrayWithUserIdKey: items.arrayWithUserIdKey,
        arrayWithEnumKey: items.arrayWithEnumKey,
        arrayWithBytesKey: items.arrayWithBytesKey,
        arrayWithTimestampKey: items.arrayWithTimestampKey,
      );
      expect(identical(copy.arrayWithBoolKey, items.arrayWithBoolKey), isTrue);
    });

    test('timestamp to UTC', () {
      final now = DateTime.now();

      final item = structs.Item(
        bool: false,
        string: "",
        int32: 0,
        int64: 0,
        user: structs.Item_User(id: ""),
        weekday: enums.Weekday.unknown,
        bytes: soia.ByteString.empty,
        timestamp: now, // This should be converted to UTC
      );

      // The stored timestamp should always be UTC
      expect(item.timestamp.isUtc, isTrue,
          reason: "Timestamps should be stored in UTC");
      expect(item.timestamp.microsecondsSinceEpoch,
          equals(now.microsecondsSinceEpoch));
    });
  });

  group('Generated enum tests', () {
    test('enum instance creation', () {
      expect(enums.Weekday.unknown, isA<enums.Weekday>());
      expect(enums.Weekday.monday, isA<enums.Weekday>());
      expect(enums.Weekday.tuesday, isA<enums.Weekday>());

      expect(enums.JsonValue.null_, isA<enums.JsonValue>());
      expect(enums.JsonValue.wrapBoolean(true), isA<enums.JsonValue>());
    });

    test('enum toString() formatting', () {
      expect(
          enums.Weekday.monday.toString(), equals('enums_soia:Weekday.monday'));
      expect(enums.Weekday.unknown.toString(),
          equals('enums_soia:Weekday.unknown'));
      expect(
          enums.JsonValue.wrapBoolean(true).toString(),
          equals('enums_soia:JsonValue.wrapBoolean(\n'
              '  true\n'
              ')'));
    });

    test('enum equals() and hashCode', () {
      final set = <dynamic>{};
      set.add(enums.Weekday.monday);
      set.add(enums.Weekday.monday); // duplicate
      set.add(enums.Weekday.unknown);
      set.add(enums.Weekday.unknown); // duplicate
      set.add(enums.Weekday.tuesday);
      expect(set.length, equals(3));

      set.add(enums.JsonValue.unknown);
      expect(set.length, equals(4));

      set.add(enums.JsonValue.wrapBoolean(true));
      set.add(enums.JsonValue.wrapBoolean(true));
      set.add(enums.JsonValue.wrapBoolean(false));
      expect(set.length, equals(6));
    });

    test('enum kind property', () {
      expect(enums.Weekday.monday.kind, equals(enums.Weekday_kind.mondayConst));
      expect(enums.Weekday.unknown.kind, equals(enums.Weekday_kind.unknown));
      expect(
          enums.Weekday.tuesday.kind, equals(enums.Weekday_kind.tuesdayConst));
    });

    test('enum switch pattern matching', () {
      dynamic getValue(enums.JsonValue jsonValue) {
        switch (jsonValue) {
          case enums.JsonValue.null_:
            return null;
          case enums.JsonValue_booleanWrapper(:final value):
            return value;
          case enums.JsonValue_numberWrapper(:final value):
            return value;
          case enums.JsonValue_stringWrapper(:final value):
            return value;
          case enums.JsonValue_arrayWrapper(:final value):
            return value;
          case enums.JsonValue_objectWrapper(:final value):
            return value;
          case enums.JsonValue_unknown():
            return null;
        }
      }

      expect(getValue(enums.JsonValue.null_), equals(null));
      expect(getValue(enums.JsonValue.unknown), equals(null));
      expect(getValue(enums.JsonValue.wrapBoolean(true)), equals(true));
    });
  });

  group('Serialization tests', () {
    test('struct serialization and deserialization', () {
      final triangle = structs.Triangle(
        color: structs.Color(r: 127, g: 128, b: 139),
        points: [
          structs.Point(x: 1, y: 2),
        ],
      );

      final serializer = structs.Triangle.serializer;

      // Test JSON serialization
      final json = serializer.toJson(triangle);
      final deserialized = serializer.fromJson(json);
      expect(deserialized, equals(triangle));

      final readableJson = serializer.toJsonCode(triangle);
      final deserializedFromReadableJson =
          serializer.fromJsonCode(readableJson);
      expect(deserializedFromReadableJson, equals(triangle));

      // Test binary serialization
      final bytes = serializer.toBytes(triangle);
      final deserializedFromBytes = serializer.fromBytes(bytes);
      expect(deserializedFromBytes, equals(triangle));
    });

    test('enum constant serialization and deserialization', () {
      final weekday = enums.Weekday.monday;
      final serializer = enums.Weekday.serializer;

      final json = serializer.toJson(weekday);
      final deserialized = serializer.fromJson(json);
      expect(deserialized, equals(weekday));

      final bytes = serializer.toBytes(weekday);
      final deserializedFromBytes = serializer.fromBytes(bytes);
      expect(deserializedFromBytes, equals(weekday));
    });

    test('enum wrapper serialization and deserialization', () {
      final original = enums.JsonValue.wrapString("Hello, World!");
      final serializer = enums.JsonValue.serializer;

      final json = serializer.toJson(original);
      final deserialized = serializer.fromJson(json);
      expect(deserialized, equals(original));

      final bytes = serializer.toBytes(original);
      final deserializedFromBytes = serializer.fromBytes(bytes);
      expect(deserializedFromBytes, equals(original));
    });

    test('enum unknown serialization and deserialization', () {
      final original = enums.JsonValue.unknown;
      final serializer = enums.JsonValue.serializer;

      final json = serializer.toJson(original);
      final deserialized = serializer.fromJson(json);
      expect(deserialized, equals(original));

      final bytes = serializer.toBytes(original);
      final deserializedFromBytes = serializer.fromBytes(bytes);
      expect(deserializedFromBytes, equals(original));
    });

    test('unrecognized fields - JSON', () {
      // Create a FooAfter instance with all fields including the new 'bit'
      // field
      final fooAfter = schema_change.FooAfter.mutable()
        ..n = 42
        ..bit = true;
      fooAfter.mutableBars.addAll([
        schema_change.BarAfter.mutable()
          ..x = 1.0
          ..s = 'bar1',
        schema_change.BarAfter.mutable()
          ..x = 2.0
          ..s = 'bar2'
      ]);
      fooAfter.mutableEnums.addAll([
        schema_change.EnumAfter.a,
        schema_change.EnumAfter.wrapC("foo"),
        schema_change.EnumAfter.d,
      ]);

      // Serialize FooAfter to JSON
      final jsonCode =
          schema_change.FooAfter.serializer.toJsonCode(fooAfter.toFrozen());
      expect(jsonCode,
          equals('[[[1.0,0,0,"bar1"],[2.0,0,0,"bar2"]],42,[1,[5,"foo"],6],1]'));

      // Deserialize as FooBefore with keepUnrecognizedFields to preserve the
      // 'bit' field
      expect(
          schema_change.FooBefore.serializer.toJsonCode(schema_change
              .FooBefore.serializer
              .fromJsonCode(jsonCode, keepUnrecognizedFields: true)),
          equals(jsonCode));

      expect(
          schema_change.FooBefore.serializer.toJsonCode(
              schema_change.FooBefore.serializer.fromJsonCode(jsonCode)),
          equals('[[[1.0],[2.0]],42,[1,0,0]]'));
    });

    test('unrecognized fields - binary', () {
      // Create a FooAfter instance with all fields including the new 'bit'
      // field
      final fooAfter = schema_change.FooAfter.mutable()
        ..n = 42
        ..bit = true;
      fooAfter.mutableBars.addAll([
        schema_change.BarAfter.mutable()
          ..x = 1.0
          ..s = 'bar1',
        schema_change.BarAfter.mutable()
          ..x = 2.0
          ..s = 'bar2'
      ]);
      fooAfter.mutableEnums.addAll([
        schema_change.EnumAfter.a,
        schema_change.EnumAfter.wrapC("foo"),
        schema_change.EnumAfter.d,
      ]);

      // Serialize FooAfter to bytes
      final bytes =
          schema_change.FooAfter.serializer.toBytes(fooAfter.toFrozen());
      expect(
          soia.ByteString.copy(bytes).toBase16(),
          equals(
              '736f6961fa04f8fa04f00000803f0000f30462617231fa04f0000000400000f304626172322af901f805f303666f6f0601'));

      // Deserialize as FooBefore with keepUnrecognizedFields to preserve the
      // 'bit' field
      expect(
          schema_change.FooBefore.serializer.toBytes(schema_change
              .FooBefore.serializer
              .fromBytes(bytes, keepUnrecognizedFields: true)),
          equals(bytes));
    });

    test('removed fields - JSON', () {
      // Create a FooAfter instance with all fields including the new 'bit'
      // field
      final fooBefore = (schema_change.FooBefore.mutable()
            ..bars = [schema_change.BarBefore.mutable()..y = true]
            ..enums = [
              schema_change.EnumBefore.b,
              schema_change.EnumBefore.wrapC("foo"),
            ])
          .toFrozen();

      // Serialize FooBefore to JSON
      final jsonCode = schema_change.FooBefore.serializer.toJsonCode(fooBefore);
      expect(jsonCode, equals('[[[0.0,0,1]],0,[3,[4,"foo"]]]'));

      final fooAfter = schema_change.FooAfter.serializer
          .fromJsonCode(jsonCode, keepUnrecognizedFields: true);

      expect(schema_change.FooAfter.serializer.toJsonCode(fooAfter),
          equals('[[[]],0,[0,0]]'));
    });

    test('removed fields - binary', () {
      // Create a FooAfter instance with all fields including the new 'bit'
      // field
      final fooBefore = (schema_change.FooBefore.mutable()
            ..bars = [schema_change.BarBefore.mutable()..y = true]
            ..enums = [
              schema_change.EnumBefore.b,
              schema_change.EnumBefore.wrapC("foo"),
            ])
          .toFrozen();

      // Serialize FooBefore to JSON
      final bytes = schema_change.FooBefore.serializer.toBytes(fooBefore);
      expect(soia.ByteString.copy(bytes).toBase16(),
          equals('736f6961f9f7f900000100f803fef303666f6f'));

      final fooAfter = schema_change.FooAfter.serializer
          .fromBytes(bytes, keepUnrecognizedFields: true);

      expect(schema_change.FooAfter.serializer.toBytes(fooAfter),
          equals([115, 111, 105, 97, 249, 247, 246, 0, 248, 0, 0]));
    });
  });

  group('Constants tests', () {
    test('generated constants', () {
      expect(constants.oneSingleQuotedString, equals('"Foo"'));

      // Test complex constant
      expect(constants.oneConstant, isA<enums.JsonValue>());

      // Test timestamp constant
      expect(constants.oneTimestamp, isA<DateTime>());
      expect(constants.oneTimestamp.isUtc, isTrue);
    });
  });

  group('Methods tests', () {
    test('generated methods', () {
      expect(methods.myProcedureMethod, isA<soia.Method>());
      expect(methods.myProcedureMethod.name, equals('MyProcedure'));
      expect(methods.myProcedureMethod.number, equals(1974132327));
      expect(methods.myProcedureMethod.requestSerializer,
          equals(structs.Point.serializer));
      expect(methods.myProcedureMethod.responseSerializer,
          equals(enums.JsonValue.serializer));
    });
  });

  group('Vehicles module tests', () {
    test('car struct functionality', () {
      final car = vehicles_car.Car.defaultInstance;
      expect(car, isNotNull);
      expect(car.model, equals(""));

      final customCar = vehicles_car.Car(
        model: "Tesla Model 3",
        purchaseTime: DateTime.now().toUtc(),
        owner: user.User.defaultInstance,
        secondOwner: null,
      );
      expect(customCar.model, equals("Tesla Model 3"));
      expect(customCar.owner, isNotNull);
      expect(customCar.secondOwner, isNull);
    });
  });
}
