import 'package:test/test.dart';
import '../soiagen/reflection.dart' as reflection;
import "package:soia/soia.dart" as soia;

void main() {
  group('Reflection tests', () {
    test('clear debug works', () {
      final originalCatalog = reflection.Catalog(
        items: [
          reflection.Catalog_Item.createFoo(
            id: 123,
            name: "john",
            debug: "foo",
          ),
          reflection.Catalog_Item.unknown,
          reflection.Catalog_Item.wrapFooOptional(null),
          reflection.Catalog_Item.wrapFooOptional(
            reflection.Catalog_Foo(
              id: 456,
              name: "doe",
              debug: "bar",
            ),
          ),
        ],
      );
      final actualCatalog = const _ClearDebugTransformer().transform(
          originalCatalog, reflection.Catalog.serializer.typeDescriptor);
      expect(
        actualCatalog,
        reflection.Catalog(
          items: [
            reflection.Catalog_Item.wrapFoo(reflection.Catalog_Foo(
              id: 123,
              name: "john",
              debug: "",
            )),
            reflection.Catalog_Item.unknown,
            reflection.Catalog_Item.wrapFooOptional(null),
            reflection.Catalog_Item.wrapFooOptional(
              reflection.Catalog_Foo(
                id: 456,
                name: "doe",
                debug: "",
              ),
            ),
          ],
        ),
      );
    });

    test('upper casify strings', () {
      final originalCatalog = reflection.Catalog(
        items: [
          reflection.Catalog_Item.createFoo(
              id: 123, name: "john", debug: "foo"),
          reflection.Catalog_Item.unknown,
          reflection.Catalog_Item.wrapFooOptional(null),
          reflection.Catalog_Item.wrapFooOptional(
            reflection.Catalog_Foo(id: 456, name: "doe", debug: "bar"),
          ),
        ],
      );
      final actualCatalog = const _UpperCasifyTransformer().transform(
          originalCatalog, reflection.Catalog.serializer.typeDescriptor);
      expect(
        actualCatalog,
        reflection.Catalog(
          items: [
            reflection.Catalog_Item.wrapFoo(reflection.Catalog_Foo(
              id: 123,
              name: "JOHN",
              debug: "FOO",
            )),
            reflection.Catalog_Item.unknown,
            reflection.Catalog_Item.wrapFooOptional(null),
            reflection.Catalog_Item.wrapFooOptional(
              reflection.Catalog_Foo(
                id: 456,
                name: "DOE",
                debug: "BAR",
              ),
            ),
          ],
        ),
      );
    });
  });
}

// -----------------------------------------------------------------------------
// BEGIN: clear debug
// -----------------------------------------------------------------------------

class _ClearDebugTransformer implements soia.ReflectiveTransformer {
  const _ClearDebugTransformer();

  @override
  T transform<T>(T input, soia.ReflectiveTypeDescriptor<T> descriptor) {
    final visitor = _ClearDebugVisitor<T>(input);
    descriptor.accept(visitor);
    return visitor.result;
  }
}

class _ClearDebugVisitor<T> extends soia.NoopReflectiveTypeVisitor<T> {
  final T input;
  T result;

  _ClearDebugVisitor(this.input) : result = input;

  @override
  void visitOptional<NotNull>(
      soia.ReflectiveOptionalDescriptor<NotNull> descriptor,
      soia.TypeEquivalence<T, NotNull?> equivalence) {
    result = equivalence.toT(
      descriptor.map(
        equivalence.fromT(input),
        const _ClearDebugTransformer(),
      ),
    );
  }

  @override
  void visitArray<E, Collection extends Iterable<E>>(
      soia.ReflectiveArrayDescriptor<E, Collection> descriptor,
      soia.TypeEquivalence<T, Collection> equivalence) {
    result = equivalence.toT(
      descriptor.map(
        equivalence.fromT(input),
        const _ClearDebugTransformer(),
      ),
    );
  }

  @override
  void visitStruct<Mutable>(
      soia.ReflectiveStructDescriptor<T, Mutable> descriptor) {
    final mutable = descriptor.newMutable();
    for (final field in descriptor.fields) {
      if (field.name != 'debug') {
        field.copy(
          input,
          mutable,
          transformer: const _ClearDebugTransformer(),
        );
      }
    }
    result = descriptor.toFrozen(mutable);
  }

  @override
  void visitEnum(soia.ReflectiveEnumDescriptor<T> descriptor) {
    result = descriptor.mapValue(
      input,
      const _ClearDebugTransformer(),
    );
  }
}

// -----------------------------------------------------------------------------
// end: clear debug
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// BEGIN: upper casify
// -----------------------------------------------------------------------------

class _UpperCasifyTransformer implements soia.ReflectiveTransformer {
  const _UpperCasifyTransformer();

  @override
  T transform<T>(T input, soia.ReflectiveTypeDescriptor<T> descriptor) {
    final visitor = _UpperCasifyVisitor<T>(input);
    descriptor.accept(visitor);
    return visitor.result;
  }
}

class _UpperCasifyVisitor<T> extends soia.NoopReflectiveTypeVisitor<T> {
  final T input;
  T result;

  _UpperCasifyVisitor(this.input) : result = input;

  @override
  void visitOptional<NotNull>(
      soia.ReflectiveOptionalDescriptor<NotNull> descriptor,
      soia.TypeEquivalence<T, NotNull?> equivalence) {
    result = equivalence.toT(
      descriptor.map(
        equivalence.fromT(input),
        const _UpperCasifyTransformer(),
      ),
    );
  }

  @override
  void visitArray<E, Collection extends Iterable<E>>(
      soia.ReflectiveArrayDescriptor<E, Collection> descriptor,
      soia.TypeEquivalence<T, Collection> equivalence) {
    result = equivalence.toT(
      descriptor.map(
        equivalence.fromT(input),
        const _UpperCasifyTransformer(),
      ),
    );
  }

  @override
  void visitStruct<Mutable>(
      soia.ReflectiveStructDescriptor<T, Mutable> descriptor) {
    result = descriptor.mapFields(
      input,
      const _UpperCasifyTransformer(),
    );
  }

  @override
  void visitEnum(soia.ReflectiveEnumDescriptor<T> descriptor) {
    result = descriptor.mapValue(
      input,
      const _UpperCasifyTransformer(),
    );
  }

  @override
  void visitString(soia.TypeEquivalence<T, String> equivalence) {
    result = equivalence.toT(
      equivalence.fromT(input).toUpperCase(),
    );
  }
}

// -----------------------------------------------------------------------------
// end: upper casify
// -----------------------------------------------------------------------------
