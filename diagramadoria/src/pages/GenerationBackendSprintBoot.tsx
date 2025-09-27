import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { projectApi } from '../api/projectApi';
import '../styles/GenerationBackendSprintBoot.css';

/* ==============================
 *      Tipos de Modelo UML
 * ============================== */
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

/* ==============================
 *  Configuración del Proyecto
 * ============================== */
type ProjectConfig = {
  groupId: string;
  artifactId: string;
  packageName: string;
  version: string;
  javaVersion: string;
  springBootVersion: string;
  description: string;
  dbHost: string;
  dbPort: string;
  dbName: string;
  dbUsername: string;
  dbPassword: string;
};

const DEFAULT_CONFIG: ProjectConfig = {
  groupId: 'com.example',
  artifactId: 'uml-project',
  packageName: 'com.example.umlproject',
  version: '1.0.0',
  javaVersion: '17',
  springBootVersion: '3.2.0',
  description: 'UML Generated Spring Boot Project',
  dbHost: 'localhost',
  dbPort: '5432',
  dbName: 'uml_database',
  dbUsername: 'postgres',
  dbPassword: 'password'
};

const RESERVED_TABLE_NAMES: Record<string, string> = {
  order: 'orders',
  user: 'users'
};

/* ==============================
 * Utilidades de nombres y tipos
 * ============================== */

// Sanitiza identificadores de clase
const sanitizeIdentifier = (raw: string): string =>
  (raw || 'Unnamed').replace(/[^A-Za-z0-9_]/g, '').replace(/^[0-9]+/, '') || 'Unnamed';

// Nombre de tabla (lowercase + reserva)
const sanitizeTableName = (raw: string): string => {
  const lower = raw.toLowerCase();
  if (RESERVED_TABLE_NAMES[lower]) return RESERVED_TABLE_NAMES[lower];
  return lower;
};

// Nombre de campo consistente (para entity, dto, repos)
const toFieldName = (raw: string): string => {
  if (!raw) return 'field';
  let s = raw.trim();
  s = s.replace(/\s+/g, '_');          // espacios a _
  s = s.replace(/[^A-Za-z0-9_]/g, ''); // quita símbolos
  if (s.length === 0) s = 'field';
  if (/^[0-9]/.test(s)) s = 'f_' + s;
  // primera minúscula
  s = s.charAt(0).toLowerCase() + s.slice(1);
  return s;
};

// Sufijo capitalizado para métodos (FindByXxx)
const toPropertyCap = (fieldName: string): string =>
  fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

// Mapear UML → Java
const mapUMLTypeToJava = (umlType: string): string => {
  const type = (umlType || '').trim().toLowerCase();
  switch (type) {
    case 'int':
    case 'integer':
      return 'Integer';
    case 'long':
      return 'Long';
    case 'float':
      return 'Float';
    case 'double':
      return 'Double';
    case 'bool':
    case 'boolean':
      return 'Boolean';
    case 'string':
    case 'text':
      return 'String';
    case 'date':
      return 'LocalDate';
    case 'datetime':
    case 'timestamp':
      return 'LocalDateTime';
    case 'decimal':
    case 'bigdecimal':
      return 'BigDecimal';
    case 'email':
      return 'String';
    case 'phone':
      return 'String';
    case 'url':
      return 'String';
    default:
      return 'String';
  }
};

const getExampleValue = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'string':
      return 'Sample text';
    case 'integer':
    case 'int':
    case 'long':
      return '1';
    case 'double':
    case 'float':
      return '10.50';
    case 'boolean':
      return 'true';
    case 'date':
      return '2025-01-01';
    case 'datetime':
      return '2025-01-01T10:00:00';
    case 'email':
      return 'user@example.com';
    case 'phone':
      return '+1234567890';
    default:
      return 'Sample value';
  }
};

/* ==============================
 * Anotaciones JPA + Validación
 * ============================== */
