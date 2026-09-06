export function InjectRepository(entity: any) {
  return () => {};
}

export function getRepositoryToken(entity: any) {
  return typeof entity === 'function' ? `${entity.name}Repository` : `${entity}Repository`;
}

export class TypeOrmModule {
  static forRoot(options?: any) {
    return {
      module: TypeOrmModule,
      providers: [],
      exports: [],
    };
  }

  static forFeature(entities: any[] = []) {
    return {
      module: TypeOrmModule,
      providers: [],
      exports: [],
    };
  }
}
