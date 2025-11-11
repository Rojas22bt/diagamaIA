import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { projectApi } from '../api/projectApi';
import '../styles/GenerationBackendSprintBoot.css';

// Tipos de Modelo UML (alineados con GenerationBackendSprintBoot)
type UMLAttribute = { name: string; type: string };
type UMLMethod = { name: string; returns: string };
type UMLClassNode = {
  id: string;
  displayId: number;
  name: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  attributes: UMLAttribute[];
  methods: UMLMethod[];
};
type UMLRelationType = 'asociacion' | 'herencia' | 'agregacion' | 'composicion';
type UMLRelation = {
  id: string;
  fromDisplayId: number;
  toDisplayId: number;
  type: UMLRelationType;
  originCard?: string;
  destCard?: string;
  verb?: string;
};
type DiagramModel = {
  version: 1;
  nextDisplayId: number;
  classes: UMLClassNode[];
  relations: UMLRelation[];
};

// Configuración Flutter
type FlutterConfig = {
  appName: string;      // visible en la app
  appId: string;        // packageId: com.example.app
  apiBaseUrl: string;   // http://localhost:8080/api
};

const DEFAULT_FLUTTER_CONFIG: FlutterConfig = {
  appName: 'UML Flutter App',
  appId: 'com.example.umlflutterapp',
  apiBaseUrl: 'http://10.0.2.2:8000/api' // Cambiado para emulador Android
};
// --- NUEVO: Forzar campo 'id' y normalizar nombres a minúsculas ---
function normalizeAndForceId(diagram: DiagramModel): DiagramModel {
  const newClasses = diagram.classes.map(cls => {
    // Normalizar nombre de clase a minúsculas
    const normalizedName = cls.name.toLowerCase();
    // Normalizar atributos a minúsculas y forzar 'id' si falta
    let hasId = cls.attributes.some(a => toFieldName(a.name) === 'id');
    const newAttributes = cls.attributes.map(a => ({
      name: a.name.toLowerCase(),
      type: a.type.toLowerCase()
    }));
    if (!hasId) {
      newAttributes.unshift({ name: 'id', type: 'int' });
    }
    // Normalizar métodos
    const newMethods = cls.methods.map(m => ({
      name: m.name.toLowerCase(),
      returns: m.returns.toLowerCase()
    }));
    return {
      ...cls,
      name: normalizedName,
      attributes: newAttributes,
      methods: newMethods
    };
  });
  // Normalizar relaciones
  const newRelations = diagram.relations.map(rel => ({
    ...rel,
    type: rel.type.toLowerCase() as UMLRelationType,
    verb: rel.verb ? rel.verb.toLowerCase() : rel.verb,
    originCard: rel.originCard ? rel.originCard.toLowerCase() : rel.originCard,
    destCard: rel.destCard ? rel.destCard.toLowerCase() : rel.destCard
  }));
  return {
    ...diagram,
    classes: newClasses,
    relations: newRelations
  };
}

const RESERVED_TABLE_NAMES: Record<string, string> = { order: 'orders', user: 'users' };

// Utilidades comunes
const sanitizeIdentifier = (raw: string): string =>
  (raw || 'Unnamed').replace(/[^A-Za-z0-9_]/g, '').replace(/^[0-9]+/, '') || 'Unnamed';

const sanitizeTableName = (raw: string): string => {
  const lower = (raw || '').toLowerCase();
  if (RESERVED_TABLE_NAMES[lower]) return RESERVED_TABLE_NAMES[lower];
  return lower;
};

const toFieldName = (raw: string): string => {
  if (!raw) return 'field';
  let s = raw.trim();
  s = s.replace(/\s+/g, '_');
  s = s.replace(/[^A-Za-z0-9_]/g, '');
  if (s.length === 0) s = 'field';
  if (/^[0-9]/.test(s)) s = 'f_' + s;
  s = s.charAt(0).toLowerCase() + s.slice(1);
  return s;
};

