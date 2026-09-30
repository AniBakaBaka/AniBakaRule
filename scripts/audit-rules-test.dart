import 'dart:io';
import 'package:test/test.dart';
import 'audit-rules.dart' as audit;

void main() {
  test('live rule pipelines', () async {
    final args =
        Platform.environment['RULE_AUDIT_ARGS'] ??
        const String.fromEnvironment('RULE_AUDIT_ARGS');
    await audit.main(args.split(' ').where((s) => s.isNotEmpty).toList());
  }, timeout: const Timeout(Duration(minutes: 30)));
}
