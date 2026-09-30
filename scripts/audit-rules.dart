import 'dart:convert';
import 'dart:io';
import 'package:baka/models/custom_source_config.dart';

import 'package:baka/source/engine/pipeline_host.dart';
import 'package:baka/source/engine/pipeline_interpreter.dart';
import 'package:baka/source/engine/recipes.dart';
import 'package:baka/source/engine/rule_validator.dart';
import 'package:baka/source/html_parser.dart';
import 'package:baka/source/hls/hls_manifest_decoder.dart';
import 'package:baka/source/models/episode.dart';
import 'package:baka/source/models/series.dart';
import 'package:baka/source/models/source.dart';
import 'package:baka/source/models/source_rule.dart';
import 'package:baka/source/runtime/request_scheduler.dart';
import 'package:baka/source/runtime/source_operation.dart';
import 'package:baka/source/video_url_extractor.dart';
import 'package:html/parser.dart' show parse;
import 'package:xpath_selector_html_parser/xpath_selector_html_parser.dart';

class AuditHost implements PipelineHost {
  AuditHost(this.rule, this.dir, {this.direct = true});
  final SourceRule rule;
  final Directory dir;
  final bool direct;
  final requests = <Map<String, dynamic>>[];
  final browserTasks = <Map<String, dynamic>>[];
  int seq = 0;
  @override
  String get baseUrl => rule.baseUrl;
  @override
  Map<String, String> get ruleHeaders => rule.headers;
  @override
  bool get allowWebview => rule.useWebview;
  @override
  String toAbsolute(String url, String base) =>
      VideoUrlExtractor.toAbsolute(url, base);
  @override
  String normalizeUrl(String url, String pageUrl) =>
      VideoUrlExtractor.normalizeResolvedUrl(
        url,
        pageUrl,
        preserveMagnet: true,
      );
  @override
  bool isPlayable(String url) =>
      url.startsWith('magnet:') || VideoUrlExtractor.isPlayable(url);

