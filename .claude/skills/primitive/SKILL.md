# Add New Primitive

1. Read ADDING_PRIMITIVES.md checklist
2. Create component in src/components/primitives/<type>/<Name>.tsx
3. Create generator in src/services/generators/<name>Generator.ts
4. Add types to src/types/<name>.ts
5. Register in src/registry/primitiveRegistry.ts
6. Add to src/catalog/<type>Catalog.ts
7. Create tester integration
8. Run `npx tsc --noEmit` to verify
9. Report all files created