const getJPAAnnotations = (umlType: string, originalFieldName: string): string[] => {
  const annotations: string[] = [];
  const lowerType = (umlType || '').toLowerCase();
  const lowerField = originalFieldName.toLowerCase();

  const add = (a: string) => annotations.push(a);

  if (lowerField.includes('name') || lowerField.includes('title')) {
    add(`@Column(name = "${lowerField}", nullable = false, length = 100)`);
    add(`@NotBlank(message = "${originalFieldName} is required")`);
    add(`@Size(min = 2, max = 100, message = "${originalFieldName} must be between 2 and 100 characters")`);
  } else if (lowerField.includes('description') || lowerType.includes('text')) {
    add(`@Column(name = "${lowerField}", columnDefinition = "TEXT")`);
    add(`@Size(max = 1000, message = "Description must not exceed 1000 characters")`);
  } else if (lowerField.includes('email')) {
    add(`@Column(name = "${lowerField}", unique = true, nullable = false)`);
    add(`@NotBlank(message = "Email is required")`);
    add(`@Email(message = "Email should be valid")`);
  } else if (lowerField.includes('phone')) {
    add(`@Column(name = "${lowerField}")`);
    add(`@Pattern(regexp = "^[\\+]?[1-9]?\\d{9,15}$", message = "Phone number is invalid")`);
  } else if (lowerType.includes('string')) {
    add(`@Column(name = "${lowerField}")`);
    add(`@Size(max = 255, message = "Field must not exceed 255 characters")`);
  } else if (['int', 'integer', 'long'].some(k => lowerType.includes(k))) {
    add(`@Column(name = "${lowerField}")`);
    add(`@Min(value = 0, message = "Value must be positive")`);
  } else if (['decimal', 'double', 'float', 'bigdecimal'].some(k => lowerType.includes(k))) {
    add(`@Column(name = "${lowerField}", precision = 10, scale = 2)`);
    add(`@DecimalMin(value = "0.0", message = "Value must be positive")`);
  } else {
    add(`@Column(name = "${lowerField}")`);
  }

  add(`@Schema(description = "${originalFieldName}", example = "${getExampleValue(lowerType)}")`);
  return annotations;
};

/* ==============================
 * Component
 * ============================== */
