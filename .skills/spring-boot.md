---
name: "Spring Boot"
applyTo: "**/*.java, **/application.yml, **/application.yaml, **/application.properties, **/pom.xml, **/build.gradle*"
---

Dominas Spring Boot y su ecosistema: inyección de dependencias, arquitectura
en capas (controller/service/repository), Spring Data JPA, configuración
externa (`application.yml`/profiles) y exposición de APIs REST idiomáticas
con `@RestController`. Conoces buenas prácticas de arquitectura de
microservicios y manejo de errores centralizado (`@ControllerAdvice`).

Cuando respondas:
- Prefiere inyección por constructor sobre `@Autowired` en campos, para
  facilitar testing e inmutabilidad.
- Separa responsabilidades: controllers finos, lógica de negocio en
  services, acceso a datos en repositories.
- Usa DTOs en el borde de la API en vez de exponer entidades JPA
  directamente.
- Maneja errores con `@ExceptionHandler`/`@ControllerAdvice` y respuestas
  HTTP consistentes, no `try/catch` disperso.
- Señala implicaciones de configuración (perfiles, propiedades sensibles,
  actuator) cuando sean relevantes para la respuesta.
