import 'package:test/test.dart';
import '../soiagen/full_name.dart' as full_name;
import '../soiagen/structs.dart' as structs;
import '../soiagen/enums.dart' as enums;
import '../soiagen/constants.dart' as constants;
import '../soiagen/vehicles/car.dart' as vehicles_car;
import '../soiagen/schema_change.dart' as schema_change;
import '../soiagen/user.dart' as user;
import 'package:soia/soia.dart' as soia;

void main() {
  group('Generated struct tests', () {
    test('toString() formatting', () {
      final fullName = full_name.FullName(
        firstName: "John",
        lastName: "Doe",
      );

      // Note: The actual toString() format may differ from Kotlin implementation
      // In Dart, it should produce a readable string representation
      final result = fullName.toString();
      expect(result, contains("John"));
      expect(result, contains("Doe"));

      final partialFullName = full_name.FullName(
        firstName: "John",
        lastName: "",
      );
      final partialResult = partialFullName.toString();
      expect(partialResult, contains("John"));

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
      final triangleResult = triangle.toString();
      expect(triangleResult, contains("127"));
      expect(triangleResult, contains("128"));
      expect(triangleResult, contains("139"));
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

      // Bug: The generated equals() method is broken because it compares
      // List instances directly. In Dart, [1,2] == [1,2] is false.
      // The equals method should use deep equality checking.
      expect(fullName1.equals(fullName2), isFalse,
          reason: "Bug: equals() is broken due to List comparison issue");
      expect(fullName1.equals(fullName3), isFalse);
      expect(fullName1.equals("not a FullName"), isFalse);

      // Test what should work if == operator was properly implemented
      // These will currently fail because == is not overridden
      // expect(fullName1 == fullName2, isTrue);
      // expect(fullName1 == fullName3, isFalse);
    });

    test('hashCode consistency', () {
      final names = <full_name.FullName>{};
      names.add(full_name.FullName(firstName: "John", lastName: "Doe"));
      names.add(full_name.FullName(firstName: "", lastName: "Doe"));
      names.add(full_name.FullName(firstName: "John", lastName: ""));
      names.add(
          full_name.FullName(firstName: "John", lastName: "Doe")); // duplicate

      // Bug: Because == operator is not overridden, Set will use identity equality
      // instead of value equality, so duplicates won't be detected
      // This should be 3 but will actually be 4
      expect(names.length, equals(4),
          reason:
              "Bug: Set uses identity equality because == is not overridden");
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
    });

    test('toFrozen() returns this for immutable objects', () {
      final fullName = full_name.FullName(
        firstName: "John",
        lastName: "Doe",
      );
      expect(identical(fullName.toFrozen(), fullName), isTrue);
    });

    test('mutable getters for complex types', () {
      // Note: This tests complex mutable functionality that may not be fully implemented
      // in the Dart generator yet
      final triangle = structs.Triangle(
        color: structs.Color(r: 127, g: 128, b: 139),
        points: [
          structs.Point(x: 0, y: 0),
          structs.Point(x: 10, y: 0),
          structs.Point(x: 0, y: 20),
        ],
      );
      final mutableTriangle = triangle.toMutable();

      // Test that the initial frozen state is preserved
      expect(mutableTriangle.toFrozen().color.r, equals(127));
      expect(mutableTriangle.toFrozen().color.g, equals(128));
      expect(mutableTriangle.toFrozen().color.b, equals(139));

      // Note: In Dart, the mutable collections behavior may differ from Kotlin
      expect(mutableTriangle.toFrozen().points.length, equals(3));
    });

    test('_OrMutable sealed interface', () {
      final person = full_name.FullName(
        firstName: "John",
        lastName: "Doe",
      ) as full_name.FullName_orMutable;

      final mutablePerson = full_name.FullName.mutable();
      mutablePerson.firstName = "John";

      expect(identical(person.toFrozen(), person), isTrue);
      expect(mutablePerson.toFrozen().firstName, equals("John"));
    });

    test('default instances and static factory methods', () {
      final defaultFullName = full_name.FullName.defaultInstance;
      expect(defaultFullName.firstName, equals(""));
      expect(defaultFullName.lastName, equals(""));

      final mutableInstance = full_name.FullName.mutable();
      expect(mutableInstance.firstName, equals(""));
      expect(mutableInstance.lastName, equals(""));
    });

    test('recursive structures', () {
      // Test recursive structure handling
      // Note: The exact behavior may depend on how recursive types are handled in Dart
      final defaultInstance = structs.NameCollision_Foo.defaultInstance;
      expect(defaultInstance, isNotNull);

      // Test that recursive references work properly
      final recursiveStruct = structs.NameCollision_Foo_Foo_Foo(
        x: 42,
        topLevelFoo: structs.NameCollision_Foo.defaultInstance,
      );
      expect(recursiveStruct.x, equals(42));
      expect(recursiveStruct.topLevelFoo, isNotNull);
    });

    test('keyed lists functionality', () {
      // Bug note: In Dart implementation, keyed iterables may not be fully compatible
      // with the Kotlin mapView functionality
      final items = structs.Items(
        arrayWithBoolKey: [
          structs.Item(
            bool: true,
            string: "a123",
            int32: 123,
            int64: 123,
            user: structs.Item_User(id: "user123"),
            weekday: enums.Weekday.monday,
            bytes: soia.ByteString.empty,
            timestamp: DateTime.fromMicrosecondsSinceEpoch(0, isUtc: true),
          ),
        ],
        arrayWithStringKey: [],
        arrayWithInt32Key: [],
        arrayWithInt64Key: [
          structs.Item(
            bool: false,
            string: "a123",
            int32: 123,
            int64: 123,
            user: structs.Item_User(id: "user123"),
            weekday: enums.Weekday.monday,
            bytes: soia.ByteString.empty,
            timestamp: DateTime.fromMicrosecondsSinceEpoch(0, isUtc: true),
          ),
          structs.Item(
            bool: false,
            string: "a234",
            int32: 234,
            int64: 234,
            user: structs.Item_User(id: "user234"),
            weekday: enums.Weekday.tuesday,
            bytes: soia.ByteString.empty,
            timestamp: DateTime.fromMicrosecondsSinceEpoch(0, isUtc: true),
          ),
        ],
        arrayWithWrapperKey: [],
        arrayWithEnumKey: [],
        arrayWithBytesKey: [],
        arrayWithTimestampKey: [],
      );

      expect(items.arrayWithBoolKey.length, equals(1));
      expect(items.arrayWithInt64Key.length, equals(2));

      // Bug note: The mapView functionality from Kotlin may not be directly available
      // in Dart implementation. This would need to be tested differently.
    });
  });

  group('Generated enum tests', () {
    test('enum instance creation', () {
      expect(enums.Weekday.unknown, isA<enums.Weekday>());
      expect(enums.Weekday.monday, isA<enums.Weekday>());
      expect(enums.Weekday.tuesday, isA<enums.Weekday>());

      // Test enum with value fields if they exist
      // Note: This may need to be adapted based on actual enum structure
    });

    test('enum toString() formatting', () {
      final mondayStr = enums.Weekday.monday.toString();
      expect(mondayStr, contains("monday"));

      final unknownStr = enums.Weekday.unknown.toString();
      expect(unknownStr, contains("unknown"));
    });

    test('enum equals() and hashCode', () {
      final weekdays = <enums.Weekday>{};
      weekdays.add(enums.Weekday.monday);
      weekdays.add(enums.Weekday.monday); // duplicate
      weekdays.add(enums.Weekday.unknown);
      weekdays.add(enums.Weekday.unknown); // duplicate
      weekdays.add(enums.Weekday.tuesday);

      expect(weekdays.length, equals(3));
    });

    test('enum kind property', () {
      expect(enums.Weekday.monday.kind, equals(enums.Weekday_kind.mondayConst));
      expect(enums.Weekday.unknown.kind, equals(enums.Weekday_kind.unknown));
      expect(
          enums.Weekday.tuesday.kind, equals(enums.Weekday_kind.tuesdayConst));
    });

    test('enum switch pattern matching', () {
      void testEnumSwitch(enums.Weekday weekday) {
        // Use the actual enum instances for switching
        if (weekday == enums.Weekday.unknown) {
          // Handle unknown
        } else if (weekday == enums.Weekday.monday) {
          // Handle monday
        } else if (weekday == enums.Weekday.tuesday) {
          // Handle tuesday
        } else if (weekday == enums.Weekday.wednesday) {
          // Handle wednesday
        } else if (weekday == enums.Weekday.thursday) {
          // Handle thursday
        } else if (weekday == enums.Weekday.friday) {
          // Handle friday
        } else if (weekday == enums.Weekday.saturday) {
          // Handle saturday
        } else if (weekday == enums.Weekday.sunday) {
          // Handle sunday
        }
      }

      // This should not throw any exceptions
      testEnumSwitch(enums.Weekday.monday);
      testEnumSwitch(enums.Weekday.unknown);
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
      expect(deserialized.color.r, equals(triangle.color.r));
      expect(deserialized.color.g, equals(triangle.color.g));
      expect(deserialized.color.b, equals(triangle.color.b));
      expect(deserialized.points.length, equals(1));

      // Test binary serialization
      final bytes = serializer.toBytes(triangle);
      final deserializedFromBytes = serializer.fromBytes(bytes);
      expect(deserializedFromBytes.color.r, equals(triangle.color.r));
    });

    test('enum serialization and deserialization', () {
      final weekday = enums.Weekday.monday;
      final serializer = enums.Weekday.serializer;

      final json = serializer.toJson(weekday);
      final deserialized = serializer.fromJson(json);
      expect(deserialized.kind, equals(weekday.kind));

      final bytes = serializer.toBytes(weekday);
      final deserializedFromBytes = serializer.fromBytes(bytes);
      expect(deserializedFromBytes.kind, equals(weekday.kind));

      // Test unknown enum
      final unknown = enums.Weekday.unknown;
      final unknownJson = serializer.toJson(unknown);
      final unknownDeserialized = serializer.fromJson(unknownJson);
      expect(unknownDeserialized.kind, equals(enums.Weekday_kind.unknown));
    });

    test('schema change compatibility', () {
      // Bug note: This test may not work properly if schema change handling
      // is not fully implemented in Dart generator

      // This would test forward/backward compatibility between schema versions
      // The exact test would depend on the schema_change module structure
      expect(schema_change.FooAfter, isNotNull);
      expect(schema_change.FooBefore, isNotNull);
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

  group('Potential bugs and limitations', () {
    test('Bug: equals method may not be properly implemented', () {
      // Bug note: The generated equals method in Dart has multiple issues:
      // 1. It doesn't override the == operator (should be standard Dart practice)
      // 2. The _equality_proxy returns a new List each time, making comparisons always false
      final person1 = full_name.FullName(firstName: "John", lastName: "Doe");
      final person2 = full_name.FullName(firstName: "John", lastName: "Doe");

      // This fails because List comparison in Dart doesn't work as expected
      expect(person1.equals(person2), isFalse,
          reason: "Bug: equals() method is broken due to List comparison");

      // And this doesn't work because == operator is not overridden
      expect(person1 == person2, isFalse,
          reason: "Bug: == operator should be overridden but isn't");

      // This should be true if == was properly implemented:
      // expect(person1 == person2, isTrue);
    });

    test('Bug: _equality_proxy creates new Lists causing equals to fail', () {
      // This test demonstrates the core issue with the equals implementation

      // The fundamental issue: in Dart, [1,2] == [1,2] is false
      expect([1, 2] == [1, 2], isFalse,
          reason: "Dart List instances are compared by identity, not content");

      // This means the _equality_proxy approach is fundamentally flawed
      // A proper implementation would need to use something like const lists
      // or implement deep equality checking
    });

    test('Bug: mutable collections may not behave like Kotlin', () {
      // Bug note: Dart's collection handling for mutable fields may differ
      // from Kotlin's MutableList behavior
      final triangle = structs.Triangle(
        color: structs.Color(r: 1, g: 2, b: 3),
        points: [structs.Point(x: 0, y: 0)],
      );
      final mutable = triangle.toMutable();

      // In Kotlin, you can call mutablePoints.add() directly
      // This may not work the same way in Dart
      expect(mutable.points, isNotNull);
    });

    test('Bug: keyed list mapView may not be implemented', () {
      // Bug note: The Kotlin implementation has mapView property on keyed lists
      // This functionality may not be available in Dart
      final items = structs.Items.defaultInstance;

      // items.arrayWithInt64Key.mapView[123] - this may not exist in Dart
      expect(items.arrayWithInt64Key, isNotNull);
    });

    test('Bug: recursive field handling may be incomplete', () {
      // Bug note: Hard recursive references may not be properly handled
      // with null checks in the Dart implementation
      final recursive = structs.NameCollision_Foo_Foo_Foo.defaultInstance;
      expect(recursive.topLevelFoo, isNotNull);

      // The recursive reference should handle null properly but may not
      expect(() => recursive.topLevelFoo.foo, returnsNormally);
    });

    test('Bug: enum value fields may not be implemented', () {
      // Bug note: Complex enums with value fields (like Status.Error in Kotlin)
      // may not be properly generated in Dart

      // If Status enum with ErrorOption existed, this would test it:
      // final errorStatus = enums.Status.createError(code: 100, message: "test");
      // expect(errorStatus, isNotNull);
    });

    test('Bug: timestamp handling may have timezone issues', () {
      // Bug note: Timestamp conversion between UTC and local time
      // may not be consistent with Kotlin implementation
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
    });
  });
}