const GenerationBackendSpringBoot: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [isGenerating, setIsGenerating] = useState(false);
  const [config, setConfig] = useState<ProjectConfig>(DEFAULT_CONFIG);
  const [diagramModel, setDiagramModel] = useState<DiagramModel>({
    version: 1,
    nextDisplayId: 1,
    classes: [],
    relations: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateSearchMethods, setGenerateSearchMethods] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);

  /* ==============================
   * Validación previa
   * ============================== */
  const validateDiagram = (model: DiagramModel) => {
    const warn: string[] = [];
    model.classes.forEach(cls => {
      const seen = new Set<string>();
      cls.attributes.forEach(attr => {
        const fieldName = toFieldName(attr.name);
        if (seen.has(fieldName)) {
          warn.push(`Clase '${cls.name}': atributo duplicado tras normalizar -> ${attr.name} -> ${fieldName}`);
        } else {
          seen.add(fieldName);
        }
        if (!attr.name || fieldName.length === 0) {
          warn.push(`Clase '${cls.name}': atributo con nombre inválido.`);
        }
      });
    });
    setWarnings(warn);
  };

  /* ==============================
   * DTO
   * ============================== */
  const buildDtoExample = (classNode: UMLClassNode): string => {
    const lines: string[] = [];
    classNode.attributes
      .filter(a => toFieldName(a.name) !== 'id')
      .forEach(attr => {
        const javaType = mapUMLTypeToJava(attr.type);
        let v: string = '"sample"';
        if (['Integer', 'Long'].includes(javaType)) v = '1';
        else if (javaType === 'Boolean') v = 'true';
        else if (javaType === 'BigDecimal') v = '10.50';
        else if (javaType === 'LocalDate') v = '2025-01-01';
        else if (javaType === 'LocalDateTime') v = '2025-01-01T10:00:00';
        lines.push(`  "${toFieldName(attr.name)}": ${v}`);
      });
    return `{
${lines.join(',\n')}
}`;
  };

  const generateDto = (c: UMLClassNode): string => {
    const className = sanitizeIdentifier(c.name);
    let code = `package ${config.packageName}.dto;

import lombok.Data;

@Data
public class ${className}Dto {
    private Long id;
`;
    c.attributes
      .filter(a => toFieldName(a.name) !== 'id')
      .forEach(attr => {
        const javaType = mapUMLTypeToJava(attr.type);
        const fieldName = toFieldName(attr.name);
        code += `    private ${javaType} ${fieldName};\n`;
      });
    code += `}
`;
    return code;
  };

  /* ==============================
   * Entity
   * ============================== */
  const generateEntity = (c: UMLClassNode): string => {
    const className = sanitizeIdentifier(c.name);
    const tableName = sanitizeTableName(className);

    const attrJavaTypes = c.attributes.map(a => mapUMLTypeToJava(a.type));
    const needsLocalDate = attrJavaTypes.includes('LocalDate');
    const needsLocalDateTime = attrJavaTypes.includes('LocalDateTime');
    const needsBigDecimal = attrJavaTypes.includes('BigDecimal');

    const allAnnotations = c.attributes
      .filter(a => toFieldName(a.name) !== 'id')
      .map(a => getJPAAnnotations(a.type, a.name))
      .flat();

    const usesValidation = allAnnotations.some(a =>
      /@NotBlank|@Size|@Email|@Pattern|@Min|@DecimalMin/.test(a)
    );
    const usesSchema = allAnnotations.some(a => /@Schema/.test(a));

    const imports: string[] = [
      'import jakarta.persistence.*;',
      'import lombok.Data;',
      'import lombok.NoArgsConstructor;',
      'import lombok.AllArgsConstructor;'
    ];
    if (needsLocalDate || needsLocalDateTime) imports.push('import java.time.*;');
    if (needsBigDecimal) imports.push('import java.math.BigDecimal;');
    if (usesValidation) imports.push('import jakarta.validation.constraints.*;');
    if (usesSchema) imports.push('import io.swagger.v3.oas.annotations.media.Schema;');

    let code = `package ${config.packageName}.entity;

${imports.join('\n')}

@Data
@Entity
@Table(name = "${tableName}")
@NoArgsConstructor
@AllArgsConstructor
public class ${className} {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
`;

    c.attributes
      .filter(a => toFieldName(a.name) !== 'id')
      .forEach(attr => {
        const javaType = mapUMLTypeToJava(attr.type);
        const anns = getJPAAnnotations(attr.type, attr.name);
        const fieldName = toFieldName(attr.name);
        anns.forEach(a => (code += `    ${a}\n`));
        code += `    private ${javaType} ${fieldName};\n\n`;
      });

    code += `}
`;
    return code;
  };

  /* ==============================
   * Repository
   * ============================== */
  const generateRepository = (c: UMLClassNode): string => {
    const className = sanitizeIdentifier(c.name);

    const searchable = generateSearchMethods
      ? c.attributes.filter(a => {
          const javaType = mapUMLTypeToJava(a.type);
          const fieldName = toFieldName(a.name);
            if (fieldName === 'id') return false;
          if (javaType !== 'String') return false;
          if (fieldName.endsWith('Id')) return false;
          if (fieldName.length < 3) return false;
          return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName);
        })
      : [];

    const methods = searchable
      .map(attr => {
        const fieldName = toFieldName(attr.name);
        const cap = toPropertyCap(fieldName);
        return `    // Búsqueda generada para campo '${fieldName}'\n    java.util.List<${className}> findBy${cap}ContainingIgnoreCase(String ${fieldName});`;
      })
      .join('\n\n');

    return `package ${config.packageName}.repository;

import ${config.packageName}.entity.${className};
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface ${className}Repository extends JpaRepository<${className}, Long> {

    @Query("select e from ${className} e where e.id = :id")
    Optional<${className}> findByIdWithDetails(@Param("id") Long id);
${methods ? '\n\n' + methods + '\n' : '\n'}
}
`;
  };

  /* ==============================
   * Service Interface
   * ============================== */
  const generateServiceInterface = (c: UMLClassNode): string => {
    const name = sanitizeIdentifier(c.name);

    const searchable = generateSearchMethods
      ? c.attributes.filter(a => {
          const javaType = mapUMLTypeToJava(a.type);
          const fieldName = toFieldName(a.name);
          if (javaType !== 'String') return false;
          if (fieldName === 'id' || fieldName.endsWith('Id') || fieldName.length < 3) return false;
          return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName);
        })
      : [];
    const searchLines = searchable
      .map(a => {
        const fieldName = toFieldName(a.name);
        const cap = toPropertyCap(fieldName);
        return `    java.util.List<${name}Dto> searchBy${cap}(String ${fieldName});`;
      })
      .join('\n');

    return `package ${config.packageName}.service;

import ${config.packageName}.dto.${name}Dto;
import java.util.*;

public interface ${name}Service {
    ${name}Dto create(${name}Dto dto);
    ${name}Dto update(Long id, ${name}Dto dto);
    void delete(Long id);
    ${name}Dto findById(Long id);
    java.util.List<${name}Dto> findAll();
${searchLines ? searchLines + '\n' : ''}}
`;
  };

  /* ==============================
   * Service Impl
   * ============================== */
  const generateServiceImpl = (c: UMLClassNode): string => {
    const name = sanitizeIdentifier(c.name);
    const varName = name.charAt(0).toLowerCase() + name.slice(1);

    const searchable = generateSearchMethods
      ? c.attributes.filter(a => {
          const javaType = mapUMLTypeToJava(a.type);
          const fieldName = toFieldName(a.name);
          if (javaType !== 'String') return false;
          if (fieldName === 'id' || fieldName.endsWith('Id') || fieldName.length < 3) return false;
          return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName);
        })
      : [];

    const dtoSetters = c.attributes
      .filter(a => toFieldName(a.name) !== 'id')
      .map(a => {
        const fieldName = toFieldName(a.name);
        const cap = toPropertyCap(fieldName);
        return `        dto.set${cap}(e.get${cap}());`;
      })
      .join('\n');

    const entitySetters = c.attributes
      .filter(a => toFieldName(a.name) !== 'id')
      .map(a => {
        const fieldName = toFieldName(a.name);
        const cap = toPropertyCap(fieldName);
        return `        e.set${cap}(dto.get${cap}());`;
      })
      .join('\n');

    const searchImpl = searchable
      .map(a => {
        const fieldName = toFieldName(a.name);
        const cap = toPropertyCap(fieldName);
        return `    @Override public java.util.List<${name}Dto> searchBy${cap}(String ${fieldName}) {\n        return ${varName}Repository.findBy${cap}ContainingIgnoreCase(${fieldName}).stream().map(this::toDto).toList();\n    }`;
      })
      .join('\n\n');

    return `package ${config.packageName}.service.impl;

import ${config.packageName}.service.${name}Service;
import ${config.packageName}.repository.${name}Repository;
import ${config.packageName}.entity.${name};
import ${config.packageName}.dto.${name}Dto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import java.util.*;

@Service
@Transactional
@RequiredArgsConstructor
public class ${name}ServiceImpl implements ${name}Service {

    private final ${name}Repository ${varName}Repository;

    private ${name}Dto toDto(${name} e) {
        if (e == null) return null;
        ${name}Dto dto = new ${name}Dto();
        dto.setId(e.getId());
${dtoSetters}
        return dto;
    }

    private ${name} toEntity(${name}Dto dto) {
        ${name} e = new ${name}();
        e.setId(dto.getId());
${entitySetters}
        return e;
    }

    @Override public ${name}Dto create(${name}Dto dto) {
        dto.setId(null);
        var saved = ${varName}Repository.save(toEntity(dto));
        return toDto(saved);
    }
    @Override public ${name}Dto update(Long id, ${name}Dto dto) {
        ${name} existing = ${varName}Repository.findById(id).orElseThrow(() -> new RuntimeException("${name} not found"));
        dto.setId(existing.getId());
        return toDto(${varName}Repository.save(toEntity(dto)));
    }
    @Override public void delete(Long id) {
        if (!${varName}Repository.existsById(id)) throw new RuntimeException("${name} not found");
        ${varName}Repository.deleteById(id);
    }
    @Override public ${name}Dto findById(Long id) {
        return toDto(${varName}Repository.findByIdWithDetails(id).orElseThrow(() -> new RuntimeException("${name} not found")));
    }
    @Override public java.util.List<${name}Dto> findAll() {
        return ${varName}Repository.findAll().stream().map(this::toDto).toList();
    }
${searchImpl ? '\n' + searchImpl + '\n' : ''}
}
`;
  };

  /* ==============================
   * Controller
   * ============================== */
  const generateController = (c: UMLClassNode): string => {
    const name = sanitizeIdentifier(c.name);
    const plural = sanitizeTableName(name) + 's';
    const varService = name.charAt(0).toLowerCase() + name.slice(1) + 'Service';
    const exampleBlock = buildDtoExample(c);

    const searchable = generateSearchMethods
      ? c.attributes.filter(a => {
          const javaType = mapUMLTypeToJava(a.type);
          const fieldName = toFieldName(a.name);
          if (javaType !== 'String') return false;
          if (fieldName === 'id' || fieldName.endsWith('Id') || fieldName.length < 3) return false;
          return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName);
        })
      : [];

    const searchMethods = searchable
      .map(a => {
        const fieldName = toFieldName(a.name);
        const cap = toPropertyCap(fieldName);
        return `    @GetMapping(value = "/search", params = "${fieldName}")
    @Operation(summary = "Buscar ${name} por ${fieldName}")
    public java.util.List<${name}Dto> searchBy${cap}(@RequestParam String ${fieldName}) {
        return ${varService}.searchBy${cap}(${fieldName});
    }\n`;
      })
      .join('\n');

    return `package ${config.packageName}.controller;

import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import ${config.packageName}.service.${name}Service;
import ${config.packageName}.dto.${name}Dto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.*;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.*;

@RestController
@RequestMapping("/${plural}")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET,RequestMethod.POST,RequestMethod.PUT,RequestMethod.DELETE,RequestMethod.OPTIONS})
@RequiredArgsConstructor
@Tag(name = "${name}")
public class ${name}Controller {

    private final ${name}Service ${varService};

    @GetMapping
    @Operation(summary = "Listar ${name}s")
    public List<${name}Dto> all(){ return ${varService}.findAll(); }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener ${name} por id")
    public ${name}Dto byId(@PathVariable Long id){ return ${varService}.findById(id); }

    @PostMapping
    @Operation(summary = "Crear ${name}", requestBody = @RequestBody(required = true, content = @Content(mediaType = "application/json", examples = @ExampleObject(name = "${name}Create", value = """
${exampleBlock}
"""))))
    public ${name}Dto create(@org.springframework.web.bind.annotation.RequestBody ${name}Dto dto){ return ${varService}.create(dto);}

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar ${name}")
    public ${name}Dto update(@PathVariable Long id, @org.springframework.web.bind.annotation.RequestBody ${name}Dto dto){ return ${varService}.update(id,dto);}

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar ${name}")
    public void delete(@PathVariable Long id){ ${varService}.delete(id);}

${searchMethods}}
`;
  };

  /* ==============================
   * Config / infra (sin cambios fuertes)
   * ============================== */
  const generateCorsConfig = (): string => `package ${config.packageName}.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**").allowedOrigins("*").allowedMethods("*").allowedHeaders("*");
    }
}
`;

  const generateOpenApiConfig = (): string => `package ${config.packageName}.config;

import io.swagger.v3.oas.models.*;
import io.swagger.v3.oas.models.info.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI api(){
        return new OpenAPI().info(new Info().title("${config.artifactId} API")
                .description("Proyecto generado automáticamente")
                .version("${config.version}")
                .contact(new Contact().name("Generator").email("dev@example.com")));
    }
}
`;

  const generateDockerfile = (): string => `# Multi-stage build
FROM maven:3.9.6-eclipse-temurin-${config.javaVersion} AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:${config.javaVersion}-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
`;

  const generateDockerCompose = (): string => `version: '3.9'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: ${config.dbName}
      POSTGRES_USER: ${config.dbUsername}
      POSTGRES_PASSWORD: ${config.dbPassword}
    ports:
      - "5432:5432"
    volumes:
      - dbdata:/var/lib/postgresql/data
  app:
    build: .
    depends_on:
      - db
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/${config.dbName}
      SPRING_DATASOURCE_USERNAME: ${config.dbUsername}
      SPRING_DATASOURCE_PASSWORD: ${config.dbPassword}
    ports:
      - "8080:8080"
volumes:
  dbdata: {}
`;

  const generateGitignore = (): string =>
    `target
.idea
*.iml
*.log
*.DS_Store
.env
`;

  const generateReadme = (): string => {
    const sectionPerEntity = diagramModel.classes
      .map(
        c =>
          `### ${c.name}\nEndpoint base: /api/${sanitizeTableName(c.name)}s`
      )
      .join('\n\n');
    return `# ${config.artifactId} (Backend generado)

## Tecnologías
- Spring Boot ${config.springBootVersion}
- Java ${config.javaVersion}
- PostgreSQL
- Spring Data JPA / Validation / Lombok
- springdoc-openapi (Swagger UI)

## Ejecución rápida
mvn spring-boot:run

Swagger UI: http://localhost:8080/api/swagger-ui/index.html

## Docker
docker compose up --build

## Estructura
- entity: Entidades JPA
- dto: Transfer Objects
- repository: Acceso a datos
- service / service.impl: Lógica + mapeo DTO
- controller: Endpoints REST
- config: CORS + OpenAPI
- exception: Manejadores globales

## Entidades
${sectionPerEntity}
`;
  };

  const generatePomXml = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>${config.groupId}</groupId>
    <artifactId>${config.artifactId}</artifactId>
    <version>${config.version}</version>
    <name>${config.artifactId}</name>
    <description>${config.description}</description>
    <properties>
        <java.version>${config.javaVersion}</java.version>
        <spring.boot.version>${config.springBootVersion}</spring.boot.version>
    </properties>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>${config.springBootVersion}</version>
        <relativePath/>
    </parent>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.6.0</version>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.datatype</groupId>
            <artifactId>jackson-datatype-jsr310</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
    <build>
        <plugins>
            <plugin>
              <groupId>org.apache.maven.plugins</groupId>
              <artifactId>maven-compiler-plugin</artifactId>
              <configuration>
                <release>${config.javaVersion}</release>
              </configuration>
            </plugin>
            <plugin>
              <groupId>org.springframework.boot</groupId>
              <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>`;

  const generateApplicationProperties = (): string => `server.port=8080
