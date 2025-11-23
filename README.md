[![npm](https://img.shields.io/npm/v/soia-dart-gen)](https://www.npmjs.com/package/soia-dart-gen)
[![build](https://github.com/gepheum/soia-dart-gen/workflows/Build/badge.svg)](https://github.com/gepheum/soia-dart-gen/actions)

# Soia's Dart code generator

Official plugin for generating Dart code from [.soia](https://github.com/gepheum/soia) files.

Targets Dart 3.0 and higher.

## Installation

From your project's root directory, run `npm i --save-dev soia-dart-gen`.

In your `soia.yml` file, add the following snippet under `generators`:
```yaml
  - mod: soia-dart-gen
    config: {}
```

The `npm run soiac` command will now generate .dart files within the `soiagen` directory.

For more information, see this Dart project [example](https://github.com/gepheum/soia-dart-example).

## Dart generated code guide

The examples below are for the code generated from [this](https://github.com/gepheum/soia-dart-example/blob/main/lib/soia_src/user.soia) .soia file.

### Referring to generated symbols

```dart
// Import the given symbols from the Dart module generated from "user.soia"
import 'package:soia_dart_example/soiagen/user.dart';

// Now you can use: tarzan, User, UserHistory, UserRegistry, etc.
```

### Struct classes

For every struct `S` in the .soia file, soia generates a frozen (deeply immutable) class `S` and a mutable class `S_mutable`.

#### Frozen struct classes

```dart
// To construct a frozen User, call the User constructor.

final john = User(
  // All fields are required.
  userId: 42,
  name: "John Doe",
  quote: "Coffee is just a socially acceptable form of rage.",
  pets: [
    User_Pet(
      name: "Dumbo",
      heightInMeters: 1.0,
      picture: "🐘",
    ),
  ],
  subscriptionStatus: User_SubscriptionStatus.free,
  // foo: "bar",
  // ^ Does not compile: 'foo' is not a field of User
);

assert(john.name == "John Doe");

// Lists passed to the constructor are copied into frozen lists to ensure
// deep immutability.
assert(john.pets is List);

// Static type checkers will raise an error if you try to modify a frozen struct:
// john.name = "John Smith";
// ^ Does not compile: all the properties are read-only

// You can also construct a frozen User using the builder pattern with a
// mutable instance as the builder.
final User jane = (User.mutable()
      ..userId = 43
      ..name = "Jane Doe"
      ..pets = [
        User_Pet(name: "Fluffy", heightInMeters: 0.2, picture: "🐱"),
        User_Pet.mutable()
          ..name = "Fido"
          ..heightInMeters = 0.25
          ..picture = "🐶"
          ..toFrozen(),
      ])
    .toFrozen();

// Fields not explicitly set are initialized to their default values.
assert(jane.quote == "");

// User.defaultInstance is an instance of User with all fields set to their
// default values.
assert(User.defaultInstance.name == "");
assert(User.defaultInstance.pets.isEmpty);
```

#### Mutable struct classes

```dart
// 'User_mutable' is a dataclass similar to User except it is mutable.
// Use User.mutable() to create a new instance.
final mutableLyla = User.mutable()..userId = 44;
mutableLyla.name = "Lyla Doe";

final userHistory = UserHistory.mutable();
userHistory.user = mutableLyla;
// ^ The right-hand side of the assignment can be either frozen or mutable.

// userHistory.user.quote = "I am Lyla."
// ^ Static error: quote is readonly because userHistory.user may be frozen

// The 'mutableUser' getter provides access to a mutable version of 'user'.
// If 'user' is already mutable, it returns it directly.
// If 'user' is frozen, it creates a mutable shallow copy, assigns it to
// 'user', and returns it.
userHistory.mutableUser.quote = "I am Lyla.";

// Similarly, 'mutablePets' provides access to a mutable version of 'pets'.
// It returns the existing list if already mutable, or creates and returns a
// mutable shallow copy.
mutableLyla.mutablePets.add(User_Pet(
  name: "Simba",
  heightInMeters: 0.4,
  picture: "🦁",
));
mutableLyla.mutablePets.add(User_Pet.mutable()..name = "Cupcake");
```

#### Converting between frozen and mutable

```dart
// toMutable() does a shallow copy of the frozen struct, so it's cheap. All the
// properties of the copy hold a frozen value.
final evilJane = (jane.toMutable()
      ..name = "Evil Jane"
      ..quote = "I solemnly swear I am up to no good.")
    .toFrozen();

assert(evilJane.name == "Evil Jane");
assert(evilJane.userId == 43);
```

#### Writing logic agnostic of mutability

```dart
// 'User_orMutable' is a type alias for the sealed class that both 'User' and
// 'User_mutable' implement.
void greet(User_orMutable user) {
  print("Hello, ${user.name}");
}

greet(jane);
// Hello, Jane Doe
greet(mutableLyla);
// Hello, Lyla Doe
```

### Enum classes

The definition of the `SubscriptionStatus` enum in the .soia file is:
```rust
enum SubscriptionStatus {
  FREE;
  trial: Trial;
  PREMIUM;
}
```

#### Making enum values

```dart
final johnStatus = User_SubscriptionStatus.free;
final janeStatus = User_SubscriptionStatus.premium;

final jolyStatus = User_SubscriptionStatus.unknown;

// Use wrapX() for data variants (wraps an existing value).
final roniStatus = User_SubscriptionStatus.wrapTrial(
  User_Trial(
    startTime: DateTime.fromMillisecondsSinceEpoch(1234, isUtc: true),
  ),
);

// More concisely, use createX() to create and wrap a new struct with the given params.
final ericStatus = User_SubscriptionStatus.createTrial(
  startTime: DateTime.fromMillisecondsSinceEpoch(5678, isUtc: true),
);
```

#### Conditions on enums

```dart
assert(johnStatus == User_SubscriptionStatus.free);
assert(janeStatus == User_SubscriptionStatus.premium);
assert(jolyStatus == User_SubscriptionStatus.unknown);

if (roniStatus is User_SubscriptionStatus_trialWrapper) {
  assert(roniStatus.value.startTime.millisecondsSinceEpoch == 1234);
}

String getSubscriptionInfoText(User_SubscriptionStatus status) {
  // Use pattern matching for typesafe switches on enums.
  return switch (status) {
    User_SubscriptionStatus_unknown() => "Unknown subscription status",
    User_SubscriptionStatus.free => "Free user",
    User_SubscriptionStatus.premium => "Premium user",
    User_SubscriptionStatus_trialWrapper(:final value) =>
      "On trial since ${value.startTime}",
  };
}
```

### Serialization

Every frozen struct class and enum class has a static readonly `serializer` property which can be used for serializing and deserializing instances of the class.

```dart
// Serialize 'john' to dense JSON.

final serializer = User.serializer;

print(serializer.toJsonCode(john));
// [42,"John Doe","Coffee is just a socially acceptable form of rage.",[["Dumbo",1.0,"🐘"]],[1]]

// Serialize 'john' to readable JSON.
print(serializer.toJsonCode(john, readableFlavor: true));
// {
//   "user_id": 42,
//   "name": "John Doe",
//   "quote": "Coffee is just a socially acceptable form of rage.",
//   "pets": [
//     {
//       "name": "Dumbo",
//       "height_in_meters": 1.0,
//       "picture": "🐘"
//     }
//   ],
//   "subscription_status": "FREE"
// }

// The dense JSON flavor is the flavor you should pick if you intend to
// deserialize the value in the future. Soia allows fields to be renamed, and
// because field names are not part of the dense JSON, renaming a field does
// not prevent you from deserializing the value.
// You should pick the readable flavor mostly for debugging purposes.

// Serialize 'john' to binary format.
print(serializer.toBytes(john));

// The binary format is not human readable, but it is slightly more compact
// than JSON, and serialization/deserialization can be a bit faster in
// languages like C++. Only use it when this small performance gain is likely
// to matter, which should be rare.
```

### Deserialization

```dart
// Use fromJson(), fromJsonCode() and fromBytes() to deserialize.

assert(john == serializer.fromJsonCode(serializer.toJsonCode(john)));

// Also works with readable JSON.
assert(john == serializer.fromJsonCode(
  serializer.toJsonCode(john, readableFlavor: true),
));

final reserializedLyla =
    serializer.fromBytes(serializer.toBytes(mutableLyla.toFrozen()));
assert(reserializedLyla.name == "Lyla Doe");
```

### Frozen lists and copies

```dart
final pets = [
    User_Pet(name: "Fluffy", heightInMeters: 0.25, picture: "🐶"),
    User_Pet(name: "Fido", heightInMeters: 0.5, picture: "🐻"),
];

final jade = User(
  userId: 46,
  name: "Jade",
  quote: "",
  pets: pets,
  // ^ makes a copy of 'pets' because 'pets' is mutable
  subscriptionStatus: User_SubscriptionStatus.unknown,
);

// jade.pets.add(...)
// ^ Compile-time error: pets is a frozen list

assert(!identical(jade.pets, pets));

final jack = User(
  userId: 47,
  name: "Jack",
  quote: "",
  pets: jade.pets,
  // ^ doesn't make a copy because 'jade.pets' is frozen
  subscriptionStatus: User_SubscriptionStatus.unknown,
);

assert(identical(jack.pets, jade.pets));
```

### Keyed lists

```dart
final userRegistry = UserRegistry(
  users: [john, jane, mutableLyla],
);

// findByKey() returns the user with the given key (specified in the .soia file).
// In this example, the key is 'user_id'.
// The first lookup runs in O(N) time, and the following lookups run in O(1)
// time.
assert(userRegistry.users.findByKey(42) == john);
assert(userRegistry.users.findByKey(100) == null);
```

### Constants

```dart
print(tarzan);
// User(
//   userId: 123,
//   name: "Tarzan",
//   quote: "AAAAaAaAaAyAAAAaAaAaAyAAAAaAaAaA",
//   pets: [
//     User_Pet(
//       name: "Cheeta",
//       heightInMeters: 1.67,
//       picture: "🐒",
//     ),
//   ],
//   subscriptionStatus: user_soia:User_SubscriptionStatus.wrapTrial(
//     User_Trial(
//       startTime: DateTime.fromMillisecondsSinceEpoch(
//         // 2025-04-02T11:13:29.000Z
//         1743592409000
//       ),
//     )
//   ),
// )
```

### Soia services

#### Starting a soia service on an HTTP server

Full example [here](https://github.com/gepheum/soia-dart-example/blob/main/bin/start_service.dart).

#### Sending RPCs to a soia service

Full example [here](https://github.com/gepheum/soia-dart-example/blob/main/bin/call_service.dart).

### Reflection

Reflection allows you to inspect a soia type at runtime.

```dart
import 'package:soia/soia.dart' as soia;

final fieldNames = <String>[];
for (final field in User.serializer.typeDescriptor.fields) {
  fieldNames.add(field.name);
}
print(fieldNames);
// [user_id, name, quote, pets, subscription_status]

// A type descriptor can be serialized to JSON and deserialized later.
final typeDescriptor = soia.TypeDescriptor.parseFromJson(
  User.serializer.typeDescriptor.asJson,
);
print("Type descriptor deserialized successfully");
```