const toClassName = (raw: string): string => {
  const s = sanitizeIdentifier(raw);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const pluralize = (raw: string): string => `${sanitizeTableName(raw)}s`;

const mapUMLTypeToDart = (umlType: string): string => {
  const t = (umlType || '').trim().toLowerCase();
  switch (t) {
    case 'int':
    case 'integer':
    case 'long':
      return 'int';
    case 'float':
    case 'double':
    case 'decimal':
    case 'bigdecimal':
      return 'double';
    case 'bool':
    case 'boolean':
      return 'bool';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'String'; // ISO string para simplicidad
    case 'string':
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
    default:
      return 'String';
  }
};

// Relaciones → campos DTO
type ProcessedRelation = {
  ownerId: number;
  relatedId: number;
  ownerClassName: string;
  relatedClassName: string;
  fieldName: string;
  type: 'ManyToOne' | 'OneToMany' | 'OneToOne' | 'ManyToMany' | 'Inheritance';
  isOwner: boolean;
  inverse?: string;
  umlType: UMLRelationType;
};

const getRelType = (
  relationType: UMLRelationType,
  originCard?: string,
  destCard?: string
): {
  fromSide: 'ManyToOne' | 'OneToMany' | 'OneToOne' | 'ManyToMany' | 'Inheritance' | null;
  toSide: 'ManyToOne' | 'OneToMany' | 'OneToOne' | 'ManyToMany' | 'Inheritance' | null;
} => {
  if (relationType === 'herencia') return { fromSide: null, toSide: 'Inheritance' };
  const isOriginMany = originCard === '*' || originCard?.includes('*');
  const isDestMany = destCard === '*' || destCard?.includes('*');
  if (!isOriginMany && !isDestMany) return { fromSide: 'OneToOne', toSide: 'OneToOne' };
  if (!isOriginMany && isDestMany) return { fromSide: 'OneToMany', toSide: 'ManyToOne' };
  if (isOriginMany && !isDestMany) return { fromSide: 'ManyToOne', toSide: 'OneToMany' };
  return { fromSide: 'ManyToMany', toSide: 'ManyToMany' };
};

const processRelations = (relations: UMLRelation[], classes: UMLClassNode[]): ProcessedRelation[] => {
  const processed: ProcessedRelation[] = [];
  relations.forEach(rel => {
    const from = classes.find(c => c.displayId === rel.fromDisplayId);
    const to = classes.find(c => c.displayId === rel.toDisplayId);
    if (!from || !to) return;
    const fromName = toClassName(from.name);
    const toName = toClassName(to.name);
    const { fromSide, toSide } = getRelType(rel.type, rel.originCard, rel.destCard);
    if (rel.type === 'herencia') {
      processed.push({ ownerId: rel.fromDisplayId, relatedId: rel.toDisplayId, ownerClassName: fromName, relatedClassName: toName, fieldName: 'parent', type: 'Inheritance', isOwner: true, umlType: rel.type });
      return;
    }
    if (fromSide === 'OneToMany' && toSide === 'ManyToOne') {
      processed.push({ ownerId: rel.toDisplayId, relatedId: rel.fromDisplayId, ownerClassName: toName, relatedClassName: fromName, fieldName: fromName.charAt(0).toLowerCase() + fromName.slice(1), type: 'ManyToOne', isOwner: true, umlType: rel.type });
      processed.push({ ownerId: rel.fromDisplayId, relatedId: rel.toDisplayId, ownerClassName: fromName, relatedClassName: toName, fieldName: toName.charAt(0).toLowerCase() + toName.slice(1) + 's', type: 'OneToMany', isOwner: false, inverse: fromName.charAt(0).toLowerCase() + fromName.slice(1), umlType: rel.type });
    } else if (fromSide === 'ManyToOne' && toSide === 'OneToMany') {
      processed.push({ ownerId: rel.fromDisplayId, relatedId: rel.toDisplayId, ownerClassName: fromName, relatedClassName: toName, fieldName: toName.charAt(0).toLowerCase() + toName.slice(1), type: 'ManyToOne', isOwner: true, umlType: rel.type });
      processed.push({ ownerId: rel.toDisplayId, relatedId: rel.fromDisplayId, ownerClassName: toName, relatedClassName: fromName, fieldName: fromName.charAt(0).toLowerCase() + fromName.slice(1) + 's', type: 'OneToMany', isOwner: false, inverse: toName.charAt(0).toLowerCase() + toName.slice(1), umlType: rel.type });
    } else if (fromSide === 'OneToOne' && toSide === 'OneToOne') {
      processed.push({ ownerId: rel.toDisplayId, relatedId: rel.fromDisplayId, ownerClassName: toName, relatedClassName: fromName, fieldName: fromName.charAt(0).toLowerCase() + fromName.slice(1), type: 'OneToOne', isOwner: true, umlType: rel.type });
      processed.push({ ownerId: rel.fromDisplayId, relatedId: rel.toDisplayId, ownerClassName: fromName, relatedClassName: toName, fieldName: toName.charAt(0).toLowerCase() + toName.slice(1), type: 'OneToOne', isOwner: false, inverse: fromName.charAt(0).toLowerCase() + fromName.slice(1), umlType: rel.type });
    } else if (fromSide === 'ManyToMany' && toSide === 'ManyToMany') {
      processed.push({ ownerId: rel.fromDisplayId, relatedId: rel.toDisplayId, ownerClassName: fromName, relatedClassName: toName, fieldName: toName.charAt(0).toLowerCase() + toName.slice(1) + 's', type: 'ManyToMany', isOwner: true, umlType: rel.type });
      processed.push({ ownerId: rel.toDisplayId, relatedId: rel.fromDisplayId, ownerClassName: toName, relatedClassName: fromName, fieldName: fromName.charAt(0).toLowerCase() + fromName.slice(1) + 's', type: 'ManyToMany', isOwner: false, inverse: toName.charAt(0).toLowerCase() + toName.slice(1) + 's', umlType: rel.type });
    }
  });
  return processed;
};

// Generadores de archivos Flutter
const genPubspec = (name: string) => `name: ${name}
description: A generated Flutter app for UML CRUD
publish_to: "none"
version: 1.0.0+1

environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
`;

const genConfigDart = (cfg: FlutterConfig) => `class AppConfig {
  static const String apiBaseUrl = '${cfg.apiBaseUrl}';
}
`;

const genApiServiceDart = () => `import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

class ApiService {
  final String baseUrl = AppConfig.apiBaseUrl;

  Uri _uri(String path) => Uri.parse('\$baseUrl\$path');

  Future<List<dynamic>> getList(String path) async {
    final res = await http.get(_uri(path));
    if (res.statusCode >= 200 && res.statusCode < 300) {
      final body = json.decode(res.body);
      if (body is List) return body;
      if (body is Map && body['content'] is List) return body['content'];
      return [];
    }
    throw Exception('GET list failed: \${res.statusCode}');
  }

  Future<Map<String, dynamic>> getById(String path) async {
    final res = await http.get(_uri(path));
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return json.decode(res.body) as Map<String, dynamic>;
    }
    throw Exception('GET by id failed: \${res.statusCode}');
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> data) async {
    final res = await http.post(_uri(path), headers: {'Content-Type':'application/json'}, body: json.encode(data));
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return json.decode(res.body) as Map<String, dynamic>;
    }
    throw Exception('POST failed: \${res.statusCode}');
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> data) async {
    final res = await http.put(_uri(path), headers: {'Content-Type':'application/json'}, body: json.encode(data));
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return json.decode(res.body) as Map<String, dynamic>;
    }
    throw Exception('PUT failed: \${res.statusCode}');
  }

  Future<void> delete(String path) async {
    final res = await http.delete(_uri(path));
    if (res.statusCode >= 200 && res.statusCode < 300) return;
    throw Exception('DELETE failed: \${res.statusCode}');
  }
}
`;

// CORREGIDO: rutas consistentes y sin efectos colaterales
const genMainDart = (cfg: FlutterConfig, classes: UMLClassNode[]) => {
  const routes = classes.map(c => {
    const name = toClassName(c.name);
    return `'/${pluralize(name)}': (ctx) => ${name}ListPage(),`;
  }).join('\n    ');

  const imports = classes.map(c => `import 'screens/${sanitizeTableName(c.name)}/${sanitizeTableName(c.name)}_list.dart';`).join('\n');

  const tiles = classes.map(c => {
    const name = toClassName(c.name);
    const plural = pluralize(name);
    return `Card(
          child: ListTile(
            title: Text('${name}'),
            subtitle: Text('CRUD de ${name}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.pushNamed(context, '/${plural}'),
          ),
        )`;
  }).join(',\n        ');

  return `import 'package:flutter/material.dart';
${imports}

void main() {
  runApp(const GeneratedApp());
}

class GeneratedApp extends StatelessWidget {
  const GeneratedApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${cfg.appName}',
      theme: ThemeData(
        colorSchemeSeed: Colors.blue,
        useMaterial3: true,
      ),
      routes: {
        '/': (ctx) => const HomePage(),
    ${routes}
      },
      initialRoute: '/',
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Módulos')),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
        ${tiles}
        ],
      ),
    );
  }
}
`;
};

// CORREGIDO: genera constructor sin “this.[]” y con asignación segura para listas
const genModelDart = (c: UMLClassNode, relations: ProcessedRelation[]) => {
  const name = toClassName(c.name);

  type FieldMeta = { name: string; type: string; isList: boolean; hasDefaultList: boolean };
  const metas: FieldMeta[] = [];

  // Atributos UML
  c.attributes.forEach(a => {
    const f = toFieldName(a.name);
    if (f === 'id') {
      metas.push({ name: 'id', type: 'int?', isList: false, hasDefaultList: false });
    } else {
      metas.push({ name: f, type: `${mapUMLTypeToDart(a.type)}?`, isList: false, hasDefaultList: false });
    }
  });

  // Relaciones
  const rels = relations.filter(r => r.ownerId === c.displayId);
  rels.forEach(r => {
    if (r.type === 'ManyToOne' || r.type === 'OneToOne') {
      metas.push({ name: `${r.fieldName}Id`, type: 'int?', isList: false, hasDefaultList: false });
    } else if (r.type === 'OneToMany' || r.type === 'ManyToMany') {
      metas.push({ name: `${r.fieldName}Ids`, type: 'List<int>', isList: true, hasDefaultList: true });
    }
  });

  // Líneas de campos
  const fieldLines = metas.map(m => {
    if (m.isList && m.hasDefaultList) {
      return `  ${m.type} ${m.name} = const [];`;
    }
    return `  ${m.type} ${m.name};`;
  });

  // Parámetros de constructor
  const ctorParams = metas.map(m => {
    if (m.isList) {
      return `List<int>? ${m.name},`;
    }
    return `this.${m.name},`;
  }).join('\n    ');

  // Cuerpo del constructor (sólo asignaciones para listas)
  const ctorBodyAssigns = metas
    .filter(m => m.isList)
    .map(m => `if (${m.name} != null) this.${m.name} = ${m.name};`)
    .join(' ');

  // fromJson
  const fromJsonLines: string[] = [];
  c.attributes.forEach(a => {
    const f = toFieldName(a.name);
    const dartType = mapUMLTypeToDart(a.type);
    if (f === 'id') {
      fromJsonLines.push(`id: json['id'] is int ? json['id'] : (json['id'] != null ? int.tryParse(json['id'].toString()) : null),`);
    } else if (dartType === 'int') {
      fromJsonLines.push(`${f}: json['${f}'] is int ? json['${f}'] : (json['${f}'] != null ? int.tryParse(json['${f}'].toString()) : null),`);
    } else if (dartType === 'double') {
      fromJsonLines.push(`${f}: json['${f}'] is double ? json['${f}'] : (json['${f}'] != null ? double.tryParse(json['${f}'].toString()) : null),`);
    } else if (dartType === 'bool') {
      fromJsonLines.push(`${f}: json['${f}'] is bool ? json['${f}'] : (json['${f}'] != null ? (json['${f}'].toString() == 'true') : null),`);
    } else {
      fromJsonLines.push(`${f}: json['${f}'],`);
    }
  });
  rels.forEach(r => {
    if (r.type === 'ManyToOne' || r.type === 'OneToOne') {
      fromJsonLines.push(`${r.fieldName}Id: json['${r.fieldName}Id'] is int ? json['${r.fieldName}Id'] : (json['${r.fieldName}Id'] != null ? int.tryParse(json['${r.fieldName}Id'].toString()) : null),`);
    } else if (r.type === 'OneToMany' || r.type === 'ManyToMany') {
      fromJsonLines.push(`${r.fieldName}Ids: (json['${r.fieldName}Ids'] as List?)?.map((e) => (e is int ? e : int.tryParse(e.toString()) ?? 0)).toList() ?? [],`);
    }
  });

  // toJson
  const toJsonLines: string[] = [];
  c.attributes.forEach(a => {
    const f = toFieldName(a.name);
    toJsonLines.push(`'${f}': ${f},`);
  });
  rels.forEach(r => {
    if (r.type === 'ManyToOne' || r.type === 'OneToOne') {
      toJsonLines.push(`'${r.fieldName}Id': ${r.fieldName}Id,`);
    } else if (r.type === 'OneToMany' || r.type === 'ManyToMany') {
      toJsonLines.push(`'${r.fieldName}Ids': ${r.fieldName}Ids,`);
    }
  });

  return `class ${name} {
${fieldLines.join('\n')}
  ${name}({
    ${ctorParams}
  }) { ${ctorBodyAssigns} }

  factory ${name}.fromJson(Map<String, dynamic> json) => ${name}(
    ${fromJsonLines.join('\n    ')}
  );

  Map<String, dynamic> toJson() => {
    ${toJsonLines.join('\n    ')}
  };
}
`;
};

const genListScreen = (c: UMLClassNode) => {
  const name = toClassName(c.name);
  const plural = pluralize(name);
  const snake = sanitizeTableName(c.name);
  const modelImport = `import '../../models/${snake}.dart';`;
  const formImport = `import '${snake}_form.dart';`;
  const firstStringAttr = c.attributes.find(a => mapUMLTypeToDart(a.type) === 'String' && toFieldName(a.name) !== 'id');
  const titleField = firstStringAttr ? toFieldName(firstStringAttr.name) : 'id';
  return `import 'package:flutter/material.dart';
import '../../services/api_service.dart';
${modelImport}
${formImport}

class ${name}ListPage extends StatefulWidget {
  const ${name}ListPage({super.key});

  @override
  State<${name}ListPage> createState() => _${name}ListPageState();
}

class _${name}ListPageState extends State<${name}ListPage> {
  final _api = ApiService();
  List<${name}> items = [];
  bool loading = true;
  String? error;

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final data = await _api.getList('/${plural}');
      items = data.map<${name}>((e) => ${name}.fromJson(e as Map<String, dynamic>)).toList();
    } catch (e) {
      error = e.toString();
    } finally {
      setState(() { loading = false; });
    }
  }

  Future<void> _delete(int id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar'),
        content: Text('¿Eliminar ${name} #\$id?'),
        actions: [
          TextButton(onPressed: ()=>Navigator.pop(ctx,false), child: const Text('Cancelar')),
          FilledButton(onPressed: ()=>Navigator.pop(ctx,true), child: const Text('Eliminar')),
        ],
      )
    );
    if (ok != true) return;
    await _api.delete('/${plural}/\$id');
    await _load();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('${name}s')),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final created = await Navigator.push(context, MaterialPageRoute(builder: (_) => ${name}FormPage()));
          if (created == true) _load();
        },
        child: const Icon(Icons.add),
      ),
      body: loading ? const Center(child: CircularProgressIndicator())
           : error != null ? Center(child: Text(error!))
           : RefreshIndicator(
               onRefresh: _load,
               child: ListView.separated(
                 itemCount: items.length,
                 separatorBuilder: (_, __) => const Divider(height: 1),
                 itemBuilder: (ctx, i) {
                   final it = items[i];
                   final title = it.${titleField}?.toString() ?? '(${name})';
                   return ListTile(
                     title: Text(title),
                     subtitle: Text('ID: \${it.id ?? '-'}'),
                     trailing: Row(
                       mainAxisSize: MainAxisSize.min,
                       children: [
                         IconButton(icon: const Icon(Icons.edit), onPressed: () async {
                           final updated = await Navigator.push(context, MaterialPageRoute(builder: (_) => ${name}FormPage(item: it)));
                           if (updated == true) _load();
                         }),
                         IconButton(
                           icon: const Icon(Icons.delete),
                           onPressed: it.id == null ? null : () => _delete(it.id!)
                         ),
                       ],
                     ),
                   );
                 },
               ),
             ),
    );
  }
}
`;
};

// CORREGIDO: asegura comas entre widgets en children
const genFormScreen = (c: UMLClassNode, relations: ProcessedRelation[]) => {
  const name = toClassName(c.name);
  const snake = sanitizeTableName(c.name);
  const modelImport = `import '../../models/${snake}.dart';`;
  const simpleAttrs = c.attributes.filter(a => toFieldName(a.name) !== 'id');

  const ctrls = simpleAttrs.map(a => {
    const f = toFieldName(a.name);
    return `final _${f}Ctrl = TextEditingController();`;
  }).join('\n  ');

  const rels = relations.filter(r => r.ownerId === c.displayId);

  const relValueDecls = rels.map(r => {
    if (r.type === 'ManyToOne' || r.type === 'OneToOne') {
      return `int? _${r.fieldName}Id;`;
    } else if (r.type === 'OneToMany' || r.type === 'ManyToMany') {
      return `final List<int> _${r.fieldName}Ids = [];`;
    }
    return '';
  }).filter(Boolean).join('\n  ');

  const loadExisting: string[] = [
    `if (widget.item != null) {`,
    `  final it = widget.item!;`,
    `  _id = it.id;`,
  ];
  simpleAttrs.forEach(a => {
    const f = toFieldName(a.name);
    loadExisting.push(`  _${f}Ctrl.text = it.${f}?.toString() ?? '';`);
  });
  rels.forEach(r => {
    if (r.type === 'ManyToOne' || r.type === 'OneToOne') {
      loadExisting.push(`  _${r.fieldName}Id = it.${r.fieldName}Id;`);
    } else if (r.type === 'OneToMany' || r.type === 'ManyToMany') {
      loadExisting.push(`  _${r.fieldName}Ids.clear(); _${r.fieldName}Ids.addAll(it.${r.fieldName}Ids);`);
    }
  });
  loadExisting.push('}');

  const buildFields = simpleAttrs.map(a => {
    const f = toFieldName(a.name);
    const dartType = mapUMLTypeToDart(a.type);
    const keyboard = dartType === 'int' || dartType === 'double' ? 'TextInputType.number' : 'TextInputType.text';
    return `TextField(
          controller: _${f}Ctrl,
          keyboardType: ${keyboard},
          decoration: const InputDecoration(labelText: '${f}'),
        )`;
  }).join(',\n          ');

  const relFields = rels.map(r => {
    if (r.type === 'ManyToOne' || r.type === 'OneToOne') {
      return `Row(
              children: [
                Expanded(child: Text('ID ${r.relatedClassName}: \${_${r.fieldName}Id ?? '-'}')),
                IconButton(
                  icon: const Icon(Icons.edit),
                  onPressed: () async {
                    final val = await _askNumber(context, 'ID de ${r.relatedClassName}');
                    if (val != null) setState((){ _${r.fieldName}Id = val; });
                  },
                )
              ],
            )`;
    } else if (r.type === 'OneToMany' || r.type === 'ManyToMany') {
      return `Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${r.relatedClassName} IDs: \${_${r.fieldName}Ids.join(', ')}'),
                Wrap(
                  children: [
                    FilledButton.tonal(
                      onPressed: () async {
                        final val = await _askNumber(context, 'Agregar ID de ${r.relatedClassName}');
                        if (val != null && !_${r.fieldName}Ids.contains(val)) setState((){ _${r.fieldName}Ids.add(val); });
                      }, child: const Text('Agregar ID')),
                    const SizedBox(width: 8),
                    FilledButton.tonal(
                      onPressed: () async {
                        if (_${r.fieldName}Ids.isEmpty) return;
                        setState((){ _${r.fieldName}Ids.removeLast(); });
                      }, child: const Text('Quitar último')),
                  ],
                )
              ],
            )`;
    }
    return '';
  }).filter(Boolean).join(',\n          ');

  const toJsonLines: string[] = [];
  simpleAttrs.forEach(a => {
    const f = toFieldName(a.name);
    const dartType = mapUMLTypeToDart(a.type);
    if (dartType === 'int') {
      toJsonLines.push(`'${f}': int.tryParse(_${f}Ctrl.text),`);
    } else if (dartType === 'double') {
      toJsonLines.push(`'${f}': double.tryParse(_${f}Ctrl.text),`);
    } else if (dartType === 'bool') {
      toJsonLines.push(`'${f}': (_${f}Ctrl.text.toLowerCase() == 'true'),`);
    } else {
      toJsonLines.push(`'${f}': _${f}Ctrl.text.isEmpty ? null : _${f}Ctrl.text,`);
    }
  });
  rels.forEach(r => {
    if (r.type === 'ManyToOne' || r.type === 'OneToOne') {
      toJsonLines.push(`'${r.fieldName}Id': _${r.fieldName}Id,`);
    } else if (r.type === 'OneToMany' || r.type === 'ManyToMany') {
      toJsonLines.push(`'${r.fieldName}Ids': _${r.fieldName}Ids,`);
    }
  });

  // Construye children con comas garantizadas entre bloques
  const childrenBlocks: string[] = [];
  if (buildFields) childrenBlocks.push(buildFields);
  if (relFields) childrenBlocks.push(relFields);
  childrenBlocks.push(`const SizedBox(height: 12)`);
  childrenBlocks.push(`FilledButton(onPressed: _save, child: Text(isEdit ? 'Guardar' : 'Crear'))`);

  return `import 'package:flutter/material.dart';
import '../../services/api_service.dart';
${modelImport}

class ${name}FormPage extends StatefulWidget {
  final ${name}? item;
  const ${name}FormPage({super.key, this.item});

  @override
  State<${name}FormPage> createState() => _${name}FormPageState();
}

class _${name}FormPageState extends State<${name}FormPage> {
  final _api = ApiService();
  int? _id;
  ${ctrls ? '  ' + ctrls : ''}
  ${relValueDecls ? '  ' + relValueDecls : ''}

  @override
  void initState() {
    super.initState();
    ${loadExisting.join('\n    ')}
  }

  Future<int?> _askNumber(BuildContext context, String title) async {
    final ctrl = TextEditingController();
    final val = await showDialog<int?>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, keyboardType: TextInputType.number),
        actions: [
          TextButton(onPressed: ()=>Navigator.pop(ctx,null), child: const Text('Cancelar')),
          FilledButton(onPressed: (){
            final n = int.tryParse(ctrl.text);
            Navigator.pop(ctx, n);
          }, child: const Text('Aceptar')),
        ],
      )
    );
    return val;
  }

  Future<void> _save() async {
    final data = {
      ${toJsonLines.join('\n      ')}
    };
    try {
      if (_id == null) {
        await _api.post('/${pluralize(name)}', data);
      } else {
        await _api.put('/${pluralize(name)}/\$_id', data);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: \${e.toString()}')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = _id != null;
    return Scaffold(
      appBar: AppBar(title: Text(isEdit ? 'Editar ${name}' : 'Crear ${name}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ${childrenBlocks.join(',\n          ')}
        ],
      ),
    );
  }
}
`;
};

const genReadme = (cfg: FlutterConfig, classes: UMLClassNode[]) => {
  const entries = classes.map(c => `- ${toClassName(c.name)}: /${pluralize(c.name)}`).join('\n');
  return `# ${cfg.appName}

App Flutter generada automáticamente con CRUD por entidad.

## Requisitos
- Flutter SDK
- Backend disponible en: ${cfg.apiBaseUrl}

## Pasos
1) Descomprime el zip
2) (Opcional) Ejecuta "flutter create ." para generar carpetas de plataformas (android/ios/web)
3) Ejecuta:
   flutter pub get
   flutter run

## Módulos
${entries}
`;
};

const genGitignore = () => `.dart_tool
.packages
build/
.flutter-plugins
.flutter-plugins-dependencies
.melos_tool
.idea
.vscode
**/Generated.xcconfig
**/Pods/
pubspec.lock
`;

// Componente principal
const GenerationFrontendFlutter: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [diagramModel, setDiagramModel] = useState<DiagramModel>({ version: 1, nextDisplayId: 1, classes: [], relations: [] });
  const [cfg, setCfg] = useState<FlutterConfig>(DEFAULT_FLUTTER_CONFIG);
  const [warnings, setWarnings] = useState<string[]>([]);

  const validateDiagram = (model: DiagramModel) => {
    const warn: string[] = [];
    model.classes.forEach(cls => {
      const seen = new Set<string>();
      cls.attributes.forEach(attr => {
        const fieldName = toFieldName(attr.name);
        if (seen.has(fieldName)) warn.push(`Clase '${cls.name}': atributo duplicado tras normalizar -> ${attr.name} -> ${fieldName}`);
        else seen.add(fieldName);
        if (!attr.name || fieldName.length === 0) warn.push(`Clase '${cls.name}': atributo con nombre inválido.`);
      });
    });
    setWarnings(warn);
  };

  const loadProjectData = useCallback(async () => {
    if (!projectId) {
      setError('ID de proyecto no válido');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const projectData = await projectApi.getProjectById(Number(projectId));
      if (projectData && projectData.diagrama_json) {
        const diagramData = typeof projectData.diagrama_json === 'string' ? JSON.parse(projectData.diagrama_json) : projectData.diagrama_json;
        setDiagramModel(diagramData);
        validateDiagram(diagramData);
        if (projectData.name) {
          const clean = projectData.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          setCfg(prev => ({ ...prev, appName: `${projectData.name} Mobile`, appId: `com.example.${clean}` }));
        }
      } else {
        setError('No se encontraron datos de diagrama en el proyecto');
      }
    } catch (e) {
      console.error(e);
      setError('Error al cargar los datos del proyecto');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadProjectData(); }, [loadProjectData]);

  // --- NUEVO: Aplicar normalización y forzar 'id' tras cargar el diagrama ---
  useEffect(() => {
    setDiagramModel(prev => normalizeAndForceId(prev));
  }, [loading]);

  const generateFlutterZip = async () => {
    if (isGenerating) return;
    if (diagramModel.classes.length === 0) { alert('No hay clases para generar.'); return; }
    if (warnings.length > 0) {
      const proceed = window.confirm('Existen advertencias en el diagrama:\n' + warnings.join('\n') + '\n\n¿Deseas continuar de todas formas?');
      if (!proceed) return;
    }
    setIsGenerating(true);
    try {
      const zip = new JSZip();
      const appFolder = `${'' + (cfg.appId.split('.').pop() || 'app')}`;
      // raíz
      zip.file(`${appFolder}/pubspec.yaml`, genPubspec(appFolder));
      zip.file(`${appFolder}/.gitignore`, genGitignore());
      zip.file(`${appFolder}/README.md`, genReadme(cfg, diagramModel.classes));
      // lib/
      const base = `${appFolder}/lib/`;
      zip.file(`${base}config.dart`, genConfigDart(cfg));
      zip.file(`${base}services/api_service.dart`, genApiServiceDart());
      zip.file(`${base}main.dart`, genMainDart(cfg, diagramModel.classes));
      // models + screens
      const processed = processRelations(diagramModel.relations, diagramModel.classes);
      diagramModel.classes.forEach(c => {
        const name = sanitizeTableName(c.name);
        zip.file(`${base}models/${name}.dart`, genModelDart(c, processed));
        zip.file(`${base}screens/${name}/${name}_list.dart`, genListScreen(c));
        zip.file(`${base}screens/${name}/${name}_form.dart`, genFormScreen(c, processed));
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${appFolder}-flutter.zip`);
    } catch (e) {
      console.error('Error generando Flutter:', e);
      alert('Error generando Flutter: ' + e);
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="generation-container">
        <div className="loading-container">
          <h2>Cargando datos del proyecto...</h2>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="generation-container">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">← Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="generation-container">
      <div className="generation-header">
        <h1>Generador de App Flutter</h1>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">← Volver</button>
      </div>

      {warnings.length > 0 && (
        <div className="warnings-box">
          <h3>Advertencias del diagrama:</h3>
          <ul>
            {warnings.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
        </div>
      )}

      <div className="generation-content">
        <div className="config-section">
          <h2>Configuración de la App</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>App Name</label>
              <input type="text" value={cfg.appName} onChange={e => setCfg(prev => ({ ...prev, appName: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label>Application ID (package)</label>
              <input type="text" value={cfg.appId} onChange={e => setCfg(prev => ({ ...prev, appId: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label>API Base URL</label>
              <input type="text" value={cfg.apiBaseUrl} onChange={e => setCfg(prev => ({ ...prev, apiBaseUrl: e.target.value }))}/>
              <small>http://10.0.2.2:8080/api</small>
            </div>
          </div>
        </div>

        <div className="diagram-preview">
          <h2>Clases ({diagramModel.classes.length})</h2>
          <div className="classes-list">
            {diagramModel.classes.map(c => (
              <div key={c.id} className="class-preview">
                <h3>{c.name}</h3>
                <div className="attributes">
                  <h4>Atributos ({c.attributes.length})</h4>
                  <ul>
                    {c.attributes.map((a, i) => (
                      <li key={i}>{toFieldName(a.name)}: {mapUMLTypeToDart(a.type)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="generation-actions">
        <button onClick={generateFlutterZip} disabled={isGenerating || diagramModel.classes.length === 0} className="btn btn-primary btn-large">
          {isGenerating ? 'Generando...' : 'Generar App Flutter'}
        </button>
        <div className="generation-info">
          <p>Se generará un proyecto Flutter con:</p>
          <ul>
            <li>Pantallas: Lista + Formulario por entidad (CRUD)</li>
            <li>Modelos Dart con fromJson/toJson</li>
            <li>Servicio HTTP común</li>
            <li>Home con accesos a cada módulo</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GenerationFrontendFlutter;