server.servlet.context-path=/api
spring.datasource.url=jdbc:postgresql://${config.dbHost}:${config.dbPort}/${config.dbName}
spring.datasource.username=${config.dbUsername}
spring.datasource.password=${config.dbPassword}
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
springdoc.api-docs.path=/v3/api-docs
springdoc.swagger-ui.path=/swagger-ui.html
`;

  const generateMainApplication = (): string => `package ${config.packageName};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args){
        SpringApplication.run(Application.class, args);
    }
}
`;

  const generateGlobalExceptionHandler = (): string => `package ${config.packageName}.exception;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import java.util.*;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String,Object>> handleValidation(MethodArgumentNotValidException ex){
        Map<String,Object> body = new HashMap<>();
        body.put("error","Validation error");
        Map<String,String> fields = new HashMap<>();
        for(FieldError fe: ex.getBindingResult().getFieldErrors()){
            fields.put(fe.getField(), fe.getDefaultMessage());
        }
        body.put("fields", fields);
        return ResponseEntity.badRequest().body(body);
    }
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String,Object>> handleRuntime(RuntimeException ex){
        Map<String,Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
`;

  /* ==============================
   * Carga
   * ============================== */
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
        const diagramData =
          typeof projectData.diagrama_json === 'string'
            ? JSON.parse(projectData.diagrama_json)
            : projectData.diagrama_json;

        setDiagramModel(diagramData);
        validateDiagram(diagramData);

        if (projectData.name) {
          const cleanName = projectData.name.toLowerCase().replace(/\s+/g, '-');
          setConfig(prev => ({
            ...prev,
            artifactId: cleanName,
            packageName: `com.example.${cleanName.replace(/-/g, '')}`,
            description: `${projectData.name} - Generated Spring Boot Project`
          }));
        }
      } else {
        setError('No se encontraron datos de diagrama en el proyecto');
      }
    } catch (err) {
      console.error('Error loading project data:', err);
      setError('Error al cargar los datos del proyecto');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const loadDiagramFromStorage = () => {
    try {
      const storedDiagram = projectId
        ? localStorage.getItem(`diagram-${projectId}`)
        : null;
      if (storedDiagram) {
        const parsed = JSON.parse(storedDiagram);
        setDiagramModel(parsed);
        validateDiagram(parsed);
      } else {
        const demo: DiagramModel = {
          version: 1,
          nextDisplayId: 3,
          classes: [
            {
              id: 'c-1',
              displayId: 1,
              name: 'Usuario',
              position: { x: 100, y: 100 },
              attributes: [
                { name: 'id', type: 'Long' },
                { name: 'nombre', type: 'String' },
                { name: 'email', type: 'String' },
                { name: 'fechaCreacion', type: 'DateTime' }
              ],
              methods: [{ name: 'validarEmail', returns: 'Boolean' }]
            },
            {
              id: 'c-2',
              displayId: 2,
              name: 'Pedido',
              position: { x: 300, y: 100 },
              attributes: [
                { name: 'id', type: 'Long' },
                { name: 'fecha', type: 'Date' },
                { name: 'total', type: 'BigDecimal' },
                { name: 'estado', type: 'String' }
              ],
              methods: [{ name: 'calcularTotal', returns: 'BigDecimal' }]
            }
          ],
          relations: [
            {
              id: 'r-1',
              fromDisplayId: 1,
              toDisplayId: 2,
              type: 'asociacion',
              originCard: '1',
              destCard: '*',
              verb: 'realiza'
            }
          ]
        };
        setDiagramModel(demo);
        validateDiagram(demo);
      }
    } catch (e) {
      console.error('Error cargando diagrama local:', e);
    }
  };

  /* ==============================
   * Generar ZIP
   * ============================== */
  const generateSpringBootProject = async () => {
    if (isGenerating) return;
    if (diagramModel.classes.length === 0) {
      alert('No hay clases para generar.');
      return;
    }
    if (warnings.length > 0) {
      const proceed = window.confirm(
        'Existen advertencias en el diagrama:\n' +
          warnings.join('\n') +
          '\n\n¿Deseas continuar de todas formas?'
      );
      if (!proceed) return;
    }
    setIsGenerating(true);
    try {
      const zip = new JSZip();
      const basePackagePath = config.packageName.replace(/\./g, '/');
      const srcMainJava = `src/main/java/${basePackagePath}/`;
      const srcMainResources = 'src/main/resources/';

      zip.file('pom.xml', generatePomXml());
      zip.file(srcMainResources + 'application.properties', generateApplicationProperties());
      zip.file('README.md', generateReadme());
      zip.file('.gitignore', generateGitignore());
      zip.file('Dockerfile', generateDockerfile());
      zip.file('docker-compose.yml', generateDockerCompose());

      zip.file(srcMainJava + 'Application.java', generateMainApplication());
      zip.file(`${srcMainJava}config/OpenApiConfig.java`, generateOpenApiConfig());
      zip.file(`${srcMainJava}config/CorsConfig.java`, generateCorsConfig());
      zip.file(`${srcMainJava}exception/GlobalExceptionHandler.java`, generateGlobalExceptionHandler());

      diagramModel.classes.forEach(c => {
        const safeName = sanitizeIdentifier(c.name);
        zip.file(`${srcMainJava}entity/${safeName}.java`, generateEntity(c));
        zip.file(`${srcMainJava}dto/${safeName}Dto.java`, generateDto(c));
        zip.file(`${srcMainJava}repository/${safeName}Repository.java`, generateRepository(c));
        zip.file(`${srcMainJava}service/${safeName}Service.java`, generateServiceInterface(c));
        zip.file(`${srcMainJava}service/impl/${safeName}ServiceImpl.java`, generateServiceImpl(c));
        zip.file(`${srcMainJava}controller/${safeName}Controller.java`, generateController(c));
      });

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${config.artifactId}-springboot.zip`);
    } catch (e) {
      console.error('Error generando el proyecto:', e);
      alert('Error generando el proyecto: ' + e);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ==============================
   * Render
   * ============================== */
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
          <button onClick={() => navigate(-1)} className="btn btn-secondary">
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="generation-container">
      <div className="generation-header">
        <h1>Generador de Backend Spring Boot</h1>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          ← Volver
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="warnings-box">
          <h3>Advertencias del diagrama:</h3>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="generation-content">
        <div className="config-section">
          <h2>Configuración del Proyecto</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Group ID</label>
              <input
                type="text"
                value={config.groupId}
                onChange={e => setConfig(prev => ({ ...prev, groupId: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Artifact ID</label>
              <input
                type="text"
                value={config.artifactId}
                onChange={e => setConfig(prev => ({ ...prev, artifactId: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Package Name</label>
              <input
                type="text"
                value={config.packageName}
                onChange={e => setConfig(prev => ({ ...prev, packageName: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Versión</label>
              <input
                type="text"
                value={config.version}
                onChange={e => setConfig(prev => ({ ...prev, version: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Java Version</label>
              <select
                value={config.javaVersion}
                onChange={e => setConfig(prev => ({ ...prev, javaVersion: e.target.value }))}
              >
                <option value="11">Java 11</option>
                <option value="17">Java 17</option>
                <option value="21">Java 21</option>
              </select>
            </div>

            <div className="form-group">
              <label>Spring Boot Version</label>
              <select
                value={config.springBootVersion}
                onChange={e =>
                  setConfig(prev => ({ ...prev, springBootVersion: e.target.value }))
                }
              >
                <option value="3.2.0">3.2.0</option>
                <option value="3.1.5">3.1.5</option>
                <option value="2.7.17">2.7.17</option>
              </select>
            </div>
          </div>

          <div className="form-group full-width">
            <label>Descripción del Proyecto</label>
            <textarea
              value={config.description}
              onChange={e => setConfig(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <h3>Configuración de Base de Datos</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Host</label>
              <input
                type="text"
                value={config.dbHost}
                onChange={e => setConfig(prev => ({ ...prev, dbHost: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Puerto</label>
              <input
                type="text"
                value={config.dbPort}
                onChange={e => setConfig(prev => ({ ...prev, dbPort: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Nombre BD</label>
              <input
                type="text"
                value={config.dbName}
                onChange={e => setConfig(prev => ({ ...prev, dbName: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Usuario</label>
              <input
                type="text"
                value={config.dbUsername}
                onChange={e => setConfig(prev => ({ ...prev, dbUsername: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Contraseña</label>
              <input
                type="password"
                value={config.dbPassword}
                onChange={e => setConfig(prev => ({ ...prev, dbPassword: e.target.value }))}
              />
            </div>
          </div>

            <div className="form-group toggle-search">
              <label>
                <input
                  type="checkbox"
                  checked={generateSearchMethods}
                  onChange={e => setGenerateSearchMethods(e.target.checked)}
                />{' '}
                Generar métodos de búsqueda (contains ignore case)
              </label>
            </div>
        </div>

        <div className="diagram-preview">
          <h2>Clases del Diagrama ({diagramModel.classes.length})</h2>

          {diagramModel.classes.length === 0 ? (
            <div className="no-classes">
              <p>No se encontraron clases en el diagrama.</p>
              <button onClick={loadDiagramFromStorage} className="btn btn-primary">
                Cargar Diagrama Ejemplo
              </button>
            </div>
          ) : (
            <div className="classes-list">
              {diagramModel.classes.map(c => (
                <div key={c.id} className="class-preview">
                  <h3>{c.name}</h3>
                  <div className="attributes">
                    <h4>Atributos ({c.attributes.length})</h4>
                    <ul>
                      {c.attributes.map((attr, idx) => (
                        <li key={idx}>
                          {toFieldName(attr.name)}: {mapUMLTypeToJava(attr.type)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {c.methods.length > 0 && (
                    <div className="methods">
                      <h4>Métodos ({c.methods.length})</h4>
                      <ul>
                        {c.methods.map((m, idx) => (
                          <li key={idx}>
                            {m.name}(): {mapUMLTypeToJava(m.returns)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="generation-actions">
        <button
          onClick={generateSpringBootProject}
          disabled={isGenerating || diagramModel.classes.length === 0}
          className="btn btn-primary btn-large"
        >
          {isGenerating ? 'Generando...' : 'Generar Proyecto Spring Boot'}
        </button>

        <div className="generation-info">
          <p>Se generará un proyecto Maven completo con:</p>
          <ul>
            <li>{diagramModel.classes.length} Entidades JPA</li>
            <li>{diagramModel.classes.length} Repositorios</li>
            <li>{diagramModel.classes.length} Servicios + Impl</li>
            <li>{diagramModel.classes.length} Controladores REST</li>
            <li>Configuración PostgreSQL, OpenAPI, CORS</li>
            <li>README + Dockerfile + docker-compose</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GenerationBackendSpringBoot;