  Future<({int status, List<int> bytes, String headers, String url})> request(
    String url, {
    String method = 'GET',
    Map<String, String>? headers,
    Object? body,
    String? contentType,
    String? referer,
    bool media = false,
  }) async {
    final number = ++seq;
    final path = '${dir.path}/$number';
    final merged = <String, String>{
      if (!media) ...ruleHeaders,
      if (referer != null) 'Referer': referer,
      ...?headers,
    };
    final args = <String>[
      '-sS',
      '--compressed',
      '-L',
      '--connect-timeout',
      '8',
      '--max-time',
      '25',
      '--max-filesize',
      '4194304',
      '-D',
      '$path.headers',
      '-o',
      '$path.body',
      '-b',
      '${dir.path}/cookies.txt',
      '-c',
      '${dir.path}/cookies.txt',
      '-w',
      '%{http_code}\n%{url_effective}',
      '-X',
      method,
    ];
    if (direct) args.addAll(['--noproxy', '*']);
    if (media) args.addAll(['--range', '0-65535']);
    if (body != null) {
      String payload;
      if ((contentType == 'form' || (merged['Content-Type'] ?? '').contains('application/x-www-form-urlencoded')) && body is Map) {
        payload = body.entries
            .map(
              (e) =>
                  '${Uri.encodeQueryComponent(e.key.toString())}=${Uri.encodeQueryComponent(e.value.toString())}',
            )
            .join('&');
        merged['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        payload = body is String ? body : jsonEncode(body);
        merged['Content-Type'] = merged['Content-Type'] ?? contentType ?? 'application/json';
      }
      File('$path.input').writeAsStringSync(payload);
      args.addAll(['--data-binary', '@$path.input']);
    }
    for (final entry in merged.entries)
      args.addAll(['-H', '${entry.key}: ${entry.value}']);
    args.add(Uri.parse(url).toString());
    final clock = Stopwatch()..start();
    final result = await Process.run('curl.exe', args);
    final info = result.stdout.toString().trim().split('\n');
    final status = int.tryParse(info.first.trim()) ?? 0;
    final bytes = File('$path.body').existsSync()
        ? File('$path.body').readAsBytesSync()
        : <int>[];
    final responseHeaders = File('$path.headers').existsSync()
        ? File('$path.headers').readAsStringSync()
        : '';
    requests.add({
      'method': method,
      'url': url,
      'status': status,
      'ms': clock.elapsedMilliseconds,
      'bytes': bytes.length,
      'exit': result.exitCode,
      if (result.exitCode != 0) 'error': result.stderr.toString().trim(),
      'bodyFile': '$path.body',
    });
    return (
      status: status,
      bytes: bytes,
      headers: responseHeaders,
      url: info.length > 1 ? info.last.trim() : url,
    );
  }

  @override
  Future<String> fetch(
    String url, {
    String method = 'GET',
    Map<String, String>? headers,
    Object? body,
    String? referer,
    String? contentType,
    SourceOperation? operation,
    RequestPriority priority = RequestPriority.search,
  }) async {
    SourceOperation.check();
    final response = await request(
      url,
      method: method,
      headers: headers,
      body: body,
      contentType: contentType,
      referer: referer,
    );
    SourceOperation.check();
    return response.status >= 200 && response.status < 300
        ? utf8.decode(response.bytes, allowMalformed: true)
        : '';
  }

  @override
  List<Series> parseSearchList(
    String html, {
    required List<String> selectors,
    String? detailPattern,
  }) => HtmlParser.parseSearchResults(
    parse(html),
    baseUrl: baseUrl,
    selectors: selectors,
    detailPattern: detailPattern,
  );
  @override
  List<Source> parseEpisodes(
    String html, {
    required List<String> listSelectors,
    List<String>? tabSelectors,
  }) => HtmlParser.parseSources(
    parse(html),
    baseUrl: baseUrl,
    listSelectors: listSelectors.isEmpty ? null : listSelectors,
    tabSelectors: tabSelectors,
  );
  @override
  List<Series> parseSearchListXPath(
    String html, {
    required String listXPath,
    required String nameXPath,
    required String linkXPath,
  }) {
    final results = <Series>[];
    final root = parse(html).documentElement;
    if (root == null) return results;
    for (final node in root.queryXPath(listXPath).nodes) {
      final link = linkXPath.isEmpty ? node : node.queryXPath(linkXPath).node;
      final href = link?.attributes['href'] ?? '';
      final name =
          (nameXPath.isEmpty
              ? node.node.text
              : node.queryXPath(nameXPath).node?.text) ??
          '';
      if (href.isNotEmpty)
        results.add(Series(toAbsolute(href, baseUrl), name.trim()));
    }
    return results;
  }

  @override
  List<Source> parseEpisodesXPath(
    String html, {
    required String roadsXPath,
    required String itemsXPath,
  }) {
    final results = <Source>[];
    final root = parse(html).documentElement;
    if (root == null) return results;
    for (final road in root.queryXPath(roadsXPath).nodes) {
      final episodes = <Episode>[];
      for (final item in road.queryXPath(itemsXPath).nodes) {
        final href = item.attributes['href'] ?? '';
        if (href.isNotEmpty)
          episodes.add(
            Episode(
              toAbsolute(href, baseUrl),
              episodes.length,
              item.node.text ?? '',
            ),
          );
      }
      if (episodes.isNotEmpty)
        results.add(Source(episodes, '播放列表${results.length + 1}'));
    }
    return results;
  }

  @override
  String extractVideoUrl(String content, String pageUrl) =>
      VideoUrlExtractor.extractBest(
        content,
        pageUrl.isEmpty ? baseUrl : pageUrl,
      );
  @override
  String? selectAttr(String html, String selector, String attr) {
    final node = parse(html).querySelector(selector);
    if (node == null) return null;
    return attr == 'text' ? node.text.trim() : node.attributes[attr];
  }

  @override
  List<String> selectAll(String html, String selector, String attr) =>
      parse(html)
          .querySelectorAll(selector)
          .map(
            (node) =>
                attr == 'text' ? node.text.trim() : node.attributes[attr] ?? '',
          )
          .where((value) => value.isNotEmpty)
          .toList();
  @override
  Future<String> renderWithWebview(
    String url, {
    bool Function(String html)? isReady,
    Duration timeout = const Duration(seconds: 30),
    Duration settleDelay = const Duration(seconds: 1),
  }) async {
    browserTasks.add({'goal': 'html', 'url': url});
    return '';
  }

  @override
  Future<String> sniffWithWebview(String url) async {
    browserTasks.add({'goal': 'video', 'url': url});
    return '';
  }

  Map<String, String> mediaHeaders(PipelinePlayResult media) {
    final headers = <String, String>{...(media.mediaHeaders.isEmpty ? rule.headers : media.mediaHeaders)};
    headers.removeWhere((_, value) => value.isEmpty);
    if (VideoUrlExtractor.isSignedCdnUrl(media.url)) headers.removeWhere((key, _) => key.toLowerCase() == 'referer');
    final jar = File('${dir.path}/cookies.txt');
    if (jar.existsSync() &&
        (media.cookieNames.isNotEmpty || media.cookiePrefixes.isNotEmpty)) {
      final cookies = <String>[];
      for (var line in jar.readAsLinesSync()) {
        if (line.startsWith('#HttpOnly_')) line = line.substring(10);
        if (line.startsWith('#')) continue;
        final fields = line.split('\t');
        if (fields.length != 7) continue;
        final name = fields[5];
        if (media.cookieNames.contains(name) ||
            media.cookiePrefixes.any(name.startsWith))
          cookies.add('$name=${fields[6]}');
      }
      if (cookies.isNotEmpty) headers['Cookie'] = cookies.join('; ');
    }
    return headers;
  }
}

Future<Map<String, dynamic>> verifyMedia(
  AuditHost host,
  String url,
  Map<String, String> headers,
) async {
  if (url == 'https://player.gugu3.com/milimili.mp4' || url == 'https://save.15cq.fun/aniwatch.mp4') return {'ok': false, 'kind': 'upstream_placeholder'};
  if (url.startsWith('magnet:'))
    return {
      'kind': 'magnet',
      'ok': RegExp(
        r'xt=urn:btih:[a-fA-F0-9]{40}(?:&|$)|xt=urn:btih:[a-zA-Z2-7]{32}(?:&|$)',
      ).hasMatch(url),
    };
  var current = url;
  for (var depth = 0; depth < 4; depth++) {
    final response = await host.request(current, headers: headers, media: true);
    Map<String, dynamic>? decoder;
    void inspect(List<PipelineStep> steps) {
      for (final step in steps) {
        final config = step.params['hlsManifestDecode'];
        if (config is Map) decoder ??= config.cast<String, dynamic>();
        for (final branch in step.branches) { inspect(branch); }
      }
    }
    inspect(host.rule.play);
    final text = (decoder == null || !current.contains('.m3u8') ? utf8.decode(response.bytes, allowMalformed: true) : HlsManifestDecoder.decode(response.bytes, decoder!)).trimLeft();
    if (response.status != 200 && response.status != 206)
      return {'ok': false, 'status': response.status, 'kind': 'http_failure'};
    if (text.startsWith('#EXTM3U')) {
      final lines = text.split(RegExp(r'\r?\n'));
      final candidates = lines
          .where((s) => s.trim().isNotEmpty && !s.startsWith('#'))
          .toList();
      if (candidates.isEmpty) return {'ok': false, 'kind': 'empty_hls'};
      current = Uri.parse(
        response.url,
      ).resolve(candidates.first.trim()).toString();
      if (text.contains('#EXT-X-STREAM-INF')) continue;
      final segment = await host.request(
        current,
        headers: headers,
        media: true,
      );
      final prefix = utf8
          .decode(segment.bytes.take(128).toList(), allowMalformed: true)
          .trimLeft();
      final valid =
          (segment.status == 200 || segment.status == 206) &&
          segment.bytes.length >= 188 &&
          !prefix.startsWith('<') &&
          !prefix.startsWith('{');
      return {
        'ok': valid,
        'kind': 'hls_segment',
        'status': response.status,
        'segmentStatus': segment.status,
        'segmentBytes': segment.bytes.length,
        'encrypted': text.contains('#EXT-X-KEY'),
      };
    }
    final mp4 =
        response.bytes.length > 12 &&
        ascii.decode(response.bytes.sublist(4, 8), allowInvalid: true) ==
            'ftyp';
    final ts = response.bytes.length >= 188 && response.bytes.first == 0x47;
    return {
      'ok': mp4 || ts,
      'kind': mp4
          ? 'mp4_range'
          : ts
          ? 'mpeg_ts'
          : 'unrecognized_body',
      'status': response.status,
      'bytes': response.bytes.length,
    };
  }
  return {'ok': false, 'kind': 'hls_depth_limit'};
}

Future<Map<String, dynamic>> audit(
  File file,
  Map<String, String> options,
) async {
  final rule = Recipes.expand(CustomSourceConfig.fromJson(
      jsonDecode(file.readAsStringSync()) as Map<String, dynamic>,
    ).rule);
  final dir = Directory('${options['out']}/${rule.id}')
    ..createSync(recursive: true);
  final host = AuditHost(rule, dir, direct: options['proxy'] != 'true');
  final interpreter = PipelineInterpreter();
  final result = <String, dynamic>{
    'id': rule.id,
    'baseUrl': rule.baseUrl,
    'timeUtc': DateTime.now().toUtc().toIso8601String(),
    'mode': host.direct ? 'direct' : 'default',
    'validationErrors': RuleValidator.validate(rule).errors,
  };
  Future<T> stage<T>(String name, Future<T> Function() fn) async {
    final clock = Stopwatch()..start();
    final operation = SourceOperation(timeout: const Duration(seconds: 90));
    final before = host.requests.length;
    try {
      return await operation.run(fn);
    } finally {
      operation.close();
      result['${name}Ms'] = clock.elapsedMilliseconds;
      result['${name}Requests'] = host.requests.length - before;
    }
  }

  try {
    if (options['validate-only'] == 'true') {
      result['status'] = (result['validationErrors'] as List).isEmpty ? 'validated' : 'validation_failed';
      return result;
    }
    final suppliedEpisode = options['episode'];
    List<Source> sources;
    if (suppliedEpisode != null) {
      sources = [
        Source([Episode(suppliedEpisode, 0, 'supplied')]),
      ];
    } else {
      var seriesId = options['series'];
      if (seriesId == null) {
        final keyword =
            options['keyword'] ??
            (rule.id == 'anime1'
                ? '異世界'
                : rule.id == 'animoe'
                ? '海'
                : rule.id == 'aniwatch'
                ? 'Re'
                : rule.id == 'hanimeone'
                ? 'OVA'
                : '海贼');
        final series = await stage(
          'search',
          () => interpreter.runSearch(rule, host, keyword),
        );
        result['keyword'] = keyword;
        result['searchCount'] = series.length;
        result['series'] = series
            .take(4)
            .map((s) => {'id': s.seriesId, 'name': s.name})
            .toList();
        if (series.isEmpty) {
          result['status'] = host.browserTasks.isNotEmpty
              ? 'browser_required_search'
              : 'search_empty';
          return result;
        }
        seriesId = series.first.seriesId;
      }
      result['selectedSeries'] = seriesId;
      sources = await stage(
        'detail',
        () => interpreter.runDetail(rule, host, seriesId!),
      );
      result['lines'] = sources
          .map((s) => {'name': s.sourceName, 'episodes': s.episodes.length})
          .toList();
      if (sources.isEmpty) {
        result['status'] = host.browserTasks.isNotEmpty
            ? 'browser_required_detail'
            : 'detail_empty';
        return result;
      }
    }
    final plays = <Map<String, dynamic>>[];
    for (final source in sources.take(
      int.tryParse(options['lines'] ?? '2') ?? 2,
    )) {
      if (source.episodes.isEmpty) continue;
      final episode = source.episodes.first;
      final browserBefore = host.browserTasks.length;
      final media = await stage(
        'play${plays.length}',
        () => interpreter.runPlayMedia(rule, host, episode.episodeId),
      );
      final attempt = <String, dynamic>{
        'line': source.sourceName,
        'episode': episode.episodeId,
        'url': media.url,
        'headers': host.mediaHeaders(media),
      };
      if (media.url.isEmpty) {
        attempt['status'] = host.browserTasks.length > browserBefore
            ? 'browser_required_play'
            : 'play_empty';
      } else {
        attempt['media'] = await verifyMedia(
          host,
          media.url,
          host.mediaHeaders(media),
        );
        attempt['status'] = (attempt['media'] as Map)['ok'] == true
            ? 'verified'
            : 'media_failed';
      }
      plays.add(attempt);
    }
    result['plays'] = plays;
    result['status'] = plays.any((p) => p['status'] == 'verified')
        ? 'verified'
        : plays.any((p) => p['status'] == 'browser_required_play')
        ? 'browser_required_play'
        : 'play_failed';
  } catch (e, stack) {
    result['status'] = 'error';
    result['error'] = e.toString();
    result['stack'] = stack.toString().split('\n').take(4).join('\n');
  } finally {
    result['requests'] = host.requests;
    result['browserTasks'] = host.browserTasks;
    File(
      '${dir.path}/result.json',
    ).writeAsStringSync(const JsonEncoder.withIndent('  ').convert(result));
    stdout.writeln(
      '${rule.id}: ${result['status']} (${host.requests.length} requests)',
    );
  }
  return result;
}

Future<void> main(List<String> args) async {
  final options = <String, String>{
    'rules': '../AniBakaRule',
    'out': '.dart_tool/rule_audit/latest',
  };
  for (final arg in args) {
    final pair = arg.replaceFirst(RegExp(r'^--'), '').split('=');
    options[pair.first] = pair.skip(1).join('=');
  }
  final ids = options['ids']?.split(',').toSet();
  final files =
      Directory(options['rules']!)
          .listSync()
          .whereType<File>()
          .where(
            (f) =>
                f.path.endsWith('.json') &&
                !f.path.endsWith('index.json') &&
                (ids == null ||
                    ids.contains(
                      f.uri.pathSegments.last.replaceAll('.json', ''),
                    )),
          )
          .toList()
        ..sort((a, b) => a.path.compareTo(b.path));
  final results = <Map<String, dynamic>>[];
  var next = 0;
  Future<void> worker() async {
    while (next < files.length) {
      final file = files[next++];
      results.add(await audit(file, options));
    }
  }

  await Future.wait(
    List.generate(
      int.tryParse(options['workers'] ?? '3') ?? 3,
      (_) => worker(),
    ),
  );
  File(
    '${options['out']}/summary.json',
  ).writeAsStringSync(const JsonEncoder.withIndent('  ').convert(results));
  if (options['validate-only'] == 'true' && results.any((r) => r['status'] != 'validated')) throw StateError('Rule validation failed');
